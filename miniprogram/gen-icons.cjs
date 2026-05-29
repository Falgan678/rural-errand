// 生成 tabBar 占位 PNG 图标（纯 Node，无外部依赖）
// 输出到 src/static/icons/，编译后会自动复制到 dist
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 81;
const OUT_DIR = path.join(__dirname, 'src', 'static', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

// 8 个图标：正常态 #999999 灰，选中态 #4CAF50 绿
const ICONS = [
  { name: 'home.png',            color: [0x99, 0x99, 0x99] },
  { name: 'home-active.png',     color: [0x4C, 0xAF, 0x50] },
  { name: 'runner.png',          color: [0x99, 0x99, 0x99] },
  { name: 'runner-active.png',   color: [0x4C, 0xAF, 0x50] },
  { name: 'orders.png',          color: [0x99, 0x99, 0x99] },
  { name: 'orders-active.png',   color: [0x4C, 0xAF, 0x50] },
  { name: 'profile.png',         color: [0x99, 0x99, 0x99] },
  { name: 'profile-active.png',  color: [0x4C, 0xAF, 0x50] },
];

// CRC32（PNG chunk 用）
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, [r, g, b]) {
  // PNG 头
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);   // width
  ihdr.writeUInt32BE(size, 4);   // height
  ihdr[8] = 8;                    // bit depth
  ihdr[9] = 6;                    // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // IDAT: 每行起始 filter byte 0，然后 RGBA*size
  const rowLen = 1 + size * 4;
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) {
    const off = y * rowLen;
    raw[off] = 0; // filter
    for (let x = 0; x < size; x++) {
      const p = off + 1 + x * 4;
      // 圆形遮罩（更好看）
      const dx = x - size / 2, dy = y - size / 2;
      const inside = dx * dx + dy * dy <= (size / 2 - 2) * (size / 2 - 2);
      if (inside) {
        raw[p] = r; raw[p + 1] = g; raw[p + 2] = b; raw[p + 3] = 0xff;
      } else {
        raw[p] = 0; raw[p + 1] = 0; raw[p + 2] = 0; raw[p + 3] = 0; // 透明
      }
    }
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const ic of ICONS) {
  const buf = makePng(SIZE, ic.color);
  fs.writeFileSync(path.join(OUT_DIR, ic.name), buf);
  console.log('  +', ic.name, buf.length, 'bytes');
}
console.log('Done. Icons written to', OUT_DIR);
