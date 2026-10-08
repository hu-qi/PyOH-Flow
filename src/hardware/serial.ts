/** Web Serial transports raw bytes; executing code requires a compatible MicroPython REPL. */
type PortReader = ReadableStreamDefaultReader<Uint8Array>;
type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
};
type NavigatorSerial = { requestPort(): Promise<SerialPortLike> };

export class SerialConnection {
  private port: SerialPortLike | null = null;
  private reader: PortReader | null = null;
  private reading: Promise<void> | null = null;
  private onData: (data: string) => void;
  private onStatus: (connected: boolean) => void;

  constructor(onData: (data: string) => void, onStatus: (connected: boolean) => void) {
    this.onData = onData;
    this.onStatus = onStatus;
  }
  static isSupported(): boolean { return typeof navigator !== 'undefined' && 'serial' in navigator; }
  get connected(): boolean { return this.port !== null; }

  async connect(baudRate = 115200): Promise<void> {
    if (this.port) return;
    if (!SerialConnection.isSupported()) throw new Error('浏览器不支持 Web Serial，请使用桌面版 Chrome / Edge（HTTPS 或 localhost）');
    const serial = (navigator as Navigator & { serial: NavigatorSerial }).serial;
    const port = await serial.requestPort();
    await port.open({ baudRate });
    this.port = port;
    this.onStatus(true);
    this.reading = this.readLoop(port);
  }

  private async readLoop(port: SerialPortLike): Promise<void> {
    try {
      while (port.readable && this.port === port) {
        const reader = port.readable.getReader();
        this.reader = reader;
        try {
          while (this.port === port) {
            const {value,done} = await reader.read();
            if (done) break;
            if (value) this.onData(new TextDecoder().decode(value));
          }
        } catch (e) { this.onData(`\n[串口读取错误] ${String(e)}\n`); }
        finally { reader.releaseLock(); if(this.reader===reader) this.reader=null; }
        if (this.port === port) break;
      }
    } finally {
      if (this.port === port) { this.port = null; this.onStatus(false); }
    }
  }

  async write(data: Uint8Array | string): Promise<void> {
    if (!this.port?.writable) throw new Error('未连接串口设备');
    const writer = this.port.writable.getWriter();
    try { await writer.write(typeof data === 'string' ? new TextEncoder().encode(data) : data); }
    finally { writer.releaseLock(); }
  }

  /** MicroPython raw-REPL paste protocol; *not* a firmware flasher. */
  async executeMicroPython(code: string): Promise<void> {
    if (!this.port) throw new Error('请先连接运行 MicroPython 的设备');
    if (new TextEncoder().encode(code).length > 16000) throw new Error('脚本大于 16 KB，请分段发送');
    await this.write(new Uint8Array([3, 3])); // Ctrl-C: interrupt active program
    await new Promise(resolve => setTimeout(resolve, 150));
    await this.write(new Uint8Array([1])); // Ctrl-A: raw REPL mode
    await new Promise(resolve => setTimeout(resolve, 200));
    await this.write(code.replace(/\r\n/g, '\n'));
    await this.write(new Uint8Array([4])); // Ctrl-D: execute buffer
  }

  async stop(): Promise<void> { await this.write(new Uint8Array([3, 3])); }

  async disconnect(): Promise<void> {
    const port = this.port;
    if (!port) return;
    this.port = null;
    if (this.reader) { try { await this.reader.cancel(); } catch { /* already released */ } }
    try { await this.reading; } catch { /* reader already handled */ }
    await port.close();
    this.onStatus(false);
  }
}
