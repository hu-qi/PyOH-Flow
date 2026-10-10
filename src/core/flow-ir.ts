/** Blockly is merely one frontend: this is the stable, versioned Flow IR contract. */
export type FlowExpr =
  | {kind:'int';value:number}
  | {kind:'bool';value:boolean}
  | {kind:'not';value:FlowExpr}
  | {kind:'binary';op:'add'|'sub'|'mul'|'div'|'eq'|'ne'|'lt'|'le'|'gt'|'ge'|'and'|'or';left:FlowExpr;right:FlowExpr};
export type FlowStmt =
  | {kind:'log';source_id:string;text:string}
  | {kind:'sleep';source_id:string;millis:number}
  | {kind:'forever';source_id:string;body:FlowStmt[]}
  | {kind:'repeat';source_id:string;times:FlowExpr;body:FlowStmt[]}
  | {kind:'if';source_id:string;branches:Array<{condition:FlowExpr;body:FlowStmt[]}>;otherwise:FlowStmt[]};
export type FlowProgram={schema_version:1;target:'xiaohong_ws63';body:FlowStmt[]};

type Block = {id?:string;type:string;disabled?:boolean;fields?:Record<string,unknown>;
  inputs?:Record<string,{block?:Block;shadow?:Block}>;next?:{block?:Block};extraState?:{elseCount?:number;elseIfCount?:number;hasElse?:boolean}};
const MAX_DEPTH=40;
const MAX_NODES=10000;

export class FlowConversionError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Flow IR 转换失败：\n${errors.join('\n')}`);
    this.name='FlowConversionError';
  }
}
/** Explicit error reporting: missing sockets, disabled blocks, unknown blocks never become 0. */
export function blocklyToFlowIR(serialized:Record<string,unknown>):FlowProgram {
  const errors:string[]=[];
  let sequence=0;
  let count=0;
  const fail=(block:Block,message:string)=>{errors.push(`${block.type} (${block.id||'无 ID'}): ${message}`);};
  const id=(b:Block)=>b.id||`block_${++sequence}`;
  const guard=(b:Block,depth:number)=>{
    if (++count>MAX_NODES) throw new FlowConversionError(['工作区积木数量超出 10000']);
    if (depth>MAX_DEPTH)throw new FlowConversionError(['积木嵌套超过 40 层']);
    if (b.disabled)fail(b,'已禁用的积木不允许编译');
  };
  const input=(b:Block,name:string)=>b.inputs?.[name]?.block ?? b.inputs?.[name]?.shadow;
  function expression(b:Block|undefined,parent:Block,depth:number):FlowExpr {
    if(!b){fail(parent,'表达式插槽不能为空');return {kind:'int',value:0};}
    guard(b,depth);
    const n=(key:string)=>Number(b.fields?.[key]);
    const child=(key:string)=>expression(input(b,key),b,depth+1);
    switch(b.type){
      case 'math_number':{
        const value=n('NUM');
        if (!Number.isInteger(value)||value < -2147483648||value>2147483647)fail(b,'需要有效的 32 位整数');
        return {kind:'int',value};
      }
      case 'logic_boolean':return {kind:'bool',value:b.fields?.BOOL==='TRUE'};
      case 'logic_negate':return {kind:'not',value:child('BOOL')};
      case 'math_arithmetic':{
        const mapping:Record<string,'add'|'sub'|'mul'|'div'>={ADD:'add',MINUS:'sub',MULTIPLY:'mul',DIVIDE:'div'};
        const op=mapping[String(b.fields?.OP)];if(!op){fail(b,'运算符不支持');return {kind:'int',value:0};}
        return {kind:'binary',op,left:child('A'),right:child('B')};
      }
      case 'logic_compare':{
        const mapping:Record<string,'eq'|'ne'|'lt'|'le'|'gt'|'ge'>={EQ:'eq',NEQ:'ne',LT:'lt',LTE:'le',GT:'gt',GTE:'ge'};
        const op=mapping[String(b.fields?.OP)];if(!op){fail(b,'比较符不支持');return {kind:'bool',value:false};}
        return {kind:'binary',op,left:child('A'),right:child('B')};
      }
      case 'logic_operation':{
        const mapping:Record<string,'and'|'or'>={AND:'and',OR:'or'};
        const op=mapping[String(b.fields?.OP)];if(!op){fail(b,'逻辑运算符不支持');return {kind:'bool',value:false};}
        return {kind:'binary',op,left:child('A'),right:child('B')};
      }
      default:fail(b,'不支持的表达式积木');return {kind:'int',value:0};
    }
  }
  function chain(start:Block|undefined,depth:number):FlowStmt[]{
    const result:FlowStmt[]=[];
    const seen=new Set<Block>();
    for(let b=start;b;b=b.next?.block){
      if(seen.has(b))throw new FlowConversionError(['检测到循环积木链']);
      seen.add(b);guard(b,depth);
      const source_id=id(b);
      switch(b.type){
        case 'xh_log':result.push({kind:'log',source_id,text:String(b.fields?.TEXT??'')});break;
        case 'xh_wait_ms':{
          const millis=Number(b.fields?.MS);if(!Number.isInteger(millis))fail(b,'毫秒数必须为整数');
          result.push({kind:'sleep',source_id,millis});break;
        }
        case 'py_wait':{
          const millis=Math.round(Number(b.fields?.SECONDS)*1000);
          if(!Number.isSafeInteger(millis))fail(b,'秒数不合法');
          result.push({kind:'sleep',source_id,millis});break;
        }
        case 'py_forever':result.push({kind:'forever',source_id,body:chain(input(b,'DO'),depth+1)});break;
        case 'controls_repeat_ext':result.push({kind:'repeat',source_id,times:expression(input(b,'TIMES'),b,depth+1),body:chain(input(b,'DO'),depth+1)});break;
        case 'controls_if':{
          const branches:Array<{condition:FlowExpr;body:FlowStmt[]}>=[];
          for(let j=0;b.inputs?.[`IF${j}`];j++){
            branches.push({condition:expression(input(b,`IF${j}`),b,depth+1),body:chain(input(b,`DO${j}`),depth+1)});
          }
          if(!branches.length)fail(b,'if 至少应有一个判断分支');
          const otherwise=chain(input(b,'ELSE'),depth+1);
          result.push({kind:'if',source_id,branches,otherwise});break;
        }
        default:fail(b,'该积木不支持 WS63 Rust Core');
      }
    }
    return result;
  }
  const top=(serialized.blocks as {blocks?:Block[]}|undefined)?.blocks;
  if(!Array.isArray(top))throw new FlowConversionError(['Blockly JSON 缺少 blocks.blocks']);
  const enabled=top.filter(b=>!b.disabled);
  if(enabled.length!==1 || enabled[0]?.type!=='py_start') {
    throw new FlowConversionError(['需要恰好一个「当程序启动」顶层积木；其他孤立积木不可忽略']);
  }
  const root=enabled[0];
  if(top.length!==enabled.length)errors.push('顶层存在禁用积木，不允许忽略');
  const body=chain(input(root,'DO'),0);
  if(errors.length)throw new FlowConversionError(errors);
  return {schema_version:1,target:'xiaohong_ws63',body};
}
