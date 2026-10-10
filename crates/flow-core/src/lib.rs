//! Device-independent validation, source-traceable diagnostics and type checking.
use flow_ir::{BinaryOp, Expr, Program, Stmt, Target, SCHEMA_VERSION};
use serde::Serialize;
use std::collections::HashSet;

pub const MAX_DEPTH: usize = 40;
pub const MAX_STATEMENTS: usize = 10_000;
pub const MAX_TEXT_BYTES: usize = 4_096;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Diagnostic {
    pub code: &'static str,
    pub message: String,
    pub source_id: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Ty { Int, Bool }

struct Checker {
    diagnostics: Vec<Diagnostic>,
    statements: usize,
    ids: HashSet<String>,
}
impl Checker {
    fn err(&mut self, code: &'static str, source_id: &str, msg: impl Into<String>) {
        if self.diagnostics.len() < 100 {
            self.diagnostics.push(Diagnostic { code, message: msg.into(), source_id: source_id.to_owned() });
        }
    }
    fn expr(&mut self, expr: &Expr, source_id: &str, depth: usize) -> Option<Ty> {
        if depth > MAX_DEPTH { self.err("DEPTH_LIMIT",source_id,"表达式嵌套过深"); return None; }
        match expr {
            Expr::Int { .. } => Some(Ty::Int),
            Expr::Bool { .. } => Some(Ty::Bool),
            Expr::Not { value } => {
                if self.expr(value,source_id,depth+1)!=Some(Ty::Bool){self.err("TYPE_ERROR",source_id,"NOT 必须接受布尔值");}
                Some(Ty::Bool)
            }
            Expr::Binary { op, left, right } => {
                let a=self.expr(left,source_id,depth+1);
                let b=self.expr(right,source_id,depth+1);
                match op {
                    BinaryOp::Add|BinaryOp::Sub|BinaryOp::Mul|BinaryOp::Div => {
                        if a!=Some(Ty::Int)||b!=Some(Ty::Int){self.err("TYPE_ERROR",source_id,"算术运算两端必须为整数");}
                        if *op==BinaryOp::Div && !matches!(right.as_ref(),Expr::Int{value} if *value!=0) {
                            self.err("UNSAFE_DIVISOR",source_id,"除数必须为非零整数字面量（避免设备端除零）");
                        }
                        Some(Ty::Int)
                    }
                    BinaryOp::Eq|BinaryOp::Ne => {
                        if a.is_none()||a!=b{self.err("TYPE_ERROR",source_id,"相等比较两端的类型必须一致");}
                        Some(Ty::Bool)
                    }
                    BinaryOp::Lt|BinaryOp::Le|BinaryOp::Gt|BinaryOp::Ge => {
                        if a!=Some(Ty::Int)||b!=Some(Ty::Int){self.err("TYPE_ERROR",source_id,"大小比较两端必须为整数");}
                        Some(Ty::Bool)
                    }
                    BinaryOp::And|BinaryOp::Or => {
                        if a!=Some(Ty::Bool)||b!=Some(Ty::Bool){self.err("TYPE_ERROR",source_id,"逻辑运算两端必须为布尔值");}
                        Some(Ty::Bool)
                    }
                }
            }
        }
    }
    fn statements(&mut self, statements: &[Stmt], depth: usize) {
        if depth>MAX_DEPTH { self.err("DEPTH_LIMIT","","语句嵌套过深"); return; }
        for stmt in statements {
            self.statements+=1;
            if self.statements>MAX_STATEMENTS {self.err("SIZE_LIMIT",stmt.source_id(),"语句数量超出上限");return;}
            let id=stmt.source_id();
            if id.len()>256 || id.is_empty() {self.err("INVALID_SOURCE_ID",id,"积木 source_id 必须是 1～256 字节");}
            if !self.ids.insert(id.to_owned()) {self.err("DUPLICATE_SOURCE_ID",id,"重复的积木 ID");}
            match stmt {
                Stmt::Log{text,..} => {
                    if text.len()>MAX_TEXT_BYTES {self.err("TEXT_LIMIT",id,"日志文本超过 4096 字节");}
                    if text.contains('\0') {self.err("INVALID_TEXT",id,"日志文本不能包含 NUL 字符");}
                }
                Stmt::Sleep{millis,..} => {
                    if *millis==0 || *millis>3_600_000 {self.err("INVALID_DURATION",id,"延时范围必须为 1～3600000 毫秒");}
                }
                Stmt::Forever{body,..} => self.statements(body,depth+1),
                Stmt::Repeat{times,body,..} => {
                    if self.expr(times,id,0)!=Some(Ty::Int){self.err("TYPE_ERROR",id,"重复次数必须为整数");}
                    if let Expr::Int { value } = times {
                        if *value<0 || *value>100_000 {self.err("INVALID_COUNT",id,"重复次数必须在 0～100000 之间");}
                    }
                    self.statements(body,depth+1);
                }
                Stmt::If{branches,otherwise,..} => {
                    if branches.is_empty() {self.err("EMPTY_CONDITION",id,"条件积木没有分支");}
                    for branch in branches {
                        if self.expr(&branch.condition,id,0)!=Some(Ty::Bool){self.err("TYPE_ERROR",id,"条件表达式必须为布尔值");}
                        self.statements(&branch.body,depth+1);
                    }
                    self.statements(otherwise,depth+1);
                }
            }
        }
    }
}

pub fn validate(program: &Program) -> Result<(),Vec<Diagnostic>> {
    let mut checker=Checker { diagnostics:Vec::new(), statements:0, ids:HashSet::new() };
    if program.schema_version!=SCHEMA_VERSION {checker.err("SCHEMA_VERSION","",format!("需要 IR schema_version={SCHEMA_VERSION}"));}
    if program.target!=Target::XiaohongWs63 {checker.err("TARGET_UNSUPPORTED","","仅支持第一代小鸿 WS63");}
    checker.statements(&program.body,0);
    if checker.diagnostics.is_empty(){Ok(())}else{Err(checker.diagnostics)}
}

#[cfg(test)]
mod tests {
    use super::*;
    use flow_ir::{IfBranch, Target};
    fn program(body: Vec<Stmt>)->Program {Program {schema_version:1,target:Target::XiaohongWs63,body}}
    #[test] fn valid_basics() {assert!(validate(&program(vec![Stmt::Sleep{source_id:"1".into(),millis:100},Stmt::Log{source_id:"2".into(),text:"hello".into()}])).is_ok());}
    #[test] fn rejected_duration() {let p=program(vec![Stmt::Sleep{source_id:"1".into(),millis:0}]);assert_eq!(validate(&p).unwrap_err()[0].code,"INVALID_DURATION");}
    #[test] fn rejected_divide_by_zero(){let p=program(vec![Stmt::If{source_id:"a".into(),branches:vec![IfBranch{condition:Expr::Binary{op:BinaryOp::Gt,left:Box::new(Expr::Binary{op:BinaryOp::Div,left:Box::new(Expr::Int{value:9}),right:Box::new(Expr::Int{value:0})}),right:Box::new(Expr::Int{value:1})},body:vec![]}],otherwise:vec![]}]);assert!(validate(&p).unwrap_err().iter().any(|d|d.code=="UNSAFE_DIVISOR"));}
    #[test] fn rejected_bad_cond_type(){let p=program(vec![Stmt::If{source_id:"a".into(),branches:vec![IfBranch{condition:Expr::Int{value:1},body:vec![]}],otherwise:vec![]}]);assert!(validate(&p).is_err());}
    #[test] fn rejected_duplicate_id(){let p=program(vec![Stmt::Log{source_id:"x".into(),text:"one".into()},Stmt::Log{source_id:"x".into(),text:"two".into()}]);assert_eq!(validate(&p).unwrap_err()[0].code,"DUPLICATE_SOURCE_ID");}
}
