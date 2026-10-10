#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v cargo >/dev/null || { echo 'ERROR: Rust cargo is required' >&2; exit 2; }
command -v cc >/dev/null || { echo 'ERROR: C compiler required' >&2; exit 2; }
cargo build --release -p ws63-native
mkdir -p target/ws63-host-test
cc -std=c11 -Wall -Wextra -Werror -I targets/xiaohong-ws63/rust-poc/host/include \
  targets/xiaohong-ws63/rust-poc/poc_bridge.c \
  targets/xiaohong-ws63/rust-poc/host/host_main.c \
  target/release/libws63_native.a -ldl -lpthread -lm -o target/ws63-host-test/poc
./target/ws63-host-test/poc | tee target/ws63-host-test/output.log
python3 scripts/verify-ws63-log.py target/ws63-host-test/output.log --mode host
