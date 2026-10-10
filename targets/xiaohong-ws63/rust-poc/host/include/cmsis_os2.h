#ifndef PYOH_TEST_CMSIS_OS2_H
#define PYOH_TEST_CMSIS_OS2_H
#include <stdint.h>
#include <stddef.h>
typedef enum { osOK=0, osError= -1 } osStatus_t;
typedef enum { osPriorityNormal=24 } osPriority_t;
typedef struct {
    const char *name;
    uint32_t attr_bits;
    void *cb_mem;
    uint32_t cb_size;
    void *stack_mem;
    uint32_t stack_size;
    osPriority_t priority;
    uint32_t tz_module;
    uint32_t reserved;
} osThreadAttr_t;
typedef void (*osThreadFunc_t)(void *argument);
void *osThreadNew(osThreadFunc_t func, void *argument, const osThreadAttr_t *attr);
uint32_t osKernelGetTickFreq(void);
osStatus_t osDelay(uint32_t ticks);
#endif
