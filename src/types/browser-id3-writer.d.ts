declare module 'browser-id3-writer' {
  export default class ID3Writer {
    constructor(buffer: Uint8Array | ArrayBuffer);
    setFrame(frameId: string, value: unknown): this;
    addTag(): void;
    getBlob(): Blob;
  }
}
