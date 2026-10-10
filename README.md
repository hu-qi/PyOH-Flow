# PyOH-Flow

**面向第一代小鸿 AI / WS63 的 Rust First 可视化嵌入式开发工作台。** 采用 Rust Workspace + Flow IR v1 + WebAssembly + Blockly / React / TypeScript，以 Rust Core 统一校验与生成 WS63 OpenHarmony C 工程，同时保留 MicroPython 兼容模式。界面交互参考 [flow.qilinbo.cn](https://flow.qilinbo.cn/)（非其源码移植，不包含第三方品牌资源）。

> [!IMPORTANT]
> 当前版本 **v0.3.0 已完成 Rust Core + Flow IR v1 浏览器集成，仍不是完成硬件适配或已验证的实体板烧录版本**。硬件协议、设备兼容性及机器人狗等专用拓展需要具体 SDK 和实物联调。MicroPython 并不等价于 OpenHarmony 标准系统的 Python。

## 小鸿 AI / WS63 (OpenHarmony) —— Rust Core v0.3（v0.2 C 兼容输出保留）

- 支持 **小鸿 AI WS63 / OpenHarmony** 板型，项目菜单可创建串口心跳示例。
- Blockly → Flow IR → **Rust WASM → C / CMSIS-RTOS2 + APP_FEATURE_INIT** 生成器，支持日志打印、毫秒延时、循环、条件和基础逻辑/算术。
- 可导出包含 `pyoh_flow.c`、`BUILD.gn`、`INTEGRATION.md`、项目 JSON 的 ZIP，用官方 manifest / GN / `hb build -f` 集成和编译。
- **故障安全**：未适配的 MicroPython GPIO/ADC/PWM 等积木不允许生成可烧录产物，自动提示不兼容类型；小鸿板不能运行 `.py` REPL。
- 串口仅观察 WS63 启动日志（115200）；不支持在网页内直接烧录。

见 [小鸿完整集成与实测清单](docs/xiaohong-ws63.md)。

## 已实现

- Blockly 积木编辑器：事件、控制、运算、系统、变量、自制积木（函数）、GPIO、I2C、UART、ADC、PWM、LED、蜂鸣器；支持拖拽、嵌套、缩放、撤销/重做。
- Python 代码：基于官方 Python generator，针对自定义硬件积木生成 `machine` / `time` API 调用；目标配置为通用 MicroPython、ESP32、Raspberry Pi Pico。
- 项目：多项目切换、重命名、本地自动保存、JSON 导入导出、示例项目、Python 下载、Markdown 项目文档导出。
- 设备：Web Serial 连接/断开与串口日志；仅 **MicroPython 板型**支持 raw REPL 执行及 Ctrl-C。小鸿模式只监视日志，不向设备发送代码。
- AI：本地积木说明、`/doc`、`/explain`、`/code`、`/new`、`/clear`；后端代理 OpenAI-compatible chat completions，密钥只保存在服务器环境变量中。
- 工程质量：TypeScript 严格模式、Vitest、GitHub Actions 测试和构建、基础安全限制。

## 开始开发

需要 Node.js **>= 20**、Rust stable，安装 WASM 目标：`rustup target add wasm32-unknown-unknown`。

```bash
npm install
npm run dev
```

`npm run dev` 将先构建 Rust WASM，然后打开 Vite 输出的本地地址（一般是 http://localhost:5173）。无需配置 AI 即可使用积木编辑器、项目管理、代码导出、串口控制与本地命令。

### 连接在线 AI

另开终端，将 `.env.example` 中的参数配置为真实值，**以服务端环境变量注入**（示例为 POSIX Shell）：

```bash
export AI_BASE_URL='https://YOUR_API_HOST/v1'
export AI_API_KEY='YOUR_SECRET_KEY'
export AI_MODEL='YOUR_MODEL_NAME'
npm run api
```

前端开发服务器已代理 `/api` 至本机 `127.0.0.1:8787`。生产部署请为 `/api` 配置同源反向代理，浏览器不需要也不应看到 API Key。

### 构建与测试

```bash
npm run check
npm run build
npm run preview
```

## 用法

1. 左侧选择积木分类，将「当程序启动」和其它积木拖入工作区。
2. 工作区自动保存；在「项目」菜单中导出 `.pyoh.json` 或 `.py`。
3. 展开下方「Python 代码」预览生成的程序。
4. 使用 Chrome / Edge 在 **HTTPS / localhost** 通过「未连接」按钮选择串口；确认开发板运行 **MicroPython raw REPL** 后按「运行」。
5. 右侧 AI 助手可解释选中积木、检查代码（需配置 AI）与导出项目说明。

### 关于硬件兼容性

- Web Serial **不等于**任意 USB/设备驱动，浏览器、系统与 USB 转串口驱动均需支持。
- `运行` 会中断当前 MicroPython 程序，再进入 raw REPL 并执行临时代码；**不是**烧录固件，也**不是**持久写入 `main.py`。
- ADC/PWM/I2C/UART API 和引脚会因固件版本与硬件板型不同而变化。提供的通用示例以 MicroPython API 为基础，但不能保证每块板子直接运行。
- ESP32 和 Pico 配置仅实现基本代码分支；专用的 OpenHarmony 设备驱动、Hi3861/PyOH 固件、远程设备网关需要独立适配。
- 对外接 LED、蜂鸣器、电机要确保正确接线、限流和供电，避免超出引脚额定电流。

## 代码结构

```text
src/App.tsx                 页面、项目工作流、AI/串口 UI
src/components/Editor.tsx  Blockly 工作区
src/blockly/blocks.ts      自定义积木及语义说明
src/blockly/toolbox.ts     12 组积木工具箱
src/blockly/generator.ts   MicroPython 生成器
src/core/projects.ts       本地项目持久化与 JSON 校验
src/hardware/serial.ts     Web Serial + MicroPython raw REPL
src/targets/xiaohong.ts    WS63 C 生成器 + GN + 集成说明
src/targets/zip.ts         不依赖第三方库的 ZIP 导出
docs/xiaohong-ws63.md      官方 SDK 集成步骤与范围
server/index.mjs           AI 兼容接口代理
.github/workflows/ci.yml  CI 构建与单测
```

## 迭代路线

- **P1**：板卡 manifest 与引脚约束，Web Serial 可靠握手和 MicroPython REPL 状态机，工具栏可视化终端。
- **P2**：设备 firmware profile、代码静态校验、自动化硬件在环（HIL）测试、I2C/UART 复用资源管理。
- **P3**：安全的 AI 积木建议、经 Schema 验证的自定义拓展积木、积木/代码双向定位。
- **P4**：更多设备（OpenHarmony/Hi3861、机器人、显示屏）需要各自 SDK、固件和协议后接入。

## License

MIT. Blockly 属 Google 开源项目，请遵守其许可证；硬件固件及外部 API 另有各自许可。

## v0.3 Rust First — 第一代小鸿 WS63

本项目现以 **Rust Flow Core / Flow IR v1** 为小鸿 C 代码生成的唯一生产路径。浏览器通过原生 WebAssembly 运行与 Rust CLI 相同的校验和生成器；Blockly 不再直接拼接 WS63 C 代码，亦不依赖 MicroPython。原有 MicroPython 功能保留为兼容模式。

- 架构及 WASM ABI: [docs/architecture-v03.md](docs/architecture-v03.md)
- 示例 Flow IR: [docs/flow-ir-v1.json](docs/flow-ir-v1.json)
- 本地运行需要 Rust stable、`rustup target add wasm32-unknown-unknown` 和 Node.js 20+；`npm run dev` 会自动构建 Rust WASM。
- Rust CLI: `cargo run -p flow-cli -- generate docs/flow-ir-v1.json`，设备 C 工程：`cargo run -p flow-cli -- bundle docs/flow-ir-v1.json ./out-bundle`。
- **状态界限**：WS63 输出为 C/GN SDK 集成工程；设备端 Rust `no_std`、烧录、外设及实物联调均尚未通过验证。
