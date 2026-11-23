// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Minimal stored (uncompressed) ZIP writer: .vfxb packs are already compressed WebP containers.
const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (data: Uint8Array) => {
  let c = ~0;
  for (const byte of data) c = table[(c ^ byte) & 255] ^ (c >>> 8);
  return ~c >>> 0;
};
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

export function zip(files: { name: string; data: Uint8Array<ArrayBuffer> }[]) {
  const parts: BlobPart[] = [], central: BlobPart[] = [];
  let offset = 0, centralSize = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name), crc = crc32(file.data), size = file.data.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(12, DOS_DATE, true); local.setUint32(14, crc, true); local.setUint32(18, size, true); local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    parts.push(local.buffer, name, file.data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(8, 0x0800, true);
    entry.setUint16(14, DOS_DATE, true); entry.setUint32(16, crc, true); entry.setUint32(20, size, true); entry.setUint32(24, size, true);
    entry.setUint16(28, name.length, true); entry.setUint32(42, offset, true);
    central.push(entry.buffer, name);
    offset += 30 + name.length + size; centralSize += 46 + name.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
