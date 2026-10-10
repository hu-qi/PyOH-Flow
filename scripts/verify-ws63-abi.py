#!/usr/bin/env python3
"""Read-only ABI gate: reject uncertain RISC-V link compatibility before hb build."""
import argparse
import pathlib
import re
import subprocess
import sys

def cmd(*args):
    return subprocess.run(list(map(str, args)), text=True, capture_output=True, check=True).stdout

def check_archive(archive: pathlib.Path):
    if not archive.is_file(): raise ValueError(f"Missing Rust archive: {archive}")
    details=cmd("readelf", "-h", archive)
    if "RISC-V" not in details or "ELF32" not in details:
        raise ValueError("Rust archive members must be 32-bit RISC-V ELF")
    flags=re.findall(r"Flags:\s*[^\n]*", details)
    if not flags: raise ValueError("No ELF flags: cannot validate float ABI")
    bad=[f for f in flags if "soft-float ABI" not in f and "Flags: 0x0" not in f]
    if bad: raise ValueError(f"Unexpected Rust object ABI flags: {bad[:2]}")
    symbols=cmd("nm", "--defined-only", archive)
    if "pyoh_ws63_rust_entry" not in symbols:
        raise ValueError("Rust entry symbol missing from archive")
    return flags[:2]

def check_sdk_compiler(compiler: pathlib.Path, archive: pathlib.Path):
    if not compiler.is_file(): raise ValueError(f"Missing SDK compiler: {compiler}")
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        obj=pathlib.Path(d)/"probe.o"
        subprocess.run([str(compiler),"-c","-x","c","-o",str(obj),"-"],input="void sdk_abi_probe(void) {}\n",text=True,check=True)
        rust=cmd("readelf","-h",archive)
        gcc=cmd("readelf","-h",obj)
        def flag(v):
            found=re.search(r"Flags:\s*([^\n]*)",v)
            if not found: raise ValueError("Missing ABI ELF flags")
            value=found.group(1)
            if "double-float ABI" in value: return "double"
            if "single-float ABI" in value: return "single"
            if "soft-float ABI" in value or value.startswith("0x0"): return "soft"
            raise ValueError(f"Unknown ABI flag: {value}")
        if flag(rust)!=flag(gcc): raise ValueError(f"SDK float ABI {flag(gcc)} != Rust {flag(rust)}; DO NOT LINK")
        if "RISC-V" not in gcc or "ELF32" not in gcc: raise ValueError("SDK compiler target is not ELF32 RISC-V")
        # Exact ISA must be inspected from compiler -march/-mabi and linker map.
        return flag(gcc)

if __name__=="__main__":
    a=argparse.ArgumentParser()
    a.add_argument("archive",type=pathlib.Path)
    a.add_argument("--sdk-cc",type=pathlib.Path,help="Path to riscv32-linux-musl-gcc in the synced SDK")
    args=a.parse_args()
    try:
        fl=check_archive(args.archive)
        print("PASS: Rust object ELF32 RISC-V and expected soft-float flags:",fl)
        if args.sdk_cc:
            abi=check_sdk_compiler(args.sdk_cc,args.archive)
            print(f"PASS: SDK GCC and Rust float calling convention agree ({abi}).")
            print("NOTE: inspect -march/-mabi and complete GN/CMake linker map before claiming SDK link success")
        else:
            print("UNVERIFIED: SDK GCC object ABI was not compared; provide --sdk-cc")
    except (subprocess.CalledProcessError, OSError, ValueError) as error:
        print(f"FAIL: {error}",file=sys.stderr); sys.exit(1)
