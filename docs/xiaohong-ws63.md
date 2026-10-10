# 小鸿 AI / WS63 OpenHarmony 适配（P1）

## 硬件与执行模型

设备官网：<https://xiaohong.atomgit.com/>；代码：<https://atomgit.com/xiaohong-ai/vendor_atomgit>。小鸿 AI 采用海思 WS63 RISC-V + OpenHarmony LiteOS-M，CI1302 语音芯片、240×240 TFT、星闪、Wi-Fi、BLE。**标准小鸿固件不是 MicroPython，不能通过 raw REPL 运行 Python 积木。**

参考：官方 [HelloWorld / Timer / Delay](https://xiaohong.atomgit.com/docs-en.html) 示例。

## 本阶段包含

- 独立 WS63 / OpenHarmony 板型，可直接从项目菜单创建串口心跳样例；项目可导入、导出。
- WS63 专用工具箱（启动、串口日志、延时、循环、判断、算术、整数比较），阻止向用户展示尚未实现的 MicroPython GPIO 等积木。
- Blockly → OpenHarmony C 代码生成器：线程和系统启动入口采用 CMSIS-RTOS2、`APP_FEATURE_INIT`，延时根据内核 tick 频率换算。
- **不支持即失败**：旧 MicroPython ADC/PWM/LED 等积木、悬空代码及多个入口会生成错误提示，不能导出不能误烧录。
- 导出 ZIP：`samples/pyoh_flow/pyoh_flow.c`、`samples/pyoh_flow/BUILD.gn`、`INTEGRATION.md` 和项目 JSON。
- 设备串口用于 **115200 日志监视**；WS63 模式不提供 `Ctrl-C` 停止和 Python raw REPL 执行。
- 源代码级的测试，CI 通过 TypeScript、Vitest、Vite 构建。

## 从积木到硬件

1. 项目 → **创建小鸿 WS63 示例**，积木中含启动、等待 1000 ms、串口心跳。
2. 打开底部 **WS63 C 代码**，确认输出内容。遇到“不支持以下积木”须修改积木，不能直接导出。
3. 项目 → **导出 WS63 工程 ZIP**，解压后按 `INTEGRATION.md` 合并至官方 OpenHarmony 工程。
4. 使用官方 manifest/WS63 SDK 环境按实际分支配置 GN / SDK `ram_component`，运行 `hb set`、`hb build -f`。
5. 使用官方 BurnTool 或适配的 ws63flash 烧录完整固件镜像；重启设备，使用 USB 转串口 CH341、115200 8N1 观察 `[PyOH]` 日志。

> 注：小鸿官方文档同时出现 `vendor/atomgit/xiaohong/samples` 静态库和 `xiaohong/src/samples` 直接编译两种示例集成方式；必须根据 **当前检出的分支** 选择其一。生成工程仅提供源码和构建示例，不声称无改动即可跨分支构建。

## 不在 P1 范围

- 浏览器内自动固件编译和烧录（需要完整官方 SDK / 特权设备访问）。
- WS63 GPIO、ADC、PWM、显示、CI1302 指令、SLE/Wi-Fi 等（需锁定 SDK commit、核验引脚映射及 HAL API，再提供运行及硬件测试）。
- 已烧录固件上的双向指令协议 / OTA / HIL；当前串口不发送任何烧录操作。

## 接下来的硬件实测清单

- [ ] 确认小鸿开发板硬件版号、WS63 SDK/manifest commit。
- [ ] 验证 vendor 目录的真实 `BUILD.gn` 路径与 include_dirs。
- [ ] 在 Ubuntu 22.04 + SDK 完成 `hb build -f`（需报告具体 bin 和编译日志）。
- [ ] 使用 CH341 串口实物检查心跳输出、重复开机、断连重连。
- [ ] 基于 PCB/SCH 和 HAL 源码建立 GPIO/PWM/CI1302 映射与电平安全约束，再添加专用积木。
