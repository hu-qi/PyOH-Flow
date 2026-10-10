use flow_ir::Program;
use std::{env,fs,io::{self,Read,Write},path::PathBuf,process};
fn main() {
    if let Err(error)=run(){eprintln!("{error}"); process::exit(2)}
}
fn run()->Result<(),String>{
    let args:Vec<String>=env::args().skip(1).collect();
    let usage="Usage: flow-cli <validate|generate|bundle> <file.json|-> [output.c|directory]\n  validate: checks IR schema and semantics\n  generate: outputs WS63 C to stdout or output.c\n  bundle: writes pyoh_flow.c + BUILD.gn + project.flow.json to directory";
    if args.len()<2 || args.len()>3 {return Err(usage.into())}
    let input=if args[1]=="-" {
        let mut s=String::new();io::stdin().read_to_string(&mut s).map_err(|e|e.to_string())?;s
    }else{fs::read_to_string(&args[1]).map_err(|e|e.to_string())?};
    if input.len()>1_000_000 {return Err("IR exceeds 1 MB".into())}
    let p:Program=serde_json::from_str(&input).map_err(|e|format!("Invalid Flow IR: {e}"))?;
    let diagnose=|ds:Vec<flow_core::Diagnostic>| ds.iter().map(|d|format!("{} [{}]: {}",d.code,d.source_id,d.message)).collect::<Vec<_>>().join("\n");
    match args[0].as_str(){
        "validate" =>{flow_core::validate(&p).map_err(diagnose)?;println!("Flow IR v{} OK",p.schema_version);}
        "generate" =>{
            let c=flow_codegen_c::generate(&p).map_err(diagnose)?;
            if let Some(path)=args.get(2){fs::write(path,c).map_err(|e|e.to_string())?}else{print!("{c}");}
        }
        "bundle" =>{
            let c=flow_codegen_c::generate(&p).map_err(diagnose)?;
            let dest=PathBuf::from(args.get(2).ok_or("bundle requires output directory")?);
            fs::create_dir_all(&dest).map_err(|e|e.to_string())?;
            for (name,content) in [("pyoh_flow.c",c),("BUILD.gn",flow_codegen_c::BUILD_GN.into()),("project.flow.json",serde_json::to_string_pretty(&p).map_err(|e|e.to_string())?)] {
                let file=dest.join(name);
                fs::File::create(file).and_then(|mut f| f.write_all(content.as_bytes())).map_err(|e|e.to_string())?;
            }
        }
        _=>return Err(usage.into()),
    }
    Ok(())
}
