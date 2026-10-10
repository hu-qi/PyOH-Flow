//! Versioned, language-independent representation of a visual program.
//! No Blockly or Python syntax is stored here.
use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Target {
    XiaohongWs63,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Program {
    pub schema_version: u32,
    pub target: Target,
    pub body: Vec<Stmt>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Stmt {
    Log { source_id: String, text: String },
    Sleep { source_id: String, millis: u32 },
    Forever { source_id: String, body: Vec<Stmt> },
    Repeat { source_id: String, times: Expr, body: Vec<Stmt> },
    If { source_id: String, branches: Vec<IfBranch>, otherwise: Vec<Stmt> },
}

impl Stmt {
    pub fn source_id(&self) -> &str {
        match self {
            Stmt::Log { source_id, .. }
            | Stmt::Sleep { source_id, .. }
            | Stmt::Forever { source_id, .. }
            | Stmt::Repeat { source_id, .. }
            | Stmt::If { source_id, .. } => source_id,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct IfBranch {
    pub condition: Expr,
    pub body: Vec<Stmt>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Expr {
    Int { value: i32 },
    Bool { value: bool },
    Binary { op: BinaryOp, left: Box<Expr>, right: Box<Expr> },
    Not { value: Box<Expr> },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BinaryOp {
    Add, Sub, Mul, Div,
    Eq, Ne, Lt, Le, Gt, Ge,
    And, Or,
}
