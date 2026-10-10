#include <stdint.h>
#include <stdio.h>
#include "cmsis_os2.h"
extern void pyoh_host_boot(void);
static uint32_t fake_ticks = 0;
uint32_t osKernelGetTickFreq(void) { return 1000U; }
osStatus_t osDelay(uint32_t ticks) { fake_ticks += ticks; return osOK; }
void *osThreadNew(osThreadFunc_t fn, void *arg, const osThreadAttr_t *attr) {
    if (fn == NULL || attr == NULL || attr->stack_size < 4096U) { return NULL; }
    fn(arg);
    return (void *)attr;
}
int main(void) {
    pyoh_host_boot();
    if (fake_ticks != 300U) { fprintf(stderr, "unexpected tick count %u\n", fake_ticks); return 1; }
    printf("[RustWS63] HOST_MOCK:PASS\n");
    return 0;
}
