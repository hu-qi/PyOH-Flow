# WS63 first-generation Rust `no_std` × official OpenHarmony integration POC

**Scope and evidence classification:** `cargo test`, RISC-V archive build, and host C-ABI/RTOS mock are automated. These are **NOT** evidence that the exact SDK links, `hb build -f` succeeds, or real hardware executes. The latter steps require the official complete SDK and a connected first-generation WS63. Do not publish a hardware PASS without a capture from that board.

## 0. Official sources and versions

- Board/project: https://xiaohong.atomgit.com/
- SDK: https://atomgit.com/xiaohong-ai/vendor_atomgit
- Manifest: https://atomgit.com/xiaohong-ai/manifest
- First-party instructions: https://xiaohong.atomgit.com/docs-en.html (00 HelloWorld, 01 Timer, 02 Delay and FAQ). The FAQ specifies `riscv32-linux-musl-gcc` under `device/soc/hisilicon/ws63v100/sdkv106/tools/bin/compiler/riscv/cc_riscv32_musl_105/cc_riscv32_musl/bin`.

Lock the exact manifest commit and SDK compiler version in your lab record. The Rust target **`riscv32imac-unknown-none-elf` is a tentative RV32 IMAC soft-float ABI candidate**, not a vendor-certified match. This sample avoids `std`, heap allocation, unwinding, Rust MMIO and direct interrupt handlers. C exclusively owns system initialization and thread creation.

## 1. Build and test Rust archive on Linux

```bash
rustup target add riscv32imac-unknown-none-elf
cargo test --workspace
cargo build --release --target riscv32imac-unknown-none-elf -p ws63-native
python3 scripts/verify-ws63-abi.py target/riscv32imac-unknown-none-elf/release/libws63_native.a
bash scripts/test-ws63-host.sh
```

The last command links the real Rust native archive to C with **mocked CMSIS symbols on the host**. It only checks C ABI and task calls, not WS63 timing/drivers. Python unit tests: `python3 -m unittest discover -s tests -p test_ws63_log.py`.

## 2. Prepare official SDK checkout (separate machine)

```bash
mkdir -p "$HOME/xiaohong" && cd "$HOME/xiaohong"
repo init -u https://atomgit.com/xiaohong-ai/manifest
repo sync -c
# Record compiler version and arch:
SDK_CC="$PWD/device/soc/hisilicon/ws63v100/sdkv106/tools/bin/compiler/riscv/cc_riscv32_musl_105/cc_riscv32_musl/bin/riscv32-linux-musl-gcc"
"$SDK_CC" -v
"$SDK_CC" -Q --help=target | grep -E '(march|mabi)' || true
```

Compare an SDK GCC probe with the Rust ELF archive **before linking**:

```bash
python3 /path/to/PyOH-Flow/scripts/verify-ws63-abi.py \
 /path/to/PyOH-Flow/target/riscv32imac-unknown-none-elf/release/libws63_native.a \
 --sdk-cc "$SDK_CC"
```

**STOP** when the target ISA, `-mabi`, relocation model, multilib, FPU and link map differ. ELF soft-float agreement does NOT prove all of these. The SDK uses a vendor linker script; **do not replace it with a guessed Rust memory.x, stack pointer, `_start`, reset vector, or panic unwind runtime**.

## 3. GN/CMake integration points (SDK-specific final linkage pending validation)

1. Copy `targets/xiaohong-ws63/rust-poc/{BUILD.gn,poc_bridge.c}` to `vendor/atomgit/xiaohong/samples/pyoh_rust_poc/`.
2. `vendor/atomgit/xiaohong/BUILD.gn`: its `group("xiaohong")` must depend on `"samples:app"`.
3. `vendor/atomgit/xiaohong/samples/BUILD.gn`: add `"pyoh_rust_poc:pyoh_rust_poc"` to `lite_component("app")` features.
4. `device/soc/hisilicon/ws63v100/sdkv106/build/config/target_config/ws63/config.py`: register `"pyoh_rust_poc"` in the `ws63-liteos-app` `ram_component`.
5. `device/soc/hisilicon/ws63v100/sdkv106/libs_url/ws63/cmake/ohos.cmake`: register `"pyoh_rust_poc"` in `COMPONENT_LIST` of `ws63-liteos-app`.
6. **Mandatory**: arrange for `libws63_native.a` to participate in the final **CMake SDK link**, not just the GN static_library compile. Inspect the exact SDK linker action, library search paths, archive scan order, and `-Wl,-Map=` output. A GN static_library `ldflags` does not by itself prove final inclusion. Do not merge an unvalidated global SDK CMake patch. Add the Rust archive as a separate component using the SDK's own component mechanism, or its explicit CMake final-target link action after verifying against your version. `pyoh_ws63_rust_entry` must be resolved from the **Rust** archive, not by a stub.
7. Run `hb set` (mini, xiaohong), then `hb build -f`; check build exit status and image: `out/xiaohong/xiaohong/ws63-liteos-app/ws63-liteos-app-all.fwpkg` (confirm exact output against your SDK version).
8. Compare final ELF map: the Rust `pyoh_ws63_rust_entry`, C `pyoh_ws63_log/sleep_ms/gpio_probe`, `PyOHRustStart` registration and RTOS calls must be retained. If the `.a` is discarded due to `--gc-sections` or link order, the serial test will fail even if the build reports success.

## 4. Real device test

- First-generation XiaoHong AI WS63, stable USB power, CH341 UART (115200 8N1), safe board backup and recovery firmware.
- Burn *only the final official-generated `.fwpkg`* with the official BurnTool / board-specific burn script. Never flash the raw Rust `.a`.
- Reset device, capture UART output **from the physical board** to a file (do not paste expected strings as actual log):

```bash
python3 scripts/verify-ws63-log.py ws63-real-board.log --mode board
```

Expected patterns: `[RustWS63] BOOT`, `RTOS:PASS`, `GPIO:SKIPPED` (default), `DONE`, `EXIT=0`. To **verify the GPIO driver**, first select a schematic-confirmed free GPIO input pin and compile the C bridge with `PYOH_WS63_GPIO_READ_PIN=<pin>` and SDK `gpio.h` / `pinctrl.h` includes; this read probe changes the pin mux/direction, so no LCD/SPI/Flash/voice pins are permitted. Then validate using `--require-gpio`, check a logic analyzer / external level change, and attach a board photo / pin map. A GPIO:PASS marker proves driver calls returned valid levels, not electrical signal correctness on its own.

## Failures to report

- `riscv32-linux-musl-gcc not found`: SDK and compiler are not installed; fix PATH as described in the FAQ.
- ABI mismatch in readelf flags: do not link or flash; adjust target triple/`-C target-feature`/ABI after obtaining compiler flags, not by guessing.
- `undefined reference to pyoh_ws63_rust_entry`: the Rust archive was **not linked into the final SDK image**; inspect CMake COMPONENT_LIST and archive scan order.
- RISC-V relocation errors: inspect linker script, object model, PIE/PIC config, and relaxations before changing Rust flags.
- `RTOS:FAIL`: inspect CMSIS tick frequency, threading context, and `osDelay` return value.
- `GPIO:SKIPPED`: GPIO is not verified. This is intentional until a free pin is confirmed.
- `BOOT` missing on device: investigate APP_FEATURE_INIT reachability, linker garbage collection and UART wiring.
