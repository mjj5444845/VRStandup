#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
  }
};
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

const [path, clipName, normalizedTime = '0.5'] = process.argv.slice(2);
if (!path) {
  throw new Error('Usage: node inspect_clip_bounds.mjs <model.glb> [clip] [normalized-time]');
}

const binary = await readFile(path);
const arrayBuffer = binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
const gltf = await new Promise((resolve, reject) => {
  new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
});

const bounds = () => {
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene, true);
  return {
    min: box.min.toArray().map((value) => Number(value.toFixed(4))),
    max: box.max.toArray().map((value) => Number(value.toFixed(4))),
    size: box.getSize(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(4))),
    center: box.getCenter(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(4))),
  };
};

const report = { rest: bounds(), animations: gltf.animations.map((clip) => clip.name) };
if (clipName) {
  const clip = THREE.AnimationClip.findByName(gltf.animations, clipName);
  if (!clip) throw new Error(`Missing clip: ${clipName}`);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(clip).play();
  mixer.setTime(clip.duration * Number(normalizedTime));
  report.pose = {
    clip: clip.name,
    duration: Number(clip.duration.toFixed(4)),
    normalizedTime: Number(normalizedTime),
    bounds: bounds(),
  };
}

console.log(JSON.stringify(report, null, 2));
