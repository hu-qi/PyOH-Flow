/** The browser runs the same Rust compiler as flow-cli, compiled into wasm32. */
import wasmUrl from './generated/flow_wasm.wasm?url';
import type { FlowProgram } from './flow-ir';

type Compiler = {
  memory: WebAssembly.Memory;
  flow_schema_version():number;
  flow_alloc(length:number):number;
  flow_dealloc(pointer:number,length:number):void;
  flow_compile_json(pointer:number,length:number):number;
  flow_output_len():number;
};
export type FlowDiagnostic={code:string;source_id:string;message:string};
export class FlowCompileError extends Error {
  constructor(public readonly diagnostics:FlowDiagnostic[]) {
    super(diagnostics.map(d=>`${d.code}${d.source_id?` (${d.source_id})`:''}: ${d.message}`).join('\n'));
    this.name='FlowCompileError';
  }
}
let loading:Promise<Compiler>|undefined;
async function load():Promise<Compiler>{
  if(!loading){
    loading=(async()=>{
      const response=await fetch(wasmUrl);
      if(!response.ok)throw new Error(`Rust WASM 加载失败: ${response.status}`);
      const {instance}=await WebAssembly.instantiate(await response.arrayBuffer(),{});
      const exports=instance.exports as unknown as Compiler;
      if(exports.flow_schema_version()!==1)throw new Error('Rust WASM 与 Flow IR 版本不兼容');
      return exports;
    })().catch(e=>{loading=undefined;throw e;});
  }
  return loading;
}
export async function compileFlow(program:FlowProgram):Promise<string>{
  const compiler=await load();
  const bytes=new TextEncoder().encode(JSON.stringify(program));
  if(bytes.length>1_000_000)throw new Error('Flow IR 超过 1MB');
  const ptr=compiler.flow_alloc(bytes.length);
  if(!ptr)throw new Error('Rust WASM 内存分配失败');
  let out:Uint8Array;
  try {
    new Uint8Array(compiler.memory.buffer,ptr,bytes.length).set(bytes);
    const outputPtr=compiler.flow_compile_json(ptr,bytes.length);
    const len=compiler.flow_output_len();
    if(!outputPtr||len>5_000_000)throw new Error('Rust WASM 返回无效数据');
    out=new Uint8Array(new Uint8Array(compiler.memory.buffer,outputPtr,len));
  } finally {compiler.flow_dealloc(ptr,bytes.length);}
  const result=JSON.parse(new TextDecoder().decode(out)) as {ok:boolean;code?:string;diagnostics?:FlowDiagnostic[]};
  if(result.ok && typeof result.code==='string')return result.code;
  throw new FlowCompileError(result.diagnostics??[{code:'UNKNOWN',source_id:'',message:'未返回代码'}]);
}
