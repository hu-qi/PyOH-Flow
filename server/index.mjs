import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_REQUEST = 48 * 1024;
const MODEL = process.env.AI_MODEL || '';
const BASE_URL = (process.env.AI_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.AI_API_KEY || '';
const origin = process.env.ALLOWED_ORIGIN || '';
const systemPrompt = `你是 PyOH-Flow 编程助手。用中文，准确、友好地帮助用户理解 Blockly 积木、MicroPython 程序、GPIO、ADC、PWM、I2C、UART 和安全硬件接线。
MicroPython 不等于 OpenHarmony 标准系统 Python。必须指出目标板卡/固件/引脚支持可能不同。
不臆造设备连接状态、不声称已在真实硬件运行程序。不输出密钥。针对硬件控制优先给出可验证的步骤。`;

function json(res, status, payload, headers = {}) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
  res.end(JSON.stringify(payload));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data',chunk => {body += chunk; if(body.length>MAX_REQUEST){reject(new Error('请求体过大'));req.destroy();}});
    req.on('end',()=>resolve(body));req.on('error',reject);
  });
}

export const server = http.createServer(async (req,res) => {
  const cors = origin && req.headers.origin === origin ? {'Access-Control-Allow-Origin':origin,'Vary':'Origin'} : {};
  if (req.method === 'OPTIONS' && origin && req.headers.origin === origin) {
    res.writeHead(204,{...cors,'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return;
  }
  if (req.url === '/api/health' && req.method === 'GET') {json(res,200,{ok:true,aiConfigured:!!(BASE_URL&&API_KEY&&MODEL)},cors);return;}
  if (req.url !== '/api/chat' || req.method !== 'POST') {json(res,404,{error:'接口不存在'},cors);return;}
  if (!BASE_URL || !MODEL || !API_KEY) {json(res,503,{error:'AI 服务尚未配置：需要 AI_BASE_URL、AI_MODEL 和 AI_API_KEY'},cors);return;}
  try {
    const body = JSON.parse(await readBody(req));
    if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000) {json(res,400,{error:'请输入 1～4000 字的消息'},cors);return;}
    const context = body.context && typeof body.context === 'object' ? body.context : {};
    const sanitize = input => typeof input === 'string' ? input : '';
    const history = Array.isArray(body.history) ? body.history.slice(-8).filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string').map(m=>({role:m.role,content:m.content.slice(0,4000)})) : [];
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),30_000);
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`,{
        method:'POST',signal:controller.signal,
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${API_KEY}`},
        body:JSON.stringify({model:MODEL,stream:false,temperature:0.3,max_tokens:1500,
          messages:[{role:'system',content:systemPrompt},{role:'system',content:`当前项目：${sanitize(context.project).slice(0,100)}\n板型：${sanitize(context.board).slice(0,100)}\n程序：\n${sanitize(context.code).slice(0,14000)}`},...history,{role:'user',content:body.message}]})
      });
      const result=await response.json();
      if(!response.ok){json(res,502,{error:`上游 AI 服务响应失败 (${response.status})`},cors);return;}
      const reply=result?.choices?.[0]?.message?.content;
      if(typeof reply!=='string'){json(res,502,{error:'AI 服务响应格式不正确'},cors);return;}
      json(res,200,{reply},cors);
    } finally {clearTimeout(timeout);}
  } catch(e) {
    console.error('AI 请求失败:',e instanceof Error?e.message:String(e));
    json(res,502,{error:'AI 服务暂不可用，请稍后重试'},cors);
  }
});

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  server.listen(PORT,HOST,()=>console.log(`PyOH API listening on http://${HOST}:${PORT}`));
}
