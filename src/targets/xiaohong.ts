import type * as Blockly from 'blockly/core';

/**
 * XiaoHong WS63 / OpenHarmony LiteOS-M C generator.
 * Deliberately refuses unsupported blocks: MicroPython machine.* APIs and
 * board pins are NOT interchangeable with WS63 HAL / OpenHarmony APIs.
 */
export class XiaohongGenerationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`小鸿 WS63 暂不支持以下积木：\n${issues.join('\n')}`);
    this.name = 'XiaohongGenerationError';
  }
}

export const XIAOHONG_SAMPLE_DIR = 'vendor/atomgit/xiaohong/samples/pyoh_flow';
export const XIAOHONG_BUILD_TARGET = 'pyoh_flow';
const INDENT = '    ';
type Block = Blockly.Block;

type BuildContext = { index: number; issues: string[] };
function quoteCString(value: string): string {
  // JSON escapes Unicode, quotes, control chars and backslashes into a C-compatible literal.
  return JSON.stringify(value).replace(/\u2028|\u2029/g, ' ');
}
function label(b: Block): string { return `• ${b.type} (id=${b.id})`; }
function unsupported(b: Block, ctx: BuildContext): string {
  ctx.issues.push(label(b));
  return '0';
}
function codeForExpression(b: Block | null, ctx: BuildContext): string {
  if (!b) return '0';
  const field = (n: string) => String(b.getFieldValue(n));
  const child = (n: string) => codeForExpression(b.getInputTargetBlock(n), ctx);
  switch (b.type) {
    case 'math_number': {
      const n = Number(field('NUM'));
      if (!Number.isFinite(n) || !Number.isSafeInteger(n)) { ctx.issues.push(`${label(b)}：仅支持安全整数`); return '0'; }
      return String(n);
    }
    case 'logic_boolean': return field('BOOL') === 'TRUE' ? '1' : '0';
    case 'math_arithmetic': {
      const op: Record<string,string> = {ADD:'+',MINUS:'-',MULTIPLY:'*',DIVIDE:'/'};
      const symbol = op[field('OP')];
      if (!symbol) return unsupported(b, ctx);
      return `(${child('A')} ${symbol} ${child('B')})`;
    }
    case 'logic_compare': {
      const op: Record<string,string> = {EQ:'==',NEQ:'!=',LT:'<',LTE:'<=',GT:'>',GTE:'>='};
      const symbol = op[field('OP')];
      if (!symbol) return unsupported(b, ctx);
      return `(${child('A')} ${symbol} ${child('B')})`;
    }
    case 'logic_operation': {
      const op: Record<string,string> = {AND:'&&',OR:'||'};
      const symbol = op[field('OP')];
      if (!symbol) return unsupported(b,ctx);
      return `(${child('A')} ${symbol} ${child('B')})`;
    }
    case 'logic_negate': return `(!${child('BOOL')})`;
    default: return unsupported(b,ctx);
  }
}
function childStatements(b: Block, name: string, depth: number, ctx: BuildContext): string {
  const start = b.getInputTargetBlock(name);
  return start ? statements(start,depth,ctx) : `${INDENT.repeat(depth)}/* 空积木分支 */\n`;
}
function statements(start: Block | null, depth: number, ctx: BuildContext): string {
  let result = '';
  const seen = new Set<string>();
  let block = start;
  while (block) {
    if (seen.has(block.id)) {ctx.issues.push(`${label(block)}：检测到循环连接`); break;}
    seen.add(block.id);
    const pad=INDENT.repeat(depth);
    switch(block.type){
      case 'xh_log': result += `${pad}printf("[PyOH] %s\\r\\n", ${quoteCString(String(block.getFieldValue('TEXT')))});\n`;break;
      case 'xh_wait_ms': result += `${pad}pyoh_sleep_ms(${Math.floor(Math.max(1,Number(block.getFieldValue('MS'))))}U);\n`;break;
      case 'py_wait': result += `${pad}pyoh_sleep_ms(${Math.floor(Math.max(1,Number(block.getFieldValue('SECONDS'))*1000))}U);\n`;break;
      case 'py_forever':
        result+=`${pad}while (1) {\n${childStatements(block,'DO',depth+1,ctx)}${INDENT.repeat(depth+1)}osDelay(1U); /* 避免空转占满 CPU */\n${pad}}\n`;
        break;
      case 'controls_repeat_ext': {
        const loop=`pyoh_i_${ctx.index++}`;
        const count=codeForExpression(block.getInputTargetBlock('TIMES'),ctx);
        result+=`${pad}for (uint32_t ${loop} = 0; ${loop} < (uint32_t)(${count}); ++${loop}) {\n${childStatements(block,'DO',depth+1,ctx)}${pad}}\n`;
        break;
      }
      case 'controls_if': {
        let index=0;
        while (block.getInput(`IF${index}`)) {
          result+=`${pad}${index?'else if':'if'} (${codeForExpression(block.getInputTargetBlock(`IF${index}`),ctx)}) {\n${childStatements(block,`DO${index}`,depth+1,ctx)}${pad}} `;
          index++;
        }
        if(block.getInput('ELSE'))result+=`else {\n${childStatements(block,'ELSE',depth+1,ctx)}${pad}}`;
        result+='\n';
        break;
      }
      default:unsupported(block,ctx);
    }
    block=block.getNextBlock();
  }
  return result;
}
export function generateXiaohongC(workspace: Blockly.Workspace): string {
  const ctx:BuildContext = { index:0, issues:[] };
  const roots=workspace.getTopBlocks(true);
  for (const root of roots) if(root.type!=='py_start') ctx.issues.push(`${label(root)}：未连接到「当程序启动」`);
  const starts=roots.filter(root=>root.type==='py_start');
  if(starts.length!==1)ctx.issues.push(`必须恰好有一个「当程序启动」，当前有 ${starts.length} 个`);
  const body=starts.length===1 ? childStatements(starts[0], 'DO',1,ctx) : '';
  if(ctx.issues.length)throw new XiaohongGenerationError(ctx.issues);
  return `/* Generated by PyOH-Flow | XiaoHong AI WS63 + OpenHarmony LiteOS-M.
 * Target: vendor/atomgit/xiaohong/samples/pyoh_flow/pyoh_flow.c
 * This is firmware SOURCE, not a MicroPython REPL script.
 * Build against the official XiaoHong manifest/SDK; do not flash this file directly.
 */
#include <stdint.h>
#include <stdio.h>
#include "ohos_init.h"
#include "cmsis_os2.h"

static void pyoh_sleep_ms(uint32_t ms)
{
    uint32_t hz = osKernelGetTickFreq();
    if (hz == 0U) { return; }
    uint64_t ticks = ((uint64_t)ms * hz + 999U) / 1000U;
    if (ticks == 0U) { ticks = 1U; }
    if (ticks > UINT32_MAX) { ticks = UINT32_MAX; }
    osDelay((uint32_t)ticks);
}

static void PyOHFlowMain(void *arg)
{
    (void)arg;
${body || INDENT+'printf("[PyOH] hello from XiaoHong WS63\\r\\n");\n'}
}

static void PyOHFlowStart(void)
{
    const osThreadAttr_t attr = {
        .name = "pyoh_flow",
        .stack_size = 0x1000,
        .priority = osPriorityNormal,
    };
    if (osThreadNew(PyOHFlowMain, NULL, &attr) == NULL) {
        printf("[PyOH] osThreadNew failed\\r\\n");
    }
}

APP_FEATURE_INIT(PyOHFlowStart);
`;
}

export function xiaohongBuildGn(): string {
  return `# PyOH-Flow WS63 sample (integration requires parent features + SDK linkage)
static_library("pyoh_flow") {
  sources = [ "pyoh_flow.c" ]
  include_dirs = [ "//base/startup/init/interfaces/innerkits" ]
}
`;
}
export function xiaohongIntegrationGuide(): string {
  return `# 小鸿 AI / WS63 · PyOH-Flow 工程集成

> **需官方 OpenHarmony SDK 编译。浏览器无法直接烧录 C 文件。**

## 来源
- https://xiaohong.atomgit.com/
- https://xiaohong.atomgit.com/docs-en.html （HelloWorld、RTOS Timer / Delay）
- https://atomgit.com/xiaohong-ai/vendor_atomgit
- https://atomgit.com/xiaohong-ai/manifest

## 1. 准备 OpenHarmony 源码
建议 Ubuntu 22.04，先安装并配置官方 hb/repo 环境，按官方文档同步工程：

\`\`\`bash
repo init -u https://atomgit.com/xiaohong-ai/manifest
repo sync -c
\`\`\`

## 2. 将导出目录放入 vendor
将压缩包内 \`samples/pyoh_flow\` 文件夹复制至工程的
\`${XIAOHONG_SAMPLE_DIR}\`。

## 3. 合并构建配置（不要直接覆盖原工程文件）

1. 检查 \`vendor/atomgit/xiaohong/BUILD.gn\` 的 \`group("xiaohong")\` 已含 \`"samples:app"\`。
2. 在 \`vendor/atomgit/xiaohong/samples/BUILD.gn\` 的 \`lite_component("app")\` 里将 \`"pyoh_flow:pyoh_flow"\` 加入 \`features\`。
3. 检查 SDK 的 \`device/soc/hisilicon/ws63v100/sdkv106/build/config/target_config/ws63/config.py\`，根据当地 SDK 版本在 \`ws63-liteos-app\` 的 \`ram_component\` 中登记 \`"pyoh_flow"\`。
4. 检查 \`device/soc/hisilicon/ws63v100/sdkv106/libs_url/ws63/cmake/ohos.cmake\` 中的 \`COMPONENT_LIST\` 是否需要登记 \`"pyoh_flow"\`。
5. \`BUILD.gn\` 中的 include 目录和 target linkage 需与下载的 SDK / 官方 \`00_helloworld\` 示例核对；不同工程分支的目录可能不同。

官方文档还展示了在 \`xiaohong/src/samples/\` 直接编入源码的其他组织方式；若所用分支采用这一结构，须按该分支的现有 \`BUILD.gn\` 集成，不能同时按两种结构重复加入同一功能。

## 4. 编译与烧录

\`\`\`bash
hb set                   # mini → xiaohong
hb build -f
\`\`\`

输出目录通常为 \`out/xiaohong/xiaohong/ws63-liteos-app\`。使用官方适用于 WS63 的 BurnTool / burn.sh / ws63flash 烧录固件。**本应用不会自动发送固件或更改设备 Flash。**

## 5. 串口验证

CH341 驱动正确安装后，以 \`115200 8N1\` 连接设备，复位后观察 \`[PyOH]\` 日志。Web Serial 需要 Chrome/Edge 桌面版以及 HTTPS/localhost；纯串口日志不等于有 MicroPython REPL。

## 限制

本阶段仅支持已验证有对应 C/RTOS 语义的启动、等待、循环、判断、常量、串口日志积木。GPIO、ADC、PWM、屏幕、CI1302、NearLink 等必须先核实具体 SDK 版本和引脚/设备协议再实现。遇到不支持积木时生成器会中止导出并明确报错，不会生成伪实现。
`;
}
