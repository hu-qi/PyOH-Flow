import * as Blockly from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
import type { Board } from '../core/projects';

let board: Board = 'generic';
let initialized = false;
const indent = (source: string) => source.trim() || 'pass';

export function registerPythonGenerators(): void {
  if (initialized) return;
  initialized = true;
  const g = pythonGenerator;
  const importMachine = () => { g.definitions_['pyoh_machine'] = 'from machine import Pin, ADC, PWM, SoftI2C, UART'; };
  const importTime = () => { g.definitions_['pyoh_time'] = 'import time'; };
  const val = (block: Blockly.Block, name: string, fallback: string) => g.valueToCode(block, name, g.ORDER_NONE) || fallback;
  const pin = (block: Blockly.Block, key = 'PIN') => String(Number(block.getFieldValue(key)));
  const percent = (block: Blockly.Block) => Math.round(Number(block.getFieldValue('DUTY')) * 65535 / 100);
  const adcExpr = (p: string) => board === 'pico' ? `ADC(${p})` : `ADC(Pin(${p}))`;
  const statement = (block: Blockly.Block, input: string) => indent(g.statementToCode(block, input));
  g.forBlock['py_start'] = (b) => `# 程序启动\n${statement(b, 'DO')}\n`;
  g.forBlock['py_forever'] = (b) => { importTime(); return `while True:\n${g.statementToCode(b, 'DO') || '    pass\n'}    time.sleep_ms(1)\n`; };
  g.forBlock['py_wait'] = (b) => { importTime(); return `time.sleep(${Number(b.getFieldValue('SECONDS'))})\n`; };
  g.forBlock['py_print'] = (b) => `print(${val(b,'TEXT',"''")})\n`;
  g.forBlock['py_ticks'] = () => { importTime(); return ['time.ticks_ms()',g.ORDER_FUNCTION_CALL]; };
  g.forBlock['py_gpio_setup'] = (b) => {
    importMachine(); const p=pin(b), m=b.getFieldValue('MODE');
    return `gpio_${p} = Pin(${p}, Pin.${m === 'PULL_UP' ? 'IN, Pin.PULL_UP' : m})\n`;
  };
  g.forBlock['py_gpio_write'] = (b) => { importMachine(); return `Pin(${pin(b)}, Pin.OUT).value(${b.getFieldValue('STATE')})\n`; };
  g.forBlock['py_gpio_read'] = (b) => { importMachine(); return [`Pin(${pin(b)}, Pin.IN).value()`,g.ORDER_FUNCTION_CALL]; };
  g.forBlock['py_button_pressed'] = (b) => { importMachine(); return [`(Pin(${pin(b)}, Pin.IN, Pin.PULL_UP).value() == 0)`,g.ORDER_ATOMIC]; };
  g.forBlock['py_adc_setup'] = (b) => { importMachine(); return `adc_${pin(b)} = ${adcExpr(pin(b))}\n`; };
  g.forBlock['py_adc_read'] = (b) => { importMachine(); return [`${adcExpr(pin(b))}.read_u16()`,g.ORDER_FUNCTION_CALL]; };
  g.forBlock['py_led_setup'] = (b) => { importMachine(); return `led_${pin(b)} = Pin(${pin(b)}, Pin.OUT)\n`; };
  g.forBlock['py_led_write'] = (b) => { importMachine(); return `Pin(${pin(b)}, Pin.OUT).value(${b.getFieldValue('STATE')})\n`; };
  g.forBlock['py_pwm_set'] = (b) => {
    importMachine(); const p=pin(b);
    return `pwm_${p} = PWM(Pin(${p}), freq=${Number(b.getFieldValue('FREQ'))}, duty_u16=${percent(b)})\n`;
  };
  g.forBlock['py_pwm_off'] = (b) => { importMachine(); return `PWM(Pin(${pin(b)}), duty_u16=0).deinit()\n`; };
  g.forBlock['py_buzzer_tone'] = (b) => {
    importMachine(); const p=pin(b);
    return `buzzer_${p} = PWM(Pin(${p}), freq=${Number(b.getFieldValue('FREQ'))}, duty_u16=${percent(b)})\n`;
  };
  g.forBlock['py_buzzer_off'] = (b) => { importMachine(); return `PWM(Pin(${pin(b)}), duty_u16=0).deinit()\n`; };
  g.forBlock['py_i2c_scan'] = (b) => { importMachine(); return `print(SoftI2C(scl=Pin(${pin(b,'SCL')}), sda=Pin(${pin(b,'SDA')})).scan())\n`; };
  g.forBlock['py_i2c_write'] = (b) => {
    importMachine();
    return `SoftI2C(scl=Pin(${pin(b,'SCL')}), sda=Pin(${pin(b,'SDA')})).writeto(${val(b,'ADDRESS','0x40')}, str(${val(b,'DATA',"''")}).encode())\n`;
  };
  g.forBlock['py_uart_write'] = (b) => {
    importMachine();
    return `UART(1, baudrate=115200, tx=Pin(${pin(b,'TX')}), rx=Pin(${pin(b,'RX')})).write(str(${val(b,'DATA',"''")}))\n`;
  };
}

export function generateCode(workspace: Blockly.Workspace, target: Board): string {
  registerPythonGenerators();
  board = target;
  const code = pythonGenerator.workspaceToCode(workspace);
  return `# PyOH-Flow · MicroPython\n# Board profile: ${target}\n# 请确认设备固件与引脚映射后再运行\n\n${code.trim() || '# 从左侧拖入「当程序启动」开始编程'}\n`;
}
