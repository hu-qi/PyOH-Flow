export const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    { kind: 'category', name: '事件', colour: '#edc221', contents: [
      { kind: 'block', type: 'py_start' },
      { kind: 'block', type: 'py_wait' },
      { kind: 'block', type: 'py_button_pressed' }
    ] },
    { kind: 'category', name: '控制', colour: '#4c99d8', contents: [
      { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: { shadow: { type:'math_number', fields:{NUM:10} } } } },
      { kind: 'block', type: 'py_forever' },
      { kind: 'block', type: 'controls_if' },
      { kind: 'block', type: 'controls_whileUntil' },
      { kind: 'block', type: 'py_wait' }
    ] },
    { kind: 'category', name: '运算', colour: '#58a65c', contents: [
      { kind: 'block', type: 'math_number' },
      { kind: 'block', type: 'math_arithmetic', inputs: { A:{ shadow:{type:'math_number',fields:{NUM:1}} },B:{shadow:{type:'math_number',fields:{NUM:1}}} } },
      { kind: 'block', type: 'logic_compare' },
      { kind: 'block', type: 'logic_boolean' },
      { kind: 'block', type: 'logic_operation' },
      { kind: 'block', type: 'math_random_int' },
      { kind: 'block', type: 'text' },
      { kind: 'block', type: 'text_join' },
      { kind: 'block', type: 'math_single' }
    ] },
    { kind: 'category', name: '系统', colour: '#8854d0', contents: [
      { kind: 'block', type: 'py_print' },
      { kind: 'block', type: 'py_wait' },
      { kind: 'block', type: 'py_ticks' }
    ] },
    { kind: 'category', name: '变量', custom: 'VARIABLE', colour: '#f38b26' },
    { kind: 'category', name: '自制积木', custom: 'PROCEDURE', colour: '#f04e59' },
    { kind: 'category', name: 'GPIO', colour: '#587ea1', contents: [
      { kind: 'block', type: 'py_gpio_setup' },
      { kind: 'block', type: 'py_gpio_write' },
      { kind: 'block', type: 'py_gpio_read' },
      { kind: 'block', type: 'py_button_pressed' }
    ] },
    { kind: 'category', name: 'I2C', colour: '#59a6ac', contents: [
      { kind: 'block', type: 'py_i2c_scan' },
      { kind: 'block', type: 'py_i2c_write' }
    ] },
    { kind: 'category', name: 'UART', colour: '#ac7950', contents: [
      { kind: 'block', type: 'py_uart_write' }
    ] },
    { kind: 'category', name: 'ADC', colour: '#47b07d', contents: [
      { kind: 'block', type: 'py_adc_setup' },
      { kind: 'block', type: 'py_adc_read' }
    ] },
    { kind: 'category', name: 'PWM', colour: '#e36a63', contents: [
      { kind: 'block', type: 'py_pwm_set' },
      { kind: 'block', type: 'py_pwm_off' }
    ] },
    { kind: 'category', name: '小灯珠', colour: '#ffad38', contents: [
      { kind: 'block', type: 'py_led_setup' },
      { kind: 'block', type: 'py_led_write' }
    ] },
    { kind: 'category', name: '蜂鸣器', colour: '#de87b3', contents: [
      { kind: 'block', type: 'py_buzzer_tone' },
      { kind: 'block', type: 'py_buzzer_off' }
    ] }
  ]
};


/** Only advertise primitives supported by the OpenHarmony C generator. */
export const xiaohongToolbox = {
  kind: 'categoryToolbox',
  contents: [
    { kind:'category', name:'小鸿 WS63', colour:'#8854d0', contents:[
      {kind:'block',type:'py_start'}, {kind:'block',type:'xh_log'}, {kind:'block',type:'xh_wait_ms'}
    ] },
    { kind:'category', name:'控制', colour:'#4c99d8', contents:[
      {kind:'block',type:'py_forever'},
      {kind:'block',type:'controls_repeat_ext',inputs:{TIMES:{shadow:{type:'math_number',fields:{NUM:10}}}}},
      {kind:'block',type:'controls_if'}
    ] },
    { kind:'category', name:'逻辑和整数', colour:'#58a65c', contents:[
      {kind:'block',type:'math_number'}, {kind:'block',type:'math_arithmetic'},
      {kind:'block',type:'logic_boolean'}, {kind:'block',type:'logic_compare'},
      {kind:'block',type:'logic_operation'}, {kind:'block',type:'logic_negate'}
    ] }
  ]
};
