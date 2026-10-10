#![no_std]
//! WS63 Rust firmware POC. The C SDK owns startup/RTOS/driver initialization.
//! All symbols use the C ABI; no allocation, unwinding, std or direct MMIO.

#[cfg(test)]
extern crate std;

unsafe extern "C" {
    fn pyoh_ws63_log(ptr: *const u8, len: usize) -> i32;
    fn pyoh_ws63_sleep_ms(milliseconds: u32) -> i32;
    fn pyoh_ws63_gpio_probe() -> i32;
}

fn log(text: &str) {
    // Stable utf8 bytes, valid throughout the synchronous C call.
    let _ = unsafe { pyoh_ws63_log(text.as_ptr(), text.len()) };
}

/// Called by an RTOS thread created from the SDK's APP_FEATURE_INIT C entry.
/// Returns 0 on success; -2 means GPIO is deliberately disabled, not a failure.
#[unsafe(no_mangle)]
pub extern "C" fn pyoh_ws63_rust_entry() -> i32 {
    log("[RustWS63] BOOT\r\n");
    for _ in 0..3 {
        if unsafe { pyoh_ws63_sleep_ms(100) } != 0 {
            log("[RustWS63] RTOS:FAIL\r\n");
            return -1;
        }
    }
    log("[RustWS63] RTOS:PASS\r\n");
    let gpio = unsafe { pyoh_ws63_gpio_probe() };
    match gpio {
        0 => log("[RustWS63] GPIO:PASS\r\n"),
        -2 => log("[RustWS63] GPIO:SKIPPED\r\n"),
        _ => {
            log("[RustWS63] GPIO:FAIL\r\n");
            return gpio;
        }
    }
    log("[RustWS63] DONE\r\n");
    0
}

#[cfg(not(test))]
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo<'_>) -> ! {
    // Fail-stop: never unwind across C/RTOS frames.
    loop { core::hint::spin_loop(); }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    static TICKS: AtomicUsize = AtomicUsize::new(0);
    static LOGS: AtomicUsize = AtomicUsize::new(0);

    #[unsafe(no_mangle)]
    extern "C" fn pyoh_ws63_log(_ptr: *const u8, len: usize) -> i32 {
        assert!(len > 0); LOGS.fetch_add(1, Ordering::Relaxed); 0
    }
    #[unsafe(no_mangle)]
    extern "C" fn pyoh_ws63_sleep_ms(ms: u32) -> i32 {
        assert_eq!(ms, 100); TICKS.fetch_add(1, Ordering::Relaxed); 0
    }
    #[unsafe(no_mangle)]
    extern "C" fn pyoh_ws63_gpio_probe() -> i32 { -2 }
    #[test]
    fn reaches_rtos_and_skips_unconfigured_gpio() {
        TICKS.store(0, Ordering::Relaxed); LOGS.store(0, Ordering::Relaxed);
        assert_eq!(pyoh_ws63_rust_entry(), 0);
        assert_eq!(TICKS.load(Ordering::Relaxed), 3);
        assert_eq!(LOGS.load(Ordering::Relaxed), 4);
    }
}
