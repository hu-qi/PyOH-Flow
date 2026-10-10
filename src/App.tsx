import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type * as Blockly from 'blockly/core';
import {
  Bot, BookOpenText, Check, ChevronDown, ChevronRight,
  CircleHelp, Code2, Copy, Download, FileCode2, FilePlus2, FolderOpen,
  HardDrive, Lightbulb, LoaderCircle, Maximize2, MessageCircle, Minus,
  PanelRightClose, PanelRightOpen, Play, Plus, PlugZap,
  Redo2, RotateCcw, Save, Send, Settings2, Sparkles, Square,
  Terminal, Trash2, Undo2, Upload, X
} from 'lucide-react';
import Editor from './components/Editor';
import type { EditorHandle } from './components/Editor';
import { blockExplanations } from './blockly/blocks';
import {
  SELECTED_KEY, STORE_KEY, downloadText, newProject,
  newXiaohongProject, parseProjects, safeFilename, validateProjectImport
} from './core/projects';
import type { Board, Project } from './core/projects';
import { SerialConnection } from './hardware/serial';
import { generateXiaohongC, xiaohongBuildGn, xiaohongIntegrationGuide } from './targets/xiaohong';
import { zipFiles } from './targets/zip';

type ChatMessage = {id: string; role: 'assistant' | 'user' | 'system'; content: string; time: string};
const boards: Record<Board, string> = {
  generic:'通用 MicroPython', esp32:'ESP32 · MicroPython', pico:'Raspberry Pi Pico', 'xiaohong-ws63':'小鸿 AI · WS63 / OpenHarmony'
};
const intro = '你好！我是 PyOH AI 助手。可以帮你理解积木、分析生成的 Python 代码，以及编写项目说明。选择积木后点击「问 AI」，无需配置模型也能查看内置说明。';
const commands = [
  { command:'/doc', description:'生成项目文档', detail:'基于当前项目与 Python 代码生成 Markdown 说明' },
  { command:'/explain', description:'解释选中积木', detail:'解析用途、参数和使用建议' },
  { command:'/code', description:'检查 Python 代码', detail:'将当前程序发送给已配置的 AI 模型分析' },
  { command:'/clear', description:'清空对话', detail:'保留编辑区和项目文件' },
  { command:'/new', description:'新建会话', detail:'开始新的 AI 对话' }
];
const timestamp = () => new Date().toLocaleTimeString('zh-CN', { hour:'2-digit',minute:'2-digit',hour12:false });
const uid = () => crypto.randomUUID();
function initialProjects(): Project[] {
  const saved = parseProjects(localStorage.getItem(STORE_KEY));
  return saved.length ? saved : [newProject('光敏传感器报警', true)];
}
function buildDocumentation(project: Project, code: string): string {
  if (project.board==='xiaohong-ws63') return `# ${project.name}\n\n生成目标：**小鸿 AI / WS63 + OpenHarmony**。\n\n本项目生成的是 C + GN 工程，不能通过 MicroPython REPL 运行，需按照工程中的 INTEGRATION.md 编译烧录。\n\n\`\`\`c\n${code}\n\`\`\`\n`;
  return `# ${project.name}\n\n> 由 PyOH-Flow 自动生成 · ${new Date().toLocaleString('zh-CN')}\n\n## 项目概述\n\n本项目通过可视化积木编程生成适用于 **${boards[project.board]}** 的 MicroPython 脚本。\n\n## 使用步骤\n\n1. 进入工作台检查每个 GPIO/ADC 引脚与真实硬件的对应关系。\n2. 导出 Python 脚本，或者在支持 Web Serial 的浏览器内连接运行 MicroPython 的设备。\n3. 确认串口终端可进入 MicroPython REPL 后，再发送脚本并观察返回日志。\n\n## 设备要求\n\n- 目标板型：${boards[project.board]}\n- 固件：与生成代码兼容的 MicroPython（**不是** OpenHarmony 标准系统通用 Python）\n- 可能使用的硬件接口：GPIO / ADC / PWM / I2C / UART，以积木实际使用为准。\n\n## 生成代码\n\n\`\`\`python\n${code.trim()}\n\`\`\`\n\n## 注意事项\n\n请先在实物上验证引脚映射、ADC 精度、LED 极性和执行协议。浏览器串口功能要求 HTTPS 或 localhost，且需支持 Web Serial。\n`;
}

function Logo() {
  return <span className="brand-icon" aria-hidden="true"><Code2 size={20} strokeWidth={2.6}/><span className="brand-strip" /></span>;
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(SELECTED_KEY) || '');
  const project = useMemo(() => projects.find(p => p.id === activeId) || projects[0], [projects, activeId]);
  const [editor, setEditor] = useState<EditorHandle | null>(null);
  const [currentCode, setCurrentCode] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<Blockly.Block | null>(null);
  const [projectMenu, setProjectMenu] = useState(false);
  const [boardMenu, setBoardMenu] = useState(false);
  const [rightVisible, setRightVisible] = useState(true);
  const [rightSize, setRightSize] = useState(39);
  const [codeVisible, setCodeVisible] = useState(false);
  const [consoleMode, setConsoleMode] = useState<'code'|'serial'>('code');
  const [terminal, setTerminal] = useState('PyOH-Flow 串口终端已就绪。\n请连接运行 MicroPython 的兼容设备。\n');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{id:uid(),role:'assistant',content:intro,time:timestamp()}]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const importFile = useRef<HTMLInputElement>(null);
  const chatScroll = useRef<HTMLDivElement>(null);
  const serial = useRef<SerialConnection | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(projects));
    if (project) localStorage.setItem(SELECTED_KEY, project.id);
  }, [projects, project]);
  useEffect(() => {
    if (editor) { try { setCurrentCode(editor.getCode()); } catch(e) { setCurrentCode(`// ${e instanceof Error ? e.message : String(e)}`); } }
  }, [editor, project.board, project.id]);
  useEffect(() => { chatScroll.current?.scrollTo({top:chatScroll.current.scrollHeight,behavior:'smooth'}); }, [messages,pending]);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!isResizing) return;
      const fraction = 100 * (window.innerWidth - e.clientX) / window.innerWidth;
      setRightSize(Math.min(57,Math.max(25,fraction)));
    };
    const stop = () => setIsResizing(false);
    window.addEventListener('pointermove',onMove);
    window.addEventListener('pointerup',stop);
    return () => {window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',stop);};
  },[isResizing]);
  useEffect(() => {
    serial.current = new SerialConnection(
      data => setTerminal(previous => (previous + data).slice(-50000)),
      setConnected
    );
    return () => { void serial.current?.disconnect(); };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 3300);
    return () => clearTimeout(timeout);
  },[notice]);

  const updateProject = useCallback((patch: Partial<Project>) => {
    const id = projectRef.current.id;
    setProjects(prev => prev.map(p => p.id === id ? {...p,...patch,updatedAt:new Date().toISOString()} : p));
  },[]);
  const onWorkspaceChange = useCallback((workspace: Record<string,unknown>, code: string) => {
    setCurrentCode(code);
    updateProject({workspace});
  },[updateProject]);
  const addMessage = (role: ChatMessage['role'],content:string) => {
    setMessages(prev => [...prev,{id:uid(),role,content,time:timestamp()}]);
  };
  const notify = (message:string) => setNotice(message);
  const createProject = () => {
    const p = newProject('新建项目');
    setProjects(prev => [...prev,p]);
    setActiveId(p.id);
    setCurrentCode('');
    setProjectMenu(false);
    notify('已创建新项目');
  };
  const loadDemo = () => {
    const p = newProject('光敏传感器报警', true);
    setProjects(prev => [...prev,p]);
    setActiveId(p.id);
    setProjectMenu(false);
    notify('已载入 ADC + LED 示例');
  };
  const exportProject = () => {
    downloadText(`${safeFilename(project.name)}.pyoh.json`,JSON.stringify({...project,workspace:editor?.getWorkspace() || project.workspace},null,2),'application/json');
    setProjectMenu(false); notify('项目 JSON 已导出');
  };
  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file=event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('项目文件不能超过 2 MB');
      const p = validateProjectImport(JSON.parse(await file.text()));
      setProjects(prev => [...prev,p]); setActiveId(p.id);
      setProjectMenu(false); notify(`已导入「${p.name}」`);
    } catch(e) { notify(`导入失败：${String(e instanceof Error ? e.message : e)}`); }
    event.target.value = '';
  };
  const exportPython = () => {
    if (project.board==='xiaohong-ws63') { notify('小鸿工程请使用「导出 WS63 工程 ZIP」'); return; }
    const code = editor?.getCode() || currentCode;
    downloadText(`${safeFilename(project.name)}.py`,code,'text/x-python');
    notify('Python 脚本已导出');
  };
  const exportDoc = () => {
    if (project.board==='xiaohong-ws63') {
      try { const code = getXiaohongCode(); downloadText(`${safeFilename(project.name)}.md`,buildDocumentation(project,code),'text/markdown'); notify('项目文档已导出'); } catch(e) { notify(e instanceof Error ? e.message : String(e)); }
      return;
    }
    downloadText(`${safeFilename(project.name)}.md`,buildDocumentation(project,editor?.getCode()||currentCode),'text/markdown');
    notify('项目文档已导出');
  };
  const getXiaohongCode = (): string => {
    if (project.board!=='xiaohong-ws63') throw new Error('仅小鸿开发板可导出 WS63 工程');
    if (!editor) throw new Error('编辑器尚未就绪');
    return generateXiaohongC(editor.workspace);
  };
  const exportXiaohong = () => {
    try {
      const code = getXiaohongCode();
      const bundle = zipFiles({
        'samples/pyoh_flow/pyoh_flow.c': code,
        'samples/pyoh_flow/BUILD.gn': xiaohongBuildGn(),
        'INTEGRATION.md': xiaohongIntegrationGuide(),
        'project.pyoh.json': JSON.stringify({...project,workspace: editor?.getWorkspace()||project.workspace},null,2)
      });
      const url = URL.createObjectURL(bundle), a = document.createElement('a');
      a.href = url; a.download=`${safeFilename(project.name)}-xiaohong-ws63.zip`;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      notify('已导出 WS63 C/GN 工程；请在官方 SDK 编译');
    } catch(e) { notify(e instanceof Error ? e.message : String(e)); }
    setProjectMenu(false);
  };
  const loadXiaohongDemo = () => {
    const p = newXiaohongProject(); setProjects(prev => [...prev,p]); setActiveId(p.id);
    setProjectMenu(false); notify('已载入小鸿 WS63 串口心跳项目');
  };
  const toggleDevice = async () => {
    if(busy) return;
    setBusy(true);
    try {
      if (serial.current?.connected) { await serial.current.disconnect(); notify('串口已断开'); }
      else { await serial.current?.connect(); setConsoleMode('serial');setCodeVisible(true);notify('串口已连接'); }
    } catch(e) {notify(e instanceof Error ? e.message : String(e));}
    finally {setBusy(false);}
  };
  const runOnDevice = async () => {
    if (project.board==='xiaohong-ws63') { exportXiaohong();return; }
    if (!serial.current?.connected) { notify('请先连接支持 MicroPython REPL 的设备'); return; }
    if(!window.confirm('将中断当前设备程序，并通过 MicroPython raw REPL 执行新脚本。确认继续？')) return;
    setConsoleMode('serial');setCodeVisible(true);setBusy(true);
    try { await serial.current.executeMicroPython(editor?.getCode()||currentCode); notify('脚本已发送，请在串口终端确认执行结果'); }
    catch(e) {notify(e instanceof Error?e.message:String(e));}
    finally {setBusy(false);}
  };
  const explainBlock = () => {
    if (!selectedBlock) { addMessage('assistant','请先在工作区选择一个积木，然后点击「问 AI」。');return; }
    const t=selectedBlock.type;
    const item=blockExplanations[t];
    const fields=selectedBlock.inputList.flatMap(input => input.fieldRow.map(f=>f.getText())).filter(Boolean).join(' · ');
    addMessage('user',`请解释积木「${selectedBlock.toString()}」`);
    if(item) addMessage('assistant',`**${item.title}**\n\n作用：${item.purpose}\n\n参数：${item.parameters}\n\n当前积木：${fields}\n\n对应代码可通过底部代码面板查看。`);
    else addMessage('assistant',`**${selectedBlock.toString()}**\n\n这是一块 Blockly 内置积木。请打开 Python 代码面板查看它生成的表达式；需要更详细的示例，可在配置 AI 模型后直接追问。`);
  };
  const submitMessage = async (override?:string) => {
    const text = (override ?? input).trim();
    if(!text || pending) return;
    setInput('');setCommandOpen(false);
    if(text==='/clear' || text==='/new') {setMessages([{id:uid(),role:'assistant',content:'新会话已开始。需要帮助时输入 / 查看指令。',time:timestamp()}]);return;}
    if(text==='/explain') { explainBlock();return; }
    addMessage('user',text);
    if(text==='/doc') {
      const doc=buildDocumentation(project,currentCode);
      addMessage('assistant',`${doc}\n---\n可使用顶部「项目」→「导出项目文档」下载完整 Markdown。`);
      return;
    }
    setPending(true);
    try {
      const request = text==='/code' ? (project.board==='xiaohong-ws63'?'请检查当前 WS63 OpenHarmony C 程序的错误、SDK 兼容性、GN 配置和改进建议。':'请检查当前 Python 程序的错误、硬件兼容性和改进建议。') : text;
      const res=await fetch('/api/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:request,context:{project:project.name,board:boards[project.board],code:currentCode.slice(0,14000)},
          history:messages.slice(-8).map(({role,content})=>({role,content}))})
      });
      const json=await res.json() as {reply?:string;error?:string};
      if (!res.ok) throw new Error(json.error||`请求失败 (${res.status})`);
      addMessage('assistant',json.reply||'模型未返回内容');
    } catch(e) {
      addMessage('system',`${e instanceof Error?e.message:String(e)}\n\n可先使用 /doc 和 /explain 本地功能；在线 AI 需要在服务端配置 AI_API_KEY。`);
    } finally {setPending(false);}
  };
  const onInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void submitMessage();}
  };

  return <div className="app-shell" style={{'--right-size':rightVisible?`${rightSize}%`:'0px'} as React.CSSProperties}>
    <header className="topbar">
      <div className="brand"><Logo/><span>PyOH-Flow</span></div>
      <div className="title-entry"><FileCode2 size={17}/><input aria-label="项目名称" value={project.name} onChange={e=>updateProject({name:e.target.value.slice(0,80)})} /></div>
      <div className="header-menu-wrap">
        <button className="top-button" onClick={()=>{setProjectMenu(!projectMenu);setBoardMenu(false);}}><FolderOpen size={17}/> 项目 <ChevronDown size={15}/></button>
        {projectMenu && <div className="dropdown project-dropdown">
          <div className="dropdown-head">我的项目 <span>{projects.length}</span></div>
          <div className="project-list">{projects.map(p=><button className={p.id===project.id?'item selected':'item'} key={p.id} onClick={()=>{setActiveId(p.id);setProjectMenu(false);}}><FileCode2 size={15}/><span>{p.name}</span>{p.id===project.id&&<Check size={14}/>}</button>)}</div>
          <hr/>
          <button className="item" onClick={createProject}><FilePlus2 size={16}/> 新建项目</button>
          <button className="item" onClick={loadDemo}><Lightbulb size={16}/> 创建 MicroPython 示例</button>
          <button className="item" onClick={loadXiaohongDemo}><HardDrive size={16}/> 创建小鸿 WS63 示例</button>
          <button className="item" onClick={()=>importFile.current?.click()}><Upload size={16}/> 导入项目 JSON</button>
          <button className="item" onClick={exportProject}><Download size={16}/> 导出项目 JSON</button>
          {project.board==='xiaohong-ws63'?<button className="item" onClick={exportXiaohong}><Download size={16}/> 导出 WS63 工程 ZIP</button>:<button className="item" onClick={exportPython}><Code2 size={16}/> 导出 Python</button>}
          <button className="item" onClick={exportDoc}><BookOpenText size={16}/> 导出项目文档</button>
        </div>}
      </div>
      <div className="header-menu-wrap">
        <button className="top-button board-button" onClick={()=>{setBoardMenu(!boardMenu);setProjectMenu(false);}}><HardDrive size={17}/> <span className="hide-small">{boards[project.board]}</span><ChevronDown size={14}/></button>
        {boardMenu&&<div className="dropdown board-dropdown"><div className="dropdown-head">目标开发板</div>{(Object.keys(boards) as Board[]).map(board=><button className="item" key={board} onClick={()=>{updateProject({board});setBoardMenu(false);notify(board==='xiaohong-ws63'?'已切换 WS63：仅开放经适配的积木，不支持 REPL 运行':'已更新目标板型，请检查引脚映射');}}>{boards[board]}{project.board===board&&<Check size={15}/>}</button>)}</div>}
      </div>
      <button className={`top-button connectivity ${connected?'online':''}`} onClick={()=>void toggleDevice()} disabled={busy}><span className="status-dot"/>{connected?'已连接':'未连接'}</button>
      <div className="header-spacer" />
      <button className="run-button" onClick={()=>void runOnDevice()} disabled={busy} title={project.board==='xiaohong-ws63'?'导出用于官方 WS63 SDK 编译的 C/GN 工程':'发送至 MicroPython 设备'}><Play size={16} fill="currentColor"/> <span>{project.board==='xiaohong-ws63'?'导出工程':'运行'}</span></button>
      <button className="icon-button top-icon" onClick={()=>setCodeVisible(!codeVisible)} title={project.board==='xiaohong-ws63'?'显示 C 代码':'显示 Python 代码'}><Code2 size={20}/></button>
      <button className="icon-button top-icon" onClick={()=>{notify('所有编辑会自动保存到此浏览器');}} title="保存状态"><Save size={19}/></button>
      <button className="icon-button top-icon" onClick={()=>setShowHelp(true)} title="使用帮助"><Settings2 size={20}/></button>
      <button className="avatar" title="本地项目用户">开</button>
    </header>

    <main className="main-layout">
      <section className="studio-area" aria-label="编程编辑器">
        <Editor project={project} onReady={setEditor} onChange={onWorkspaceChange} onBlockSelected={setSelectedBlock}/>
        <div className="workspace-actions">
          <button title="撤销" onClick={()=>editor?.undo()}><Undo2 size={18}/></button>
          <button title="重做" onClick={()=>editor?.redo()}><Redo2 size={18}/></button>
          <span className="action-sep"/>
          <button title="缩小" onClick={()=>editor?.zoom(-1)}><Minus size={18}/></button>
          <button title="居中工作区" onClick={()=>editor?.center()}><Maximize2 size={17}/></button>
          <button title="放大" onClick={()=>editor?.zoom(1)}><Plus size={18}/></button>
          <span className="action-sep"/>
          <button title="示例程序" onClick={loadDemo}><Lightbulb size={18}/></button>
        </div>
        <div className="workspace-bottom">
          <button onClick={()=>{setCodeVisible(!codeVisible);setConsoleMode('code');}}><Code2 size={16}/> {project.board==='xiaohong-ws63'?'WS63 C 代码':'Python 代码'} <ChevronDown className={codeVisible?'rotated':''} size={15}/></button>
          {selectedBlock&&<button className="selected-action" onClick={explainBlock}><Sparkles size={15}/> 问 AI：{selectedBlock.type}</button>}
        </div>
        {codeVisible&&<div className="code-drawer">
          <div className="drawer-header"><div className="drawer-tabs"><button className={consoleMode==='code'?'active':''} onClick={()=>setConsoleMode('code')}><Code2 size={16}/> {project.board==='xiaohong-ws63'?'WS63 C 代码':'Python 代码'}</button><button className={consoleMode==='serial'?'active':''} onClick={()=>setConsoleMode('serial')}><Terminal size={16}/> 串口终端</button></div><div className="drawer-tools"><button title="复制代码" onClick={()=>{void navigator.clipboard.writeText(currentCode);notify('代码已复制');}}><Copy size={15}/></button><button title={project.board==='xiaohong-ws63'?'导出 WS63 工程 ZIP':'下载 .py'} onClick={project.board==='xiaohong-ws63'?exportXiaohong:exportPython}><Download size={15}/></button><button onClick={()=>setCodeVisible(false)} title="关闭"><X size={17}/></button></div></div>
          {consoleMode==='code'?<pre className="code-content">{currentCode}</pre>:<pre className="code-content serial-content">{terminal}</pre>}
          {consoleMode==='serial'&&<div className="terminal-actions"><button disabled={!connected||project.board==='xiaohong-ws63'} onClick={()=>void serial.current?.stop()}><Square size={13}/> 停止运行</button><button onClick={()=>setTerminal('')}><Trash2 size={13}/> 清空日志</button>{project.board==='xiaohong-ws63'?<span>WS63 串口仅用于接收日志；固件请使用官方工具烧录</span>:<button disabled={!connected||busy} onClick={()=>void runOnDevice()}><Play size={13}/> 发送脚本</button>}</div>}
        </div>}
      </section>
      {rightVisible&&<div className="resize-handle" role="separator" aria-orientation="vertical" onPointerDown={e=>{e.preventDefault();setIsResizing(true);}}><span/></div>}
      {rightVisible&&<aside className="assistant-pane" aria-label="AI 助手">
        <div className="assistant-title"><span className="assistant-title-icon"><Bot size={19}/></span><strong>AI 助手</strong><span className="assistant-tag">PyOH Assistant</span><div className="header-spacer"/><button className="icon-button" title="新建会话" onClick={()=>void submitMessage('/new')}><Plus size={18}/></button><button className="icon-button" title="关闭侧边栏" onClick={()=>setRightVisible(false)}><PanelRightClose size={18}/></button></div>
        <div className="chat-scroll" ref={chatScroll}>
          {messages.map(message=><div className={`chat-item ${message.role}`} key={message.id}>
            {message.role!=='user'&&<span className="chat-avatar"><Bot size={17}/></span>}
            <div className="chat-item-main"><div className="chat-meta">{message.role==='user'?'你':message.role==='system'?'系统提示':'AI 助手'} <span>{message.time}</span></div><div className="chat-bubble">{message.content}</div></div>
            {message.role==='user'&&<span className="chat-avatar user-avatar">开</span>}
          </div>)}
          {pending&&<div className="typing"><LoaderCircle size={15} className="spin"/> 模型正在思考…</div>}
        </div>
        <div className="chat-bottom">
          {commandOpen&&<div className="command-palette"><div className="command-head">指令</div>{commands.map(command=><button key={command.command} onClick={()=>void submitMessage(command.command)}><span className="command-name">{command.command}</span><span><strong>{command.description}</strong><small>{command.detail}</small></span></button>)}</div>}
          <div className="chat-input-box">
            <textarea aria-label="向 AI 提问" placeholder="向 AI 提问，或输入 / 查看指令…" value={input} onChange={e=>{setInput(e.target.value);setCommandOpen(e.target.value==='/');}} onKeyDown={onInputKeyDown}/>
            <div className="chat-input-foot"><button title="显示指令" onClick={()=>setCommandOpen(!commandOpen)}><Plus size={18}/></button><span>模型服务由服务端配置</span><button className="help-action" onClick={()=>setShowHelp(true)} title="帮助"><CircleHelp size={16}/></button><button className="send-button" aria-label="发送消息" disabled={pending||!input.trim()} onClick={()=>void submitMessage()}><Send size={17}/></button></div>
          </div>
        </div>
      </aside>}
      {!rightVisible&&<button className="reopen-assistant" onClick={()=>setRightVisible(true)} title="打开 AI 助手"><PanelRightOpen size={19}/><Bot size={18}/></button>}
    </main>
    <input hidden ref={importFile} type="file" accept=".json,.pyoh.json,application/json" onChange={e=>void importProject(e)}/>
    {notice&&<div role="status" className="toast"><Check size={16}/>{notice}</div>}
    {showHelp&&<div className="modal-mask" onClick={()=>setShowHelp(false)}><div className="help-modal" onClick={e=>e.stopPropagation()}><div className="modal-title"><BookOpenText size={22}/> PyOH-Flow 使用说明 <button onClick={()=>setShowHelp(false)}><X size={18}/></button></div><p>将左侧积木拖到画布中组合程序，项目会自动保存在当前浏览器的本地存储中。</p><div className="help-grid"><div><PlugZap size={20}/><strong>设备连接</strong><p>小鸿 WS63 使用 115200 串口读取日志，不能直接执行 MicroPython REPL；其他兼容 MicroPython 板可运行脚本。</p></div><div><FileCode2 size={20}/><strong>生成代码</strong><p>可查看 Python 或 WS63 C 代码。小鸿模式导出包含 C、GN 和集成指南的 ZIP 工程。</p></div><div><MessageCircle size={20}/><strong>AI 助手</strong><p>输入 /doc、/explain 使用本地功能；联网 AI 需要部署后端并配置环境变量。</p></div><div><RotateCcw size={20}/><strong>安全与兼容</strong><p>小鸿模式必须使用官方 SDK 编译烧录，不能将 C 文件直接发送串口；不支持的积木会报错。</p></div></div><button className="modal-confirm" onClick={()=>setShowHelp(false)}>开始编程 <ChevronRight size={16}/></button></div></div>}
  </div>;
}
