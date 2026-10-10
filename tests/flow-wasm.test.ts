import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {blocklyToFlowIR} from '../src/core/flow-ir';
import {XIAOHONG_WORKSPACE} from '../src/core/projects';

type WasmAPI={
  memory:WebAssembly.Memory;
  flow_schema_version():number;
  flow_alloc(n:number):number;
  flow_dealloc(p:number,n:number):void;
  flow_compile_json(p:number,n:number):number;
  flow_output_len():number;
};
async function compile(value:unknown){
  const path=fileURLToPath(new URL('../src/core/generated/flow_wasm.wasm',import.meta.url));
  const {instance}=await WebAssembly.instantiate(readFileSync(path),{});
  const api=instance.exports as unknown as WasmAPI;
  expect(api.flow_schema_version()).toBe(1);
  const input=new TextEncoder().encode(JSON.stringify(value));
  const ptr=api.flow_alloc(input.length);
  expect(ptr).toBeGreaterThan(0);
  new Uint8Array(api.memory.buffer,ptr,input.length).set(input);
  const outPtr=api.flow_compile_json(ptr,input.length);
  const raw=new Uint8Array(new Uint8Array(api.memory.buffer,outPtr,api.flow_output_len()));
  api.flow_dealloc(ptr,input.length);
  return JSON.parse(new TextDecoder().decode(raw)) as {ok:boolean;code?:string;diagnostics?:Array<{code:string;source_id:string;message:string}>};
}
describe('real Rust wasm WebAssembly ABI',()=>{
  it('compiles the serialized Blockly heartbeat via Flow IR',async()=>{
    const program=blocklyToFlowIR(XIAOHONG_WORKSPACE);
    const result=await compile(program);
    expect(result.ok).toBe(true);
    expect(result.code).toContain('APP_FEATURE_INIT(FlowStart)');
    expect(result.code).toContain('flow_sleep_ms(1000U)');
    expect(result.code).toContain('Hello XiaoHong WS63!');
  });
  it('rejects invalid schema with a source-oriented diagnostic',async()=>{
    const program=blocklyToFlowIR(XIAOHONG_WORKSPACE);
    const result=await compile({...program,schema_version:2});
    expect(result.ok).toBe(false);
    expect(result.diagnostics?.[0]?.code).toBe('SCHEMA_VERSION');
  });
  it('rejects an unsafe zero divisor',async()=>{
    const p={schema_version:1,target:'xiaohong_ws63',body:[{kind:'repeat',source_id:'bad-loop',times:{kind:'binary',op:'div',left:{kind:'int',value:1},right:{kind:'int',value:0}},body:[]}]};
    const result=await compile(p);
    expect(result.ok).toBe(false);
    expect(result.diagnostics?.some(x=>x.code==='UNSAFE_DIVISOR'&&x.source_id==='bad-loop')).toBe(true);
  });
});
