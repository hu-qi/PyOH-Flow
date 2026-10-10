import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const result=spawnSync('cargo',['build','--release','--target','wasm32-unknown-unknown','-p','flow-wasm'],{cwd:root,stdio:'inherit'});
if(result.status!==0){console.error('Rust WASM build failed. Install Rust and rustup target add wasm32-unknown-unknown');process.exit(result.status??1)}
const output=resolve(root,'src/core/generated');mkdirSync(output,{recursive:true});
copyFileSync(resolve(root,'target/wasm32-unknown-unknown/release/flow_wasm.wasm'),resolve(output,'flow_wasm.wasm'));
console.log('Rust Flow Core WASM ready.');
