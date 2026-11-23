declare module 'png-chunks-extract' {
  interface PngChunk { name: string; data: Uint8Array }
  function extract(data: Uint8Array): PngChunk[];
  export default extract;
}
declare module 'png-chunk-text' {
  const text: {
    decode(data: Uint8Array): { keyword: string; text: string };
    encode(keyword: string, content: string): { name: string; data: Uint8Array };
  };
  export default text;
}
