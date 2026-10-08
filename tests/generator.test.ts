import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { registerHardwareBlocks } from '../src/blockly/blocks';
import { generateCode } from '../src/blockly/generator';
import { DEMO_WORKSPACE } from '../src/core/projects';

describe('Blockly MicroPython integration', () => {
  it('loads the starter program and produces runnable Python structure', () => {
    registerHardwareBlocks();
    const ws = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(DEMO_WORKSPACE, ws);
      const code = generateCode(ws, 'generic');
      expect(code).toContain('from machine import Pin, ADC');
      expect(code).toContain('import time');
      expect(code).toContain('while True:');
      expect(code).toContain('read_u16()');
      expect(code).toContain('2000');
      expect(code).toContain('Pin(3, Pin.OUT).value(1)');
      expect(code).toContain('Pin(3, Pin.OUT).value(0)');
      expect(code).toContain('time.sleep(0.2)');
    } finally {
      ws.dispose();
    }
  });
  it('uses Raspberry Pi Pico ADC constructor in Pico profile', () => {
    registerHardwareBlocks();
    const ws = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(DEMO_WORKSPACE, ws);
      const code = generateCode(ws, 'pico');
      expect(code).toContain('ADC(26)');
      expect(code).not.toContain('ADC(Pin(26))');
    } finally { ws.dispose(); }
  });
});