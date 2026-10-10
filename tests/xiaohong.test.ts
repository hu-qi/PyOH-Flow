import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { registerHardwareBlocks } from '../src/blockly/blocks';
import { DEMO_WORKSPACE, XIAOHONG_WORKSPACE, newXiaohongProject, validateProjectImport } from '../src/core/projects';
import { generateXiaohongC, XiaohongGenerationError, xiaohongBuildGn, xiaohongIntegrationGuide } from '../src/targets/xiaohong';
import { zipFiles } from '../src/targets/zip';

describe('XiaoHong WS63 OpenHarmony target', () => {
  it('generates real APP_FEATURE_INIT/CMSIS thread C from the dedicated starter project', () => {
    registerHardwareBlocks();
    const ws = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(XIAOHONG_WORKSPACE,ws);
      const code=generateXiaohongC(ws);
      expect(code).toContain('APP_FEATURE_INIT(PyOHFlowStart)');
      expect(code).toContain('osThreadNew(PyOHFlowMain, NULL, &attr)');
      expect(code).toContain('osKernelGetTickFreq()');
      expect(code).toContain('pyoh_sleep_ms(1000U)');
      expect(code).toContain('Hello XiaoHong WS63!');
      expect(code).not.toContain('from machine import');
    } finally {ws.dispose();}
  });
  it('fails closed for MicroPython hardware blocks instead of emitting fake WS63 APIs', () => {
    registerHardwareBlocks();
    const ws=new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(DEMO_WORKSPACE,ws);
      expect(()=>generateXiaohongC(ws)).toThrow(XiaohongGenerationError);
      expect(()=>generateXiaohongC(ws)).toThrow(/py_adc_setup|py_led_setup|py_adc_read/);
    } finally {ws.dispose();}
  });
  it('accepts comparisons, conditional branches and loops',()=>{
    registerHardwareBlocks();
    const ws=new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks:[{type:'py_start',inputs:{DO:{block:{
        type:'controls_if',inputs:{IF0:{block:{type:'logic_compare',fields:{OP:'GT'},inputs:{A:{block:{type:'math_number',fields:{NUM:4}}},B:{block:{type:'math_number',fields:{NUM:2}}}}}},DO0:{block:{type:'xh_log',fields:{TEXT:'ok'}}}}
      }}}}]}},ws);
      const code=generateXiaohongC(ws);
      expect(code).toContain('if ((4 > 2))');
      expect(code).toContain('"ok"');
    } finally {ws.dispose();}
  });
  it('preserves board profile in validated project and outputs GN integration instructions',()=>{
    const project=newXiaohongProject();
    expect(validateProjectImport(project).board).toBe('xiaohong-ws63');
    expect(xiaohongBuildGn()).toContain('static_library("pyoh_flow")');
    expect(xiaohongIntegrationGuide()).toContain('hb build -f');
  });
  it('exports a real ZIP and rejects path traversal',async()=>{
    const zip=zipFiles({'samples/pyoh_flow/pyoh_flow.c':'hello', 'INTEGRATION.md':'guide'});
    expect(zip.type).toBe('application/zip');
    const bytes=new Uint8Array(await zip.arrayBuffer());
    expect(new DataView(bytes.buffer).getUint32(0,true)).toBe(0x04034b50);
    expect(new DataView(bytes.buffer).getUint32(bytes.length-22,true)).toBe(0x06054b50);
    expect(()=>zipFiles({'../escape.txt':'no'})).toThrow();
  });
});
