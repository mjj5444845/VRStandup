import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { constants, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// A code-drawn moving silhouette exercises gradients and soft edges, not human hair.
const width = 512, height = 288, fps = 24, durationSeconds = 8;
function frame(index: number): Buffer {
  const result = Buffer.alloc(width * height * 3);
  const shift = Math.sin(index / fps * Math.PI / 2) * 24;
  const rectDistance = (x: number, y: number, cx: number, cy: number, w: number, h: number) => Math.max(Math.abs(x - cx) - w / 2, Math.abs(y - cy) - h / 2);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const bg = [0, 177 + Math.round(12 * Math.sin(x / 80) * Math.cos(y / 90)), 64];
    const head = Math.hypot(x - 256 - shift, y - 82) - 31;
    const torso = rectDistance(x, y, 256 + shift, 177, 94, 132);
    const arm = Math.hypot((x - 321 - shift) / 1.5, y - 150 - Math.sin(index / fps * 2) * 12) - 18;
    const distance = Math.min(head, torso, arm);
    const alpha = Math.max(0, Math.min(1, 0.5 - distance / 2));
    let fg = head < torso && head < arm ? [214, 154, 117] : [64, 86, 165];
    // Thin dark strokes deliberately challenge edge retention.
    if (y < 75 && head < 0) fg = [42, 31, 28];
    const rgb = bg.map((v, c) => Math.round(v * (1 - alpha) + fg[c] * alpha));
    if (y > 252 && y < 276) {
      if (x > 32 && x < 96) rgb.splice(0, 3, 235, 235, 235);
      if (x > 112 && x < 176) rgb.splice(0, 3, 128, 128, 128);
      if (x > 192 && x < 256) rgb.splice(0, 3, 220, 40, 55);
    }
    result.set(rgb, (y * width + x) * 3);
  }
  return result;
}
async function main() {
  const { values } = parseArgs({ options: { ffmpeg: { type: 'string', default: 'ffmpeg' }, help: { type: 'boolean' } }, strict: true });
  if (values.help) { console.log('生成原创去背景样片：npm run spike:chroma-fixture -- --ffmpeg <本机 FFmpeg 路径>；已有成品不会覆盖。'); return; }
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const dest = path.join(root, 'public/study/checks/chroma');
  const names = ['silhouette.mp4', 'fixture.json'];
  if (names.some((n) => existsSync(path.join(dest, n)))) throw new Error('样片已经存在，停止以避免覆盖。');
  await mkdir(dest, { recursive: true });
  const temp = await mkdtemp(path.join(dest, '.generate-'));
  try {
    const output = path.join(temp, names[0]);
    const frames = Buffer.concat(Array.from({ length: fps * durationSeconds }, (_, index) => frame(index)));
    // Arguments are passed without a shell, so Mac and Windows use the same code.
    const encoded = spawnSync(values.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', `${width}x${height}`, '-framerate', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], { input: frames, maxBuffer: 4 * 1024 * 1024 });
    if (encoded.error) throw encoded.error;
    if (encoded.status !== 0) throw new Error(encoded.stderr.toString() || '视频编码失败。');
    const data = await readFile(output);
    await writeFile(path.join(temp, names[1]), JSON.stringify({ version: 1, purpose: 'Synthetic S4 preview; not human footage or hair validation', width, height, fps, durationSeconds, keyColor: '#00b140', files: [{ name: names[0], bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') }] }, null, 2) + '\n');
    for (const name of names) await copyFile(path.join(temp, name), path.join(dest, name), constants.COPYFILE_EXCL);
    console.log('原创样片已生成，正式演员效果仍需另行验收。');
  } finally { await rm(temp, { recursive: true, force: true }); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : '生成失败'); process.exitCode = 1; });
