// 生成 1024×1024 小程序图标（绿色背景 + 白色"乡"字）
// 输出到 assets/logo.png
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 1024;
const OUT = path.join(__dirname, 'assets');
fs.mkdirSync(OUT, { recursive: true });

// 简易"乡"字像素位图（30x30 网格），1 = 白色像素，0 = 透明
// 用形状抽象表示，加上方圆叶状装饰更像 logo
function buildPixelGrid() {
  // 30x30 网格，绘制"乡"字结构（简化版本）
  const W = 30, H = 30;
  const grid = Array.from({ length: H }, () => Array(W).fill(0));

  // 第一笔：横折钩（顶部）
  for (let x = 6; x <= 22; x++) grid[5][x] = 1;
  for (let y = 5; y <= 9; y++) grid[y][22] = 1;
  for (let x = 18; x <= 22; x++) grid[9][x] = 1;

  // 第二笔：横折钩（中部）
  for (let x = 4; x <= 22; x++) grid[12][x] = 1;
  for (let y = 12; y <= 16; y++) grid[y][22] = 1;
  for (let x = 16; x <= 22; x++) grid[16][x] = 1;

  // 第三笔：竖撇
  for (let y = 13; y <= 26; y++) {
    const x = 14 - Math.floor((y - 13) / 3);
    if (x >= 0) {
      grid[y][x] = 1;
      grid[y][x + 1] = 1;
    }
  }

  return { grid, W, H };
}

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

function makeLogoPng(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;     // bit depth
  ihdr[9] = 6;     // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const { grid, W, H } = buildPixelGrid();
  const cellSize = Math.floor(size * 0.7 / W);
  const offsetX = Math.floor((size - W * cellSize) / 2);
  const offsetY = Math.floor((size - H * cellSize) / 2);

  // 圆角矩形遮罩（外圆）
  const radius = size / 2 - 4;
  const cx = size / 2, cy = size / 2;

  // 渐变背景：左上 #4CAF50 → 右下 #2E7D32
  function gradColor(x, y) {
    const t = (x + y) / (2 * size);
    const r1 = 0x4C, g1 = 0xAF, b1 = 0x50;
    const r2 = 0x2E, g2 = 0x7D, b2 = 0x32;
    return [
      Math.round(r1 + (r2 - r1) * t),
      Math.round(g1 + (g2 - g1) * t),
      Math.round(b1 + (b2 - b1) * t),
    ];
  }

  const rowLen = 1 + size * 4;
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) {
    const off = y * rowLen;
    raw[off] = 0;
    for (let x = 0; x < size; x++) {
      const p = off + 1 + x * 4;
      const dx = x - cx, dy = y - cy;
      const inCircle = dx * dx + dy * dy <= radius * radius;

      if (!inCircle) {
        raw[p] = 0; raw[p + 1] = 0; raw[p + 2] = 0; raw[p + 3] = 0;
        continue;
      }

      // 判断当前像素是否落在"乡"字像素上
      const gx = Math.floor((x - offsetX) / cellSize);
      const gy = Math.floor((y - offsetY) / cellSize);
      let isChar = false;
      if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
        isChar = grid[gy][gx] === 1;
      }

      if (isChar) {
        raw[p] = 0xff; raw[p + 1] = 0xff; raw[p + 2] = 0xff; raw[p + 3] = 0xff;
      } else {
        const [r, g, b] = gradColor(x, y);
        raw[p] = r; raw[p + 1] = g; raw[p + 2] = b; raw[p + 3] = 0xff;
      }
    }
  }
  const idat = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out1024 = path.join(OUT, 'logo-1024.png');
const out144 = path.join(OUT, 'logo-144.png');
fs.writeFileSync(out1024, makeLogoPng(1024));
fs.writeFileSync(out144, makeLogoPng(144));
console.log('Logo files written:');
console.log('  ', out1024, fs.statSync(out1024).size, 'bytes');
console.log('  ', out144, fs.statSync(out144).size, 'bytes');
