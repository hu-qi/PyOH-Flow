/* SPDX-License-Identifier: MIT */
/* Official OpenHarmony owns APP_FEATURE_INIT and RTOS task lifecycle. */
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <limits.h>
#include "ohos_init.h"
#include "cmsis_os2.h"

/* This has exactly one definition in the Rust static archive. */
extern int32_t pyoh_ws63_rust_entry(void);

int32_t pyoh_ws63_log(const uint8_t *data, size_t length)
{
    if (data == NULL || length > (size_t)INT_MAX) { return -1; }
    /* A fixed size print avoids reliance on a NUL-terminated Rust string. */
    return printf("%.*s", (int)length, (const char *)data) < 0 ? -1 : 0;
}

int32_t pyoh_ws63_sleep_ms(uint32_t milliseconds)
{
    const uint32_t ticks_per_second = osKernelGetTickFreq();
    if (ticks_per_second == 0U) { return -1; }
    uint64_t ticks = ((uint64_t)milliseconds * ticks_per_second + 999U) / 1000U;
    if (ticks == 0U) { ticks = 1U; }
    if (ticks > UINT32_MAX) { return -1; }
    return osDelay((uint32_t)ticks) == osOK ? 0 : -1;
}

#ifdef PYOH_WS63_GPIO_READ_PIN
#include "gpio.h"
#include "pinctrl.h"
/* This is an opt-in INPUT ONLY probe. The pin must be cleared for use with
   the exact board schematic: never repurpose the shared LCD/Flash SPI pins. */
int32_t pyoh_ws63_gpio_probe(void)
{
    const pin_t pin = (pin_t)PYOH_WS63_GPIO_READ_PIN;
    uapi_gpio_init();
    if (uapi_pin_set_mode(pin, 0) != 0) { return -3; }
    if (uapi_gpio_set_dir(pin, GPIO_DIRECTION_INPUT) != 0) { return -4; }
    const gpio_level_t level = uapi_gpio_get_val(pin);
    return (level == GPIO_LEVEL_LOW || level == GPIO_LEVEL_HIGH) ? 0 : -5;
}
#else
int32_t pyoh_ws63_gpio_probe(void) { return -2; }
#endif

static void PyOHRustThread(void *arg)
{
    (void)arg;
    const int32_t result = pyoh_ws63_rust_entry();
    printf("[RustWS63] EXIT=%ld\r\n", (long)result);
}
static void PyOHRustStart(void)
{
    const osThreadAttr_t attr = {
        .name = "pyoh_rust_poc",
        .stack_size = 0x2000,
        .priority = osPriorityNormal,
    };
    if (osThreadNew(PyOHRustThread, NULL, &attr) == NULL) {
        printf("[RustWS63] THREAD_CREATE:FAIL\r\n");
    }
}
APP_FEATURE_INIT(PyOHRustStart);
