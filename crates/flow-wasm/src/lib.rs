//! Minimal wasm32 C ABI: no JS glue generator or runtime network dependencies.
//! Rust owns allocation; the JS bridge must release inputs after a call.
use flow_ir::Program;
use std::{cell::RefCell,mem,ptr};
thread_local! {static RESPONSE: RefCell<Vec<u8>> = const {RefCell::new(Vec::new())};}
const MAX_INPUT: usize=1_000_000;
#[no_mangle]
pub extern "C" fn flow_schema_version() -> u32 {flow_ir::SCHEMA_VERSION}

#[no_mangle]
pub extern "C" fn flow_alloc(len: usize) -> *mut u8 {
    if len==0 || len>MAX_INPUT {return ptr::null_mut()}
    let mut boxed=vec![0u8;len].into_boxed_slice();
    let ptr=boxed.as_mut_ptr();
    mem::forget(boxed);
    ptr
}
#[no_mangle]
pub unsafe extern "C" fn flow_dealloc(ptr:*mut u8,len:usize){
    if !ptr.is_null() && len>0 && len<=MAX_INPUT {
        drop(Box::from_raw(ptr::slice_from_raw_parts_mut(ptr,len)));
    }
}
fn compile(raw:&[u8])->String {
    match serde_json::from_slice::<Program>(raw) {
        Ok(program) => match flow_codegen_c::generate(&program){
            Ok(code)=>serde_json::json!({"ok":true,"code":code}).to_string(),
            Err(diagnostics)=>serde_json::json!({"ok":false,"diagnostics":diagnostics}).to_string(),
        },
        Err(e)=>serde_json::json!({"ok":false,"diagnostics":[{"code":"INVALID_IR","source_id":"","message":e.to_string()}]}).to_string()
    }
}
#[no_mangle]
pub unsafe extern "C" fn flow_compile_json(ptr:*const u8,len:usize) -> *const u8 {
    if ptr.is_null() || len==0 || len>MAX_INPUT {return ptr::null()}
    let out=compile(std::slice::from_raw_parts(ptr,len));
    RESPONSE.with(|response|{
        let mut buffer=response.borrow_mut();
        *buffer=out.into_bytes();
        buffer.as_ptr()
    })
}
#[no_mangle]
pub extern "C" fn flow_output_len()->usize {RESPONSE.with(|response|response.borrow().len())}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn rejects_invalid_json(){assert!(compile(b"not json").contains("INVALID_IR"));}
}
