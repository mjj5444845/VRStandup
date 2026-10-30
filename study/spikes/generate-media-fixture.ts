import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const seconds = 62; // Two tail seconds let the check stop at a complete 60 s.
const fps = 30;
const width = 640;
const height = 360;
const sampleRate = 48_000;
const glyphs = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];

function frame(index: number) {
  const pixels = Buffer.alloc(width * height * 3, Buffer.from([21, 42, 35]));
  function rect(x: number, y: number, w: number, h: number, rgb: number[]) {
    const row = Buffer.alloc(w * 3);
    for (let p = 0; p < row.length; p += 3) row.set(rgb, p);
    for (let line = y; line < y + h; line++) row.copy(pixels, (line * width + x) * 3);
  }
  const pulse = index % fps < 3;
  rect(32, 32, 576, 16, pulse ? [239, 242, 211] : [53, 81, 67]);
  rect(32, 300, 576, 20, [53, 81, 67]);
  const progress = Math.max(1, Math.floor(576 * index / (seconds * fps)));
  rect(32, 300, progress, 20, [116, 190, 141]);
  // Integer seconds are drawn as code-owned pixel glyphs; no font assets needed.
  const text = Math.floor(index / fps).toString().padStart(2, '0');
  [...text].forEach((digit, n) => {
    [...glyphs[Number(digit)]].forEach((value, cell) => {
      if (value === '1') rect(218 + n * 112 + cell % 3 * 28, 102 + Math.floor(cell / 3) * 28, 24, 24, [239, 242, 211]);
    });
  });
  return pixels;
}

function wave() {
  const count = seconds * sampleRate;
  const data = Buffer.alloc(44 + count * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sampleRate, 24); data.writeUInt32LE(sampleRate * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    const withinSecond = i % sampleRate / sampleRate;
    const envelope = withinSecond < 0.08 ? Math.sin(Math.PI * withinSecond / 0.08) ** 2 : 0;
    data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 660 * i / sampleRate) * envelope * 0.35 * 32767), 44 + i * 2);
  }
  return data;
}

async function main() {
  const { values } = parseArgs({ options: { ffmpeg: { type: 'string', default: 'ffmpeg' }, help: { type: 'boolean', default: false } }, strict: true, allowPositionals: false });
  if (values.help) { console.log('生成新的同步测试素材：npm run spike:media-fixture -- --ffmpeg <本机 FFmpeg 路径>；已有文件不会覆盖。'); return; }
  const destination = path.join(root, 'public/study/checks/media-clock');
  const names = ['clock.mp4', 'click.wav', 'fixture.json'];
  if (names.some((name) => existsSync(path.join(destination, name)))) throw new Error('测试素材已存在，为避免覆盖已停止。');
  await mkdir(destination, { recursive: true });
  const temporary = await mkdtemp(path.join(destination, '.generate-'));
  try {
    const output = path.join(temporary, 'clock.mp4');
    const process = spawn(values.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', `${width}x${height}`, '-framerate', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], { stdio: ['pipe', 'ignore', 'inherit'] });
    const finished = once(process, 'close');
    process.stdin.on('error', () => { /* The process exit/error remains the source of failure. */ });
    for (let index = 0; index < seconds * fps; index++) {
      if (process.exitCode !== null) throw new Error('FFmpeg 提前停止。');
      if (!process.stdin.write(frame(index))) await Promise.race([once(process.stdin, 'drain'), finished.then(() => { throw new Error('FFmpeg 提前停止。'); })]);
    }
    process.stdin.end();
    const [code] = await finished;
    if (code !== 0) throw new Error('FFmpeg 编码失败。');
    await writeFile(path.join(temporary, 'click.wav'), wave());
    const files = await Promise.all(names.slice(0, 2).map(async (name) => {
      const data = await readFile(path.join(temporary, name));
      return { name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
    }));
    await writeFile(path.join(temporary, 'fixture.json'), JSON.stringify({ version: 1, purpose: 'Synthetic M0 S3 clock check; no research recordings', durationSeconds: seconds, fps, width, height, sampleRate, files }, null, 2) + '\n');
    for (const name of names) await copyFile(path.join(temporary, name), path.join(destination, name), constants.COPYFILE_EXCL);
    console.log('已生成全新的同步测试素材；来源、格式和校验值见 fixture.json 与 ASSETS.md。');
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

main().catch((error: unknown) => { console.error(`生成失败：${error instanceof Error ? error.message : '未知错误'}`); process.exitCode = 1; });
