#ifndef PYOH_TEST_OHOS_INIT_H
#define PYOH_TEST_OHOS_INIT_H
/* Host-only simulation: explicitly not the official SDK registration macro. */
#define APP_FEATURE_INIT(fn) void pyoh_host_boot(void) { fn(); }
#endif
