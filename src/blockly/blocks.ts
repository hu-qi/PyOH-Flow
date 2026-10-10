import * as Blockly from 'blockly/core';

let initialized = false;
export const blockExplanations: Record<string, { title: string; purpose: string; parameters: string }> = {
  xh_log: {title:'小鸿串口日志',purpose:'通过 C printf 向 WS63 调试串口写出一行文本。',parameters:'TEXT：静态文本，默认串口 115200。'},
  xh_wait_ms: {title:'小鸿毫秒等待',purpose:'通过 CMSIS-RTOS2 osDelay 执行等待。',parameters:'MS：等待毫秒数，使用 tick 频率计算。'},
  py_start: {title:'当程序启动',purpose:'设备开始运行脚本时，从这里依次执行内部积木。',parameters:'无参数，放入执行区域中的积木会按顺序执行。'},
  py_forever: {title:'重复执行',purpose:'持续运行内部程序，常用于传感器监测和自动控制。',parameters:'DO：需要不断执行的积木。建议添加短暂等待以节省 CPU。'},
  py_adc_setup: {title:'初始化 ADC',purpose:'初始化模拟输入引脚，用来读取电压对应的采样值。',parameters:'PIN：开发板的 ADC 引脚号。引脚是否支持 ADC 由硬件决定。'},
  py_adc_read: {title:'读取 ADC',purpose:'读取模拟输入，并返回 0～65535 范围内的采样值（依固件实现）。',parameters:'PIN：模拟采样引脚。'},
  py_led_setup: {title:'初始化小灯珠',purpose:'设置 LED 引脚为数字输出。',parameters:'PIN：LED 所连接的 GPIO 编号。'},
  py_led_write: {title:'小灯珠开关',purpose:'通过数字电平控制 LED。',parameters:'PIN：GPIO 编号；状态：高电平 1 或低电平 0。某些板载 LED 低电平点亮。'},
  py_buzzer_tone: {title:'蜂鸣器',purpose:'配置 PWM 以输出指定频率的声音。',parameters:'PIN：蜂鸣器引脚；频率 Hz；占空比 0～100%。'},
  py_wait: {title:'等待',purpose:'让程序暂停指定秒数。',parameters:'SECONDS：暂停时长，单位秒。'},
};

const pinOptions: [string,string][] = Array.from({ length: 30 }, (_, i) => [String(i), String(i)]);

export function registerHardwareBlocks(): void {
  if (initialized) return;
  initialized = true;
  Blockly.defineBlocksWithJsonArray([
    {type:'xh_log',message0:'小鸿 串口打印 %1',args0:[{type:'field_input',name:'TEXT',text:'Hello XiaoHong!'}],previousStatement:null,nextStatement:null,colour:'#8854d0',tooltip:'将文本写入 WS63 115200 串口日志'},
    {type:'xh_wait_ms',message0:'小鸿 等待 %1 毫秒',args0:[{type:'field_number',name:'MS',value:1000,min:1,max:3600000,precision:1}],previousStatement:null,nextStatement:null,colour:'#4c99d8',tooltip:'按 CMSIS RTOS tick 频率转换毫秒并延时'},
    {type:'py_start',message0:'当程序启动',message1:'执行 %1',args1:[{type:'input_statement',name:'DO'}],colour:'#edc221',tooltip:'程序入口'},
    {type:'py_forever',message0:'重复执行',message1:'%1',args1:[{type:'input_statement',name:'DO'}],previousStatement:null,nextStatement:null,colour:'#4c99d8',tooltip:'持续执行循环体'},
    {type:'py_wait',message0:'等待 %1 秒',args0:[{type:'field_number',name:'SECONDS',value:1,min:0,precision:0.1}],previousStatement:null,nextStatement:null,colour:'#4c99d8'},
    {type:'py_print',message0:'打印 %1',args0:[{type:'input_value',name:'TEXT'}],previousStatement:null,nextStatement:null,colour:'#8854d0'},
    {type:'py_ticks',message0:'运行毫秒数',output:'Number',colour:'#8854d0'},
    {type:'py_gpio_setup',message0:'初始化 GPIO 引脚 %1 模式 %2',args0:[{type:'field_dropdown',name:'PIN',options:pinOptions},{type:'field_dropdown',name:'MODE',options:[['输出','OUT'],['输入','IN'],['上拉输入','PULL_UP']]}],previousStatement:null,nextStatement:null,colour:'#587ea1'},
    {type:'py_gpio_write',message0:'设置 GPIO %1 为 %2',args0:[{type:'field_dropdown',name:'PIN',options:pinOptions},{type:'field_dropdown',name:'STATE',options:[['高电平','1'],['低电平','0']]}],previousStatement:null,nextStatement:null,colour:'#587ea1'},
    {type:'py_gpio_read',message0:'读取 GPIO %1',args0:[{type:'field_dropdown',name:'PIN',options:pinOptions}],output:'Number',colour:'#587ea1'},
    {type:'py_button_pressed',message0:'按键 GPIO %1 被按下？',args0:[{type:'field_dropdown',name:'PIN',options:pinOptions}],output:'Boolean',colour:'#edc221'},
    {type:'py_adc_setup',message0:'初始化 ADC 引脚 %1',args0:[{type:'field_dropdown',name:'PIN',options:pinOptions}],previousStatement:null,nextStatement:null,colour:'#47b07d'},
    {type:'py_adc_read',message0:'读取 ADC 引脚 %1',args0:[{type:'field_dropdown',name:'PIN',options:pinOptions}],output:'Number',colour:'#47b07d'},
    {type:'py_led_setup',message0:'初始化小灯珠 引脚 %1',args0:[{type:'field_dropdown',name:'PIN',options:pinOptions}],previousStatement:null,nextStatement:null,colour:'#ffad38'},
    {type:'py_led_write',message0:'小灯珠 引脚 %1 状态 %2',args0:[{type:'field_dropdown',name:'PIN',options:pinOptions},{type:'field_dropdown',name:'STATE',options:[['点亮','1'],['熄灭','0']]}],previousStatement:null,nextStatement:null,colour:'#ffad38'},
    {type:'py_pwm_set',message0:'PWM 引脚 %1 频率 %2 Hz 占空比 %3 %%',args0:[{type:'field_dropdown',name:'PIN',options:pinOptions},{type:'field_number',name:'FREQ',value:1000,min:1},{type:'field_number',name:'DUTY',value:50,min:0,max:100}],previousStatement:null,nextStatement:null,colour:'#e36a63'},
    {type:'py_pwm_off',message0:'关闭 PWM 引脚 %1',args0:[{type:'field_dropdown',name:'PIN',options:pinOptions}],previousStatement:null,nextStatement:null,colour:'#e36a63'},
    {type:'py_buzzer_tone',message0:'蜂鸣器 引脚 %1 音量 %2 %% 频率 %3 Hz',args0:[{type:'field_dropdown',name:'PIN',options:pinOptions},{type:'field_number',name:'DUTY',value:30,min:0,max:100},{type:'field_number',name:'FREQ',value:3000,min:1}],previousStatement:null,nextStatement:null,colour:'#de87b3'},
    {type:'py_buzzer_off',message0:'关闭蜂鸣器 引脚 %1',args0:[{type:'field_dropdown',name:'PIN',options:pinOptions}],previousStatement:null,nextStatement:null,colour:'#de87b3'},
    {type:'py_i2c_scan',message0:'扫描 I2C 设备 (SCL %1 SDA %2)',args0:[{type:'field_dropdown',name:'SCL',options:pinOptions},{type:'field_dropdown',name:'SDA',options:pinOptions}],previousStatement:null,nextStatement:null,colour:'#59a6ac'},
    {type:'py_i2c_write',message0:'I2C 写入 地址 %1 数据 %2 (SCL %3 SDA %4)',args0:[{type:'input_value',name:'ADDRESS',check:'Number'},{type:'input_value',name:'DATA'},{type:'field_dropdown',name:'SCL',options:pinOptions},{type:'field_dropdown',name:'SDA',options:pinOptions}],previousStatement:null,nextStatement:null,colour:'#59a6ac'},
    {type:'py_uart_write',message0:'UART1 发送 %1 (TX %2 RX %3)',args0:[{type:'input_value',name:'DATA'},{type:'field_dropdown',name:'TX',options:pinOptions},{type:'field_dropdown',name:'RX',options:pinOptions}],previousStatement:null,nextStatement:null,colour:'#ac7950'}
  ]);
}
