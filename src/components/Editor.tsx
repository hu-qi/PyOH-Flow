import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as zhHans from 'blockly/msg/zh-hans';
import { toolbox, xiaohongToolbox } from '../blockly/toolbox';
import { registerHardwareBlocks } from '../blockly/blocks';
import { generateCode } from '../blockly/generator';
import type { Project } from '../core/projects';

export type EditorHandle = {
  workspace: Blockly.WorkspaceSvg;
  getCode: () => string;
  getWorkspace: () => Record<string, unknown>;
  zoom: (delta: number) => void;
  center: () => void;
  undo: () => void;
  redo: () => void;
};

type Props = {
  project: Project;
  onChange: (workspace: Record<string, unknown>, code: string) => void;
  onReady: (handle: EditorHandle | null) => void;
  onBlockSelected: (block: Blockly.Block | null) => void;
};

export default function Editor({ project, onChange, onReady, onBlockSelected }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ project, onChange, onReady, onBlockSelected });
  latest.current = { project, onChange, onReady, onBlockSelected };

  useEffect(() => {
    Blockly.setLocale(zhHans as unknown as Record<string, string>);
    registerHardwareBlocks();
    const ws = Blockly.inject(host.current!, {
      toolbox: (latest.current.project.board === 'xiaohong-ws63' ? xiaohongToolbox : toolbox) as Blockly.utils.toolbox.ToolboxDefinition,
      renderer: 'zelos',
      theme: Blockly.Theme.defineTheme('pyoh', {
        name: 'pyoh', base: Blockly.Themes.Classic,
        componentStyles: {
          workspaceBackgroundColour: '#eaf5ff',
          toolboxBackgroundColour: '#e1f0ff',
          toolboxForegroundColour: '#2361a0',
          flyoutBackgroundColour: '#e5f2ff',
          flyoutForegroundColour: '#2361a0',
          flyoutOpacity: 1,
          scrollbarColour: '#99b7d6',
          insertionMarkerColour: '#77c6ff',
          insertionMarkerOpacity: 0.35,
          cursorColour: '#268aff'
        }
      }),
      grid: { spacing: 24, length: 2, colour: '#8ea7c5', snap: false },
      zoom: { controls: false, wheel: true, startScale: 0.88, maxScale: 2.4, minScale: 0.35, scaleSpeed: 1.15, pinch: true },
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: false }
    });
    registerHardwareBlocks();
    try { Blockly.serialization.workspaces.load(latest.current.project.workspace, ws); }
    catch (e) { console.warn('载入项目失败', e); }
    const handle: EditorHandle = {
      workspace: ws,
      getCode: () => latest.current.project.board === 'xiaohong-ws63' ? '// WS63 由 Rust Flow Core (WASM) 生成' : generateCode(ws, latest.current.project.board),
      getWorkspace: () => Blockly.serialization.workspaces.save(ws) as Record<string, unknown>,
      zoom: (delta) => ws.zoomCenter(delta),
      center: () => ws.scrollCenter(),
      undo: () => ws.undo(false),
      redo: () => ws.undo(true),
    };
    latest.current.onReady(handle);
    const listener = (event: Blockly.Events.Abstract) => {
      if (event.type === Blockly.Events.SELECTED) {
        const selected = Blockly.common.getSelected();
        const block = selected && 'type' in selected && 'inputList' in selected
          ? selected as unknown as Blockly.Block : null;
        latest.current.onBlockSelected(block);
      }
      if (event.isUiEvent || ws.isDragging()) return;
      if (new Set<string>([Blockly.Events.BLOCK_CREATE, Blockly.Events.BLOCK_DELETE, Blockly.Events.BLOCK_CHANGE,
        Blockly.Events.BLOCK_MOVE, Blockly.Events.VAR_CREATE, Blockly.Events.VAR_DELETE,
        Blockly.Events.VAR_RENAME]).has(event.type)) {
        let code: string;
        try { code = handle.getCode(); } catch(e) { code = `// 代码生成失败\n// ${e instanceof Error ? e.message : String(e)}`; }
        latest.current.onChange(handle.getWorkspace(), code);
      }
    };
    ws.addChangeListener(listener);
    const observer = new ResizeObserver(() => Blockly.svgResize(ws));
    observer.observe(host.current!);
    return () => { observer.disconnect(); ws.removeChangeListener(listener); ws.dispose(); latest.current.onReady(null); };
  }, []);

  useEffect(() => {
    const ws = Blockly.getMainWorkspace();
    if (!(ws instanceof Blockly.WorkspaceSvg)) return;
    Blockly.Events.disable();
    try { Blockly.serialization.workspaces.load(project.workspace, ws); }
    catch (e) { console.warn('项目工作区格式错误', e); }
    finally { Blockly.Events.enable(); }
    ws.updateToolbox((project.board === 'xiaohong-ws63' ? xiaohongToolbox : toolbox) as Blockly.utils.toolbox.ToolboxDefinition);
    latest.current.onBlockSelected(null);
  }, [project.id,project.board]);

  return <div className="blockly-host" ref={host} aria-label="积木编程工作区" />;
}
