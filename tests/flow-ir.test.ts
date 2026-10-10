import {describe,expect,it} from 'vitest';
import {blocklyToFlowIR,FlowConversionError} from '../src/core/flow-ir';
import {XIAOHONG_WORKSPACE,DEMO_WORKSPACE} from '../src/core/projects';
describe('Flow IR v1 adapter',()=>{
  it('converts the WS63 heartbeat program without any Python concepts',()=>{
    const ir=blocklyToFlowIR(XIAOHONG_WORKSPACE);
    expect(ir.schema_version).toBe(1);
    expect(ir.target).toBe('xiaohong_ws63');
    expect(ir.body[0]).toMatchObject({kind:'log',text:'Hello XiaoHong WS63!'});
    expect(ir.body[1]).toMatchObject({kind:'forever',body:[{kind:'sleep',millis:1000},{kind:'log',text:'PyOH-Flow heartbeat'}]});
  });
  it('rejects unsupported GPIO rather than silently generating invalid WS63 code',()=>{
    expect(()=>blocklyToFlowIR(DEMO_WORKSPACE)).toThrow(FlowConversionError);
    expect(()=>blocklyToFlowIR(DEMO_WORKSPACE)).toThrow(/py_adc_setup/);
  });
  it('rejects orphan blocks and empty expressions',()=>{
    expect(()=>blocklyToFlowIR({blocks:{blocks:[{type:'xh_log'},{type:'py_start'}]}})).toThrow(/顶层积木/);
    expect(()=>blocklyToFlowIR({blocks:{blocks:[{type:'py_start',inputs:{DO:{block:{id:'repeat',type:'controls_repeat_ext'}}}}]}})).toThrow(/插槽不能为空/);
  });
});
