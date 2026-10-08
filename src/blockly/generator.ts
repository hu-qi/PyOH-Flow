import * as Blockly from 'blockly/core';
import { pythonGenerator, Order } from 'blockly/python';
import type { Board } from '../core/projects';

let board: Board = 'generic';
let initialized = false;

export function registerPythonGenerators(): void {
  if (initialized) return;
  initialized = true;
  const g = pythonGenerator;
  const val = (block: Blockly.Block, name: string, fallback: string) => g.valueToCode(block, name, Order.NONE) || fallback;
  const pin = (block: Blockly.Block, key = 'PIN') => String(Number(block.getFieldValue(key)));
  const percent = (block: Blockly.Block) => Math.round(Number(block.getFieldValue('DUTY')) * 65535 / 100);
  const adcExpr = (p: string) => board === 'pico' ? `ADC(${p})` : `ADC(Pin(${p}))`;
  g.forBlock['py_start'] = (b) => {
    const first = b.getInputTargetBlock('DO');
    const code = first ? g.blockToCode(first) : '';
    return `# 程序启动\n${typeof code === 'string' ? code : ''}\n`;
  };
  g.forBlock['py_forever'] = (b) => { return `while True:\n${g.statementToCode(b, 'DO') || '    pass\n'}    time.sleep_ms(1)\n`; };
  g.forBlock['py_wait'] = (b) => { return `time.sleep(${Number(b.getFieldValue('SECONDS'))})\n`; };
  g.forBlock['py_print'] = (b) => `print(${val(b,'TEXT',"''")})\n`;
  g.forBlock['py_ticks'] = () => { return ['time.ticks_ms()',Order.ATOMIC]; };
  g.forBlock['py_gpio_setup'] = (b) => {
    const p=pin(b), m=b.getFieldValue('MODE');
    return `gpio_${p} = Pin(${p}, Pin.${m === 'PULL_UP' ? 'IN, Pin.PULL_UP' : m})\n`;
  };
  g.forBlock['py_gpio_write'] = (b) => { return `Pin(${pin(b)}, Pin.OUT).value(${b.getFieldValue('STATE')})\n`; };
  g.forBlock['py_gpio_read'] = (b) => { return [`Pin(${pin(b)}, Pin.IN).value()`,Order.ATOMIC]; };
  g.forBlock['py_button_pressed'] = (b) => { return [`(Pin(${pin(b)}, Pin.IN, Pin.PULL_UP).value() == 0)`,Order.ATOMIC]; };
  g.forBlock['py_adc_setup'] = (b) => { return `adc_${pin(b)} = ${adcExpr(pin(b))}\n`; };
  g.forBlock['py_adc_read'] = (b) => { return [`${adcExpr(pin(b))}.read_u16()`,Order.ATOMIC]; };
  g.forBlock['py_led_setup'] = (b) => { return `led_${pin(b)} = Pin(${pin(b)}, Pin.OUT)\n`; };
  g.forBlock['py_led_write'] = (b) => { return `Pin(${pin(b)}, Pin.OUT).value(${b.getFieldValue('STATE')})\n`; };
  g.forBlock['py_pwm_set'] = (b) => {
    const p=pin(b);
    return `pwm_${p} = PWM(Pin(${p}), freq=${Number(b.getFieldValue('FREQ'))}, duty_u16=${percent(b)})\n`;
  };
  g.forBlock['py_pwm_off'] = (b) => { return `PWM(Pin(${pin(b)}), duty_u16=0).deinit()\n`; };
  g.forBlock['py_buzzer_tone'] = (b) => {
    const p=pin(b);
    return `buzzer_${p} = PWM(Pin(${p}), freq=${Number(b.getFieldValue('FREQ'))}, duty_u16=${percent(b)})\n`;
  };
  g.forBlock['py_buzzer_off'] = (b) => { return `PWM(Pin(${pin(b)}), duty_u16=0).deinit()\n`; };
  g.forBlock['py_i2c_scan'] = (b) => { return `print(SoftI2C(scl=Pin(${pin(b,'SCL')}), sda=Pin(${pin(b,'SDA')})).scan())\n`; };
  g.forBlock['py_i2c_write'] = (b) => {
    return `SoftI2C(scl=Pin(${pin(b,'SCL')}), sda=Pin(${pin(b,'SDA')})).writeto(${val(b,'ADDRESS','0x40')}, str(${val(b,'DATA',"''")}).encode())\n`;
  };
  g.forBlock['py_uart_write'] = (b) => {
    return `UART(1, baudrate=115200, tx=Pin(${pin(b,'TX')}), rx=Pin(${pin(b,'RX')})).write(str(${val(b,'DATA',"''")}))\n`;
  };
}

export function generateCode(workspace: Blockly.Workspace, target: Board): string {
  registerPythonGenerators();
  board = target;
  const code = pythonGenerator.workspaceToCode(workspace);
  const machineImports = ['Pin', 'ADC', 'PWM', 'SoftI2C', 'UART']
    .filter(api => new RegExp(`\\b${api}\\s*\\(`).test(code));
  const imports = [
    machineImports.length ? `from machine import ${machineImports.join(', ')}` : '',
    /\btime\./.test(code) ? 'import time' : '',
  ].filter(Boolean).join('\n');
  return `# PyOH-Flow · MicroPython\n# Board profile: ${target}\n# 请确认设备固件与引脚映射后再运行\n\n${imports ? imports + '\n\n' : ''}${code.trim() || '# 从左侧拖入「当程序启动」开始编程'}\n`;
}