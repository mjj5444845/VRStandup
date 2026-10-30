import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('synthetic fixture hashes and PCM time axis match the public manifest', async () => {
  const directory = new URL('../../public/study/checks/media-clock/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('fixture.json', directory), 'utf8')) as {
    durationSeconds: number; sampleRate: number; fps: number;
    files: { name: string; bytes: number; sha256: string }[];
  };
  assert.equal(manifest.durationSeconds, 62);
  assert.equal(manifest.sampleRate, 48000);
  assert.equal(manifest.fps, 30);
  assert.deepEqual(manifest.files.map((file) => file.name), ['clock.mp4', 'click.wav']);
  for (const file of manifest.files) {
    const data = await readFile(new URL(file.name, directory));
    assert.equal(data.length, file.bytes);
    assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256);
  }
  const wave = await readFile(new URL('click.wav', directory));
  assert.equal(wave.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wave.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wave.readUInt16LE(20), 1); // PCM
  assert.equal(wave.readUInt16LE(22), 1); // Mono
  assert.equal(wave.readUInt32LE(24), 48000);
  assert.equal(wave.readUInt16LE(34), 16);
  assert.equal(wave.readUInt32LE(40) / (48000 * 2), 62);
  const video = await readFile(new URL('clock.mp4', directory));
  assert.equal(video.toString('ascii', 4, 8), 'ftyp');
  assert.ok(video.indexOf('moov') < video.indexOf('mdat'), 'faststart metadata must precede media payload');
});
