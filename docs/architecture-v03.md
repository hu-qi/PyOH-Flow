# XiaoHong Flow v0.3 — Rust First / Flow IR v1

## Architecture

`Blockly JSON` → `src/core/flow-ir.ts` (strict adapter) → **versioned Flow IR** → `flow-wasm` → `flow-core` (semantic and type checks) → `flow-codegen-c` → `WS63 C + GN`.

`flow-cli` compiles the **same** Flow IR with **the same** Rust crates on a developer's machine or CI runner. No MicroPython imports, Python runtime or TypeScript interpreter are required on the WS63.

### Repository layout

- `crates/flow-ir`: language independent serde schema (`docs/flow-ir-v1.json`).
- `crates/flow-core`: type checker, diagnostics, size/depth limits, unsupported constructs fail closed.
- `crates/flow-codegen-c`: first-generation XiaoHong WS63 C + CMSIS-RTOS2 generator.
- `crates/flow-wasm`: dependency-light, manually documented C ABI; compiled `wasm32-unknown-unknown` and loaded directly by the Vite frontend.
- `crates/flow-cli`: validate, generate, bundle operations.
- `src/core/flow-ir.ts`: migration adapter from Blockly's serialized workspace to Flow IR.
- `src/core/flow-wasm.ts`: browser memory bridge with version handshake and explicit freeing of input memory.

### Commands

Requires stable Rust + wasm32 target, Node 20+:

```bash
rustup target add wasm32-unknown-unknown
cargo test --workspace
cargo run -p flow-cli -- validate docs/flow-ir-v1.json
cargo run -p flow-cli -- generate docs/flow-ir-v1.json /tmp/pyoh_flow.c
cargo run -p flow-cli -- bundle docs/flow-ir-v1.json /tmp/flow-bundle
npm install
npm run dev
```

`npm run dev` builds the Rust WASM, then starts Vite. `npm run build` also builds the real Rust WASM binary and embeds it in Vite assets; no manual copy and no JS implementation fallback. Rust compiler failure fails the build.

### Compatibility and boundaries

- Existing `.pyoh.json` projects and generic MicroPython ESP32/Pico editing are preserved. They are *legacy backends*, not WS63 runtimes.
- WS63 C firmware is emitted by the Rust core, not the v0.2 TypeScript C generator. The TypeScript generator is retained temporarily for regression/reference only.
- Existing generated `BUILD.gn` is an integration template. Must be reviewed against the checked-out vendor/sdk revision before calling `hb build -f`.
- Rust is currently the **host compiler and WASM core**, **not yet validated as a WS63 no_std firmware**. The latter requires the next-phase Rust-vs-SDK ABI POC, linker compatibility, real board programming, UART logs and peripheral verification.
- Python/TypeScript remain supported in the existing host/browsers and generic device mode; v0.3 does not claim WS63 native Python or TypeScript runtimes.
- This version limits the IR to the validated C features. No simulated GPIO/ADC/CI1302 APIs are generated.

### Flow IR validation

Top-level `schema_version: 1`, `target: xiaohong_ws63` and `body`. Each statement includes an originating Blockly `source_id` so diagnostics map back to the editor. The Rust checker enforces typed expressions, nonzero literal division, repeat/latency limits, maximum nesting and source IDs. Unknown Blockly blocks, orphan blocks and incomplete sockets fail instead of disappearing.

### WASM ABI

Exports `memory`, `flow_schema_version`, `flow_alloc`, `flow_dealloc`, `flow_compile_json`, `flow_output_len`. JS encodes JSON UTF-8, allocates and copies a contiguous input, invokes synchronous compile, copies output *before* deallocating input, then decodes `{"ok":true,"code":"..."}` or `{"ok":false,"diagnostics":[...]}`. The response pointer lives until the next call; the bridge handles compilation sequentially. The WebAssembly instance itself performs no network access.
