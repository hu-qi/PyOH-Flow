#!/usr/bin/env python3
"""Validate logs captured from serial output; no synthetic pass status."""
import argparse
import pathlib
import sys

def verify(log: str, require_gpio: bool) -> list[str]:
    required = ["[RustWS63] BOOT", "[RustWS63] RTOS:PASS", "[RustWS63] DONE", "[RustWS63] EXIT=0"]
    errors = [f"missing {key}" for key in required if key not in log]
    if require_gpio:
        if "[RustWS63] GPIO:PASS" not in log:
            errors.append("GPIO was not proven; explicitly assign a safe input pin and retest")
    elif "[RustWS63] GPIO:PASS" not in log and "[RustWS63] GPIO:SKIPPED" not in log:
        errors.append("GPIO status missing")
    if "[RustWS63] RTOS:FAIL" in log or "[RustWS63] GPIO:FAIL" in log or "THREAD_CREATE:FAIL" in log:
        errors.append("runtime reported failure")
    return errors

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("log", type=pathlib.Path)
    parser.add_argument("--mode", choices=["host", "board"], default="board")
    parser.add_argument("--require-gpio", action="store_true")
    args = parser.parse_args()
    content = args.log.read_text(errors="replace")
    problems = verify(content, args.require_gpio)
    if args.mode == "host" and "[RustWS63] HOST_MOCK:PASS" not in content:
        problems.append("host mock did not finish")
    if problems:
        print("FAIL:", "; ".join(problems), file=sys.stderr)
        sys.exit(1)
    print(f"PASS: {args.mode} serial markers; GPIO={'required' if args.require_gpio else 'optional'}")
