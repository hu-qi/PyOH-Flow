/** Create an uncompressed standards-compliant ZIP archive in the browser. */
const encoder = new TextEncoder();
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for(const byte of data) {
    crc ^= byte;
    for(let i=0;i<8;i++)crc=(crc>>>1) ^ ((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}
export function zipFiles(files: Record<string,string>): Blob {
  const local:Uint8Array[]=[];
  const central:Uint8Array[]=[];
  let offset=0;
  const view=(buffer:Uint8Array)=>new DataView(buffer.buffer);
  for(const [name,text] of Object.entries(files)) {
    if(!name||name.startsWith('/')||name.includes('..')||name.includes('\\'))throw new Error('不安全的 ZIP 路径');
    const fname=encoder.encode(name), data=encoder.encode(text),crc=crc32(data);
    if(fname.length>65535 || data.length>0xffffffff)throw new Error('文件超出 ZIP 限制');
    const h=new Uint8Array(30+fname.length),hv=view(h);
    hv.setUint32(0,0x04034b50,true); hv.setUint16(4,20,true);hv.setUint16(6,0x800,true);
    hv.setUint32(14,crc,true);hv.setUint32(18,data.length,true);hv.setUint32(22,data.length,true);
    hv.setUint16(26,fname.length,true);h.set(fname,30);
    local.push(h,data);
    const c=new Uint8Array(46+fname.length),cv=view(c);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
    cv.setUint16(8,0x800,true);cv.setUint32(16,crc,true);
    cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);
    cv.setUint16(28,fname.length,true);cv.setUint32(42,offset,true);
    c.set(fname,46);central.push(c);
    offset+=h.length+data.length;
  }
  const directoryBytes=central.reduce((acc,b)=>acc+b.length,0),end=new Uint8Array(22),ev=view(end);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);
  ev.setUint32(12,directoryBytes,true);ev.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:'application/zip'});
}
