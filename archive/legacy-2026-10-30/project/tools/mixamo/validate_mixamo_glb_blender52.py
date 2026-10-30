"""Re-import and validate a generated Mixamo GLB with Blender 5.2.

Example:
    blender --background --python tools/mixamo/validate_mixamo_glb_blender52.py -- \
      avatar.glb --manifest animations.json \
      --required IDLE_Idle PERFORM_Talking1 PERFORM_Waving SIT_Sitting1
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("glb", type=Path)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--required", nargs="*", default=[])
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def choose_armature():
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    return max(armatures, key=lambda obj: len(obj.data.bones), default=None)


def choose_slot(animation_data, action):
    animation_data.action = action
    slots = list(getattr(animation_data, "action_suitable_slots", []))
    if not slots:
        return None
    animation_data.action_slot = slots[0]
    return slots[0]


def finite_vector(values) -> bool:
    return all(math.isfinite(float(value)) for value in values)


def rig_rest_height(rig) -> float:
    z_values = []
    for bone in rig.data.bones:
        z_values.extend((bone.head_local.z, bone.tail_local.z))
    return max(1e-6, max(z_values) - min(z_values))


def validate_clip(rig, action) -> dict:
    animation_data = rig.animation_data_create()
    for track in animation_data.nla_tracks:
        track.mute = True
    slot = choose_slot(animation_data, action)
    if slot is None:
        return {"name": action.name, "passed": False, "error": "No suitable Action Slot"}

    frame_start, frame_end = action.frame_range
    frames = [frame_start, (frame_start + frame_end) / 2.0, frame_end]
    rest_height = rig_rest_height(rig)
    max_pose_ratio = 0.0

    for frame in frames:
        bpy.context.scene.frame_set(int(round(frame)))
        bpy.context.view_layer.update()
        points = []
        for pose_bone in rig.pose.bones:
            if not all(finite_vector(row) for row in pose_bone.matrix):
                return {
                    "name": action.name,
                    "passed": False,
                    "error": f"Non-finite pose matrix at frame {frame}",
                }
            points.extend((pose_bone.head.copy(), pose_bone.tail.copy()))

        xs = [point.x for point in points]
        ys = [point.y for point in points]
        zs = [point.z for point in points]
        diagonal = math.sqrt(
            (max(xs) - min(xs)) ** 2
            + (max(ys) - min(ys)) ** 2
            + (max(zs) - min(zs)) ** 2
        )
        max_pose_ratio = max(max_pose_ratio, diagonal / rest_height)

    animation_data.action = None
    passed = 0.05 <= max_pose_ratio <= 10.0
    return {
        "name": action.name,
        "passed": passed,
        "frame_start": float(frame_start),
        "frame_end": float(frame_end),
        "sampled_frames": [float(frame) for frame in frames],
        "max_pose_to_rest_ratio": round(max_pose_ratio, 6),
        "error": None if passed else "Pose bounds indicate a scale or skeleton explosion",
    }


def main() -> int:
    args = parse_args()
    glb_path = args.glb.resolve()
    if not glb_path.is_file():
        raise FileNotFoundError(glb_path)

    manifest = None
    expected_names = set()
    if args.manifest:
        manifest = json.loads(args.manifest.resolve().read_text(encoding="utf-8"))
        expected_names = {item["name"] for item in manifest.get("animations", [])}

    clear_scene()
    result = bpy.ops.import_scene.gltf(
        filepath=str(glb_path),
        import_pack_images=True,
        guess_original_bind_pose=True,
        disable_bone_shape=True,
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"glTF import failed: {sorted(result)}")

    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    rig = choose_armature()
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    actions = {action.name: action for action in bpy.data.actions}

    skinned_meshes = []
    if rig:
        for mesh in meshes:
            if any(
                modifier.type == "ARMATURE" and modifier.object == rig
                for modifier in mesh.modifiers
            ):
                skinned_meshes.append(mesh.name)

    required_names = set(args.required) or expected_names
    missing_expected = sorted(expected_names - set(actions))
    missing_required = sorted(required_names - set(actions))
    clip_reports = [
        validate_clip(rig, actions[name])
        for name in sorted(required_names & set(actions))
    ] if rig else []

    object_scales_ok = all(
        finite_vector(obj.scale) and all(1e-4 <= abs(value) <= 1e4 for value in obj.scale)
        for obj in bpy.data.objects
    )
    checks = {
        "glb_reimported": True,
        "single_armature": len(armatures) == 1,
        "mesh_present": bool(meshes),
        "all_meshes_skinned": bool(meshes) and len(skinned_meshes) == len(meshes),
        "materials_present": len(bpy.data.materials) > 0,
        "textures_present": len(bpy.data.images) > 0,
        "manifest_clips_present": not missing_expected,
        "required_clips_present": not missing_required,
        "required_clips_pose_sane": bool(clip_reports) and all(
            report["passed"] for report in clip_reports
        ),
        "object_scales_sane": object_scales_ok,
    }
    passed = all(checks.values())
    report = {
        "passed": passed,
        "blender_version": bpy.app.version_string,
        "glb": glb_path.name,
        "glb_bytes": glb_path.stat().st_size,
        "checks": checks,
        "armatures": [obj.name for obj in armatures],
        "bone_count": len(rig.data.bones) if rig else 0,
        "meshes": [obj.name for obj in meshes],
        "skinned_meshes": skinned_meshes,
        "material_count": len(bpy.data.materials),
        "texture_count": len(bpy.data.images),
        "animation_count": len(actions),
        "animations": sorted(actions),
        "missing_manifest_animations": missing_expected,
        "missing_required_animations": missing_required,
        "clip_reports": clip_reports,
    }

    report_path = args.report or glb_path.with_name(f"{glb_path.stem}_validation.json")
    report_path.resolve().write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print("[MixamoAFrameValidator] " + json.dumps(report, ensure_ascii=False))
    return 0 if passed else 2


if __name__ == "__main__":
    raise SystemExit(main())
