#!/usr/bin/env python3
"""Capture *real* WS63 UART bytes; no flash, no simulated log insertion.

Requires: pip install pyserial
"""
import argparse
import pathlib
import sys
import time

from importlib.util import find_spec


def capture(port: str, duration: float, out: pathlib.Path) -> None:
    if find_spec('serial') is None:
        raise RuntimeError('Install pyserial first: python -m pip install pyserial')
    import serial

    out.parent.mkdir(parents=True, exist_ok=True)
    print(f'Capturing {port} at 115200 8N1 for {duration:g}s. Reset the board NOW.', flush=True)
    with serial.Serial(port, baudrate=115200, bytesize=8, parity='N', stopbits=1,
                       timeout=0.25, write_timeout=1) as reader, out.open('wb') as f:
        end = time.monotonic() + duration
        while time.monotonic() < end:
            data = reader.read(1024)
            if data:
                f.write(data)
                f.flush()
                sys.stdout.write(data.decode('utf-8', errors='replace'))
                sys.stdout.flush()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Capture actual WS63 CH341 UART bytes')
    parser.add_argument('--port', required=True, help='e.g. /dev/ttyUSB0 or COM3')
    parser.add_argument('--seconds', type=float, default=20.0)
    parser.add_argument('--output', type=pathlib.Path, default=pathlib.Path('ws63-real-board.log'))
    args = parser.parse_args()
    if not 2 <= args.seconds <= 300:
        parser.error('--seconds must be between 2 and 300')
    try:
        capture(args.port, args.seconds, args.output)
    except (OSError, RuntimeError) as e:
        sys.exit(f'Capture failed: {e}')
    print(f'\nUART bytes captured in {args.output}; run verify-ws63-log.py to classify the result')
