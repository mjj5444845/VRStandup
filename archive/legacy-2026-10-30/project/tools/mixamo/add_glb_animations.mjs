#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function parseGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) {
    throw new Error('Expected a glTF 2.0 GLB');
  }
  let offset = 12;
  let json;
  let binary = Buffer.alloc(0);
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === JSON_CHUNK) json = JSON.parse(chunk.toString('utf8').trimEnd());
    if (type === BIN_CHUNK) binary = Buffer.from(chunk);
    offset += 8 + length;
  }
  if (!json) throw new Error('GLB has no JSON chunk');
  return { json, binary };
}

function pad(buffer, byte = 0) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, byte)]) : buffer;
}

function writeGlb({ json, binary }) {
  const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
  const binChunk = pad(binary);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(JSON_CHUNK, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(BIN_CHUNK, 4);
  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
}

const [sourcePath, targetPath, ...clipNames] = process.argv.slice(2);
if (!sourcePath || !targetPath || clipNames.length === 0) {
  throw new Error('Usage: node add_glb_animations.mjs <source-master.glb> <target-runtime.glb> <clip> [...]');
}

const source = parseGlb(await readFile(sourcePath));
const target = parseGlb(await readFile(targetPath));
target.json.animations ??= [];
target.json.accessors ??= [];
target.json.bufferViews ??= [];

const targetNodesByName = new Map(
  target.json.nodes.map((node, index) => [node.name, index]),
);
const existingClips = new Set(target.json.animations.map((animation) => animation.name));
const accessorMap = new Map();
const bufferViewMap = new Map();
let binary = Buffer.from(target.binary);

function cloneBufferView(sourceIndex) {
  if (bufferViewMap.has(sourceIndex)) return bufferViewMap.get(sourceIndex);
  const sourceView = source.json.bufferViews[sourceIndex];
  if (sourceView.buffer !== 0) throw new Error('Only single-buffer GLBs are supported');
  binary = pad(binary);
  const start = sourceView.byteOffset ?? 0;
  const payload = source.binary.subarray(start, start + sourceView.byteLength);
  const targetIndex = target.json.bufferViews.length;
  target.json.bufferViews.push({
    ...sourceView,
    buffer: 0,
    byteOffset: binary.length,
  });
  binary = Buffer.concat([binary, payload]);
  bufferViewMap.set(sourceIndex, targetIndex);
  return targetIndex;
}

function cloneAccessor(sourceIndex) {
  if (accessorMap.has(sourceIndex)) return accessorMap.get(sourceIndex);
  const accessor = structuredClone(source.json.accessors[sourceIndex]);
  if (accessor.bufferView !== undefined) {
    accessor.bufferView = cloneBufferView(accessor.bufferView);
  }
  if (accessor.sparse) {
    accessor.sparse.indices.bufferView = cloneBufferView(accessor.sparse.indices.bufferView);
    accessor.sparse.values.bufferView = cloneBufferView(accessor.sparse.values.bufferView);
  }
  const targetIndex = target.json.accessors.length;
  target.json.accessors.push(accessor);
  accessorMap.set(sourceIndex, targetIndex);
  return targetIndex;
}

const added = [];
for (const clipName of clipNames) {
  if (existingClips.has(clipName)) continue;
  const sourceAnimation = source.json.animations.find((animation) => animation.name === clipName);
  if (!sourceAnimation) throw new Error(`Missing source animation: ${clipName}`);
  const animation = structuredClone(sourceAnimation);
  for (const sampler of animation.samplers) {
    sampler.input = cloneAccessor(sampler.input);
    sampler.output = cloneAccessor(sampler.output);
  }
  for (const channel of animation.channels) {
    const sourceNode = source.json.nodes[channel.target.node];
    const targetNode = targetNodesByName.get(sourceNode?.name);
    if (targetNode === undefined) {
      throw new Error(`Target runtime is missing animated node: ${sourceNode?.name}`);
    }
    channel.target.node = targetNode;
  }
  target.json.animations.push(animation);
  existingClips.add(clipName);
  added.push(clipName);
}

target.json.buffers[0].byteLength = binary.length;
await writeFile(targetPath, writeGlb({ json: target.json, binary }));
const outputBytes = (await readFile(targetPath)).length;
const reportPath = targetPath.replace(/\.glb$/i, '.runtime.json');
try {
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  report.clips = target.json.animations.map((animation) => animation.name).sort();
  report.bytes = outputBytes;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
console.log(JSON.stringify({ target: targetPath, added, bytes: outputBytes }));
