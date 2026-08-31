#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AnimationMixer,
  LoopRepeat,
} from 'three';
import * as ThreeRuntime from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
  }
};
globalThis.createImageBitmap ??= async () => ({
  width: 1,
  height: 1,
  close() {},
});

globalThis.THREE = ThreeRuntime;
globalThis.AFRAME = {
  components: {},
  registerComponent(name, definition) {
    this.components[name] = definition;
  },
  utils: {
    diff(current, previous) {
      return Object.fromEntries(
        Object.entries(current).filter(([key, value]) => previous[key] !== value),
      );
    },
  },
};
await import('aframe-extras/loaders/animation-mixer.js');

const args = process.argv.slice(2);
const glbPath = resolve(args[0] ?? '');
const reportIndex = args.indexOf('--report');
const requiredIndex = args.indexOf('--required');
const reportPath = reportIndex >= 0
  ? resolve(args[reportIndex + 1])
  : glbPath.replace(/\.glb$/i, '_aframe_runtime_validation.json');
const required = requiredIndex >= 0
  ? args.slice(requiredIndex + 1).filter((value) => !value.startsWith('--'))
  : ['IDLE_Idle', 'PERFORM_Talking1', 'PERFORM_Waving', 'SIT_Sitting1'];

if (!args[0]) {
  throw new Error('Usage: node validate_aframe_runtime.mjs <avatar.glb> [--required clips...]');
}

const binary = await readFile(glbPath);
const arrayBuffer = binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
const loader = new GLTFLoader();
const gltf = await new Promise((accept, reject) => {
  loader.parse(arrayBuffer, '', accept, reject);
});

// A-Frame's gltf-model component exposes clips on the loaded model; this is
// exactly where aframe-extras animation-mixer reads them.
gltf.scene.animations = gltf.animations;
const clips = new Map(gltf.scene.animations.map((clip) => [clip.name, clip]));
const missing = required.filter((name) => !clips.has(name));

let skinnedMeshCount = 0;
let boneCount = 0;
gltf.scene.traverse((object) => {
  if (object.isSkinnedMesh) skinnedMeshCount += 1;
  if (object.isBone) boneCount += 1;
});
gltf.scene.updateMatrixWorld(true);
const bounds = new ThreeRuntime.Box3().setFromObject(gltf.scene);
const boundsSize = bounds.getSize(new ThreeRuntime.Vector3());
const boundsCenter = bounds.getCenter(new ThreeRuntime.Vector3());

const finiteTransform = (object) => [
  ...object.position.toArray(),
  ...object.quaternion.toArray(),
  ...object.scale.toArray(),
].every(Number.isFinite);

const mixer = new AnimationMixer(gltf.scene);
const clipReports = [];
let previousAction = null;
for (const name of required) {
  const clip = clips.get(name);
  if (!clip) continue;

  const action = mixer.clipAction(clip, gltf.scene);
  action.enabled = true;
  action.setLoop(LoopRepeat, Infinity).fadeIn(0.3).play();
  if (previousAction) previousAction.crossFadeTo(action, 0.3, true);

  const samples = [0, clip.duration * 0.5, clip.duration];
  let transformsFinite = true;
  for (const delta of samples) {
    mixer.update(delta === 0 ? 1 / 60 : delta);
    gltf.scene.traverse((object) => {
      if (!finiteTransform(object)) transformsFinite = false;
    });
  }
  clipReports.push({
    name,
    duration_seconds: Number(clip.duration.toFixed(6)),
    track_count: clip.tracks.length,
    action_created: Boolean(action),
    transforms_finite: transformsFinite,
  });
  previousAction = action;
}

const animationMixerDefinition = globalThis.AFRAME.components['animation-mixer'];
const emittedEvents = [];
const componentElement = {
  getObject3D(name) {
    return name === 'mesh' ? gltf.scene : null;
  },
  addEventListener() {},
  emit(name, detail) {
    emittedEvents.push({ name, detail: Boolean(detail) });
  },
};
const component = {
  ...animationMixerDefinition,
  el: componentElement,
  data: {
    clip: required[0],
    useRegExp: false,
    duration: 0,
    clampWhenFinished: false,
    crossFadeDuration: 0.3,
    loop: 'repeat',
    repetitions: Infinity,
    timeScale: 1,
    startAt: 0,
  },
};
component.init();
const componentSwitches = [];
for (const name of required) {
  const previousData = { ...component.data };
  component.data = { ...component.data, clip: name };
  component.update(previousData);
  component.tick(0, 300);
  componentSwitches.push({
    name,
    active_actions: component.activeActions.length,
    selected_clips: component.activeActions.map((action) => action.getClip().name),
  });
}

const checks = {
  gltf_loaded_by_three: Boolean(gltf.scene),
  animations_exposed_on_model: gltf.scene.animations.length === gltf.animations.length,
  required_clips_present: missing.length === 0,
  skinned_meshes_present: skinnedMeshCount > 0,
  bones_present: boneCount > 0,
  animation_actions_created: clipReports.length === required.length
    && clipReports.every((clip) => clip.action_created),
  sampled_transforms_finite: clipReports.length === required.length
    && clipReports.every((clip) => clip.transforms_finite),
  aframe_extras_component_registered: Boolean(animationMixerDefinition),
  aframe_extras_clip_switching: componentSwitches.length === required.length
    && componentSwitches.every(
      (entry) => entry.active_actions === 1 && entry.selected_clips[0] === entry.name,
    ),
};

const report = {
  passed: Object.values(checks).every(Boolean),
  runtime: {
    aframe: '1.8.0',
    aframe_extras: '7.7.0',
    component: 'animation-mixer',
  },
  glb: glbPath.split(/[\\/]/).at(-1),
  checks,
  animation_count: gltf.animations.length,
  animations: [...clips.keys()].sort(),
  missing_required_animations: missing,
  skinned_mesh_count: skinnedMeshCount,
  bone_count: boneCount,
  bounds: {
    size: boundsSize.toArray().map((value) => Number(value.toFixed(6))),
    center: boundsCenter.toArray().map((value) => Number(value.toFixed(6))),
  },
  clip_reports: clipReports,
  aframe_extras_component_switches: componentSwitches,
  emitted_event_count: emittedEvents.length,
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`[AFrameRuntimeValidator] ${JSON.stringify(report)}`);
if (!report.passed) process.exitCode = 2;
