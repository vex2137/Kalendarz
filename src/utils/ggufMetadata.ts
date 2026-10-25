// Inspect metadata only; tensor support is determined by the inference engine.
// Limit allocations even for hostile/truncated files selected through SAF.
export async function ggufMetadata(blob: Blob) {
  const buffer = await blob.slice(0, 16 * 1024 * 1024).arrayBuffer();
  const view = new DataView(buffer), decoder = new TextDecoder('utf-8', { fatal: true });
  let offset = 0;
  const take = (n: number) => {
    if (!Number.isSafeInteger(n) || n < 0 || offset + n > buffer.byteLength) throw Error('model-gguf-invalid');
    const start = offset; offset += n; return start;
  };
  const u32 = () => view.getUint32(take(4), true);
  const u64 = () => { const n = view.getBigUint64(take(8), true); if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('model-gguf-invalid'); return Number(n); };
  const string = () => { const n = u64(); return decoder.decode(new Uint8Array(buffer, take(n), n)); };
  if (decoder.decode(new Uint8Array(buffer, take(4), 4)) !== 'GGUF' || ![2, 3].includes(u32())) throw Error('model-gguf-invalid');
  const tensors = u64(), count = u64();
  if (!tensors || tensors > 1_000_000 || !count || count > 100_000) throw Error('model-gguf-invalid');
  const sizes: Record<number, number> = {0:1,1:1,2:2,3:2,4:4,5:4,6:4,7:1,10:8,11:8,12:8};
  const metadata: Record<string, string | number> = {};
  for (let i = 0; i < count; i++) {
    const key = string(), type = u32();
    const keep = /^general\.(architecture|name|file_type)$|\.context_length$|^split\.count$/.test(key);
    if (type === 8) { const n = u64(), start = take(n); if (keep) metadata[key] = decoder.decode(new Uint8Array(buffer, start, n)); }
    else if (type === 9) {
      const subtype = u32(), length = u64();
      if (length > 1_000_000 || subtype === 9) throw Error('model-gguf-invalid');
      if (sizes[subtype]) take(length * sizes[subtype]);
      else if (subtype === 8) { for (let j = 0; j < length; j++) { take(u64()); if (j && j % 8192 === 0) await new Promise(resolve => setTimeout(resolve,0)); } }
      else throw Error('model-gguf-invalid');
    } else {
      if (!sizes[type]) throw Error('model-gguf-invalid');
      const start = take(sizes[type]);
      if (keep && type === 4) metadata[key] = view.getUint32(start, true);
    }
  }
  if (Number(metadata['split.count']) > 1) throw Error('model-gguf-split');
  const architecture = metadata['general.architecture'];
  if (typeof architecture !== 'string' || !/^[a-z0-9_]{1,64}$/.test(architecture)) throw Error('model-gguf-invalid');
  const context = Number(metadata[architecture + '.context_length']);
  if (!Number.isSafeInteger(context) || context < 1) throw Error('model-gguf-unsupported');
  const quants: Record<number,string> = {0:'F32',1:'F16',2:'Q4_0',3:'Q4_1',7:'Q8_0',8:'Q5_0',9:'Q5_1',10:'Q2_K',11:'Q3_K_S',12:'Q3_K_M',13:'Q3_K_L',14:'Q4_K_S',15:'Q4_K_M',16:'Q5_K_S',17:'Q5_K_M',18:'Q6_K',25:'IQ4_NL',30:'IQ4_XS',32:'BF16'};
  const type = Number(metadata['general.file_type']);
  return { architecture, name: String(metadata['general.name'] || architecture).slice(0, 200), quantization:quants[type] || `GGUF type ${type}`, maxContext: Math.min(2048, context) };
}
