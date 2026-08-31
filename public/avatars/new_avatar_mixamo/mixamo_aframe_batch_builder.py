"""Build a Mixamo character and animation library for A-Frame/WebXR.

Target: Blender 5.2.x LTS.

Interactive use:
    Blender > Scripting > Open > Run Script, then select one
    <project>/characters/*.fbx file.

Headless use:
    blender --background --python mixamo_aframe_batch_builder.py -- \
        <project>/characters/Ch02_nonPBR.fbx

The selected character FBX is destructive to the current scene: the scene is
cleared before importing. Run it in a new Blender file.
"""

from __future__ import annotations

import json
import math
import re
import sys
import traceback
from pathlib import Path
from typing import Iterable, Iterator

import bpy
from bpy.props import StringProperty
from bpy_extras.io_utils import ImportHelper


SCRIPT_VERSION = "1.0.0"
CATEGORIES = ("idle", "perform", "sit")
MIN_BONE_MATCH_RATIO = 0.90
CORE_BONES = {
    "Hips",
    "Spine",
    "Spine1",
    "Spine2",
    "Neck",
    "Head",
    "LeftArm",
    "RightArm",
    "LeftUpLeg",
    "RightUpLeg",
}
_BONE_PATH_RE = re.compile(r'pose\.bones\["([^"]+)"\]')


def log(message: str, level: str = "INFO") -> None:
    prefix = f"[MixamoAFrame] {level}" if level != "INFO" else "[MixamoAFrame]"
    print(f"{prefix} {message}")


def safe_name(text: str) -> str:
    """Return an ASCII clip/file identifier safe for A-Frame and JavaScript."""
    value = re.sub(r"[^A-Za-z0-9_-]+", "_", text.strip())
    value = re.sub(r"_+", "_", value).strip("_-")
    return value or "Animation"


def canonical_bone_name(name: str) -> str:
    """Ignore arbitrary Mixamo namespace prefixes when comparing bones."""
    return name.rsplit(":", 1)[-1]


def clear_scene() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)

    for datablocks in (bpy.data.armatures, bpy.data.meshes):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def import_fbx(filepath: Path, *, use_anim: bool) -> tuple[list, list]:
    """Import with settings that preserve the original Mixamo skeleton."""
    before_objects = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)

    result = bpy.ops.import_scene.fbx(
        filepath=str(filepath),
        use_anim=use_anim,
        global_scale=1.0,
        bake_space_transform=False,
        automatic_bone_orientation=False,
        ignore_leaf_bones=False,
        force_connect_children=False,
        use_prepost_rot=True,
        axis_forward="-Z",
        axis_up="Y",
        use_image_search=True,
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"FBX import did not finish: {sorted(result)}")

    new_objects = [obj for obj in bpy.data.objects if obj not in before_objects]
    new_actions = [action for action in bpy.data.actions if action not in before_actions]
    return new_objects, new_actions


def choose_armature(objects: Iterable) -> object | None:
    armatures = [obj for obj in objects if obj.type == "ARMATURE"]
    return max(armatures, key=lambda obj: len(obj.data.bones), default=None)


def assigned_action(obj) -> object | None:
    if obj and obj.animation_data:
        return obj.animation_data.action
    return None


def assigned_action_slot(obj) -> object | None:
    if obj and obj.animation_data:
        return getattr(obj.animation_data, "action_slot", None)
    return None


def iter_action_channelbags(action, slot=None) -> Iterator:
    """Yield Blender 5.x channelbags, optionally for one Action Slot."""
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                if slot is None or bag.slot == slot:
                    yield bag


def iter_action_fcurves(action, slot=None) -> Iterator:
    """Yield F-Curves through the Blender 5.x layer/strip/channelbag model."""
    yielded = False
    for bag in iter_action_channelbags(action, slot):
        yielded = True
        yield from bag.fcurves

    # Compatibility fallback for legacy actions opened by older Blender builds.
    if not yielded and hasattr(action, "fcurves"):
        yield from action.fcurves


def rename_action_groups(action, bone_map: dict[str, str], slot=None) -> None:
    for bag in iter_action_channelbags(action, slot):
        for group in bag.groups:
            target_name = bone_map.get(group.name)
            if target_name:
                group.name = target_name


def remap_action_bones(
    action,
    bone_map: dict[str, str],
    slot=None,
) -> tuple[int, set[str], int]:
    """Rewrite Mixamo namespaces in Blender 5.x F-Curve data paths.

    Curves for genuinely absent bones are removed from their channelbag so the
    retained action contains no paths that fail against AvatarRig.
    """
    changed = 0
    unresolved: set[str] = set()
    dropped = 0

    channelbags = list(iter_action_channelbags(action, slot))
    if channelbags:
        for bag in channelbags:
            for fcurve in list(bag.fcurves):
                match = _BONE_PATH_RE.search(fcurve.data_path)
                if not match:
                    continue
                old_name = match.group(1)
                new_name = bone_map.get(old_name)
                if not new_name:
                    unresolved.add(old_name)
                    bag.fcurves.remove(fcurve)
                    dropped += 1
                    continue
                if new_name != old_name:
                    fcurve.data_path = _BONE_PATH_RE.sub(
                        f'pose.bones["{new_name}"]',
                        fcurve.data_path,
                    )
                    changed += 1
    else:
        # Legacy compatibility path; Blender 5.2 imports layered actions.
        for fcurve in iter_action_fcurves(action, slot):
            match = _BONE_PATH_RE.search(fcurve.data_path)
            if not match:
                continue
            old_name = match.group(1)
            new_name = bone_map.get(old_name)
            if not new_name:
                unresolved.add(old_name)
                continue
            if new_name != old_name:
                fcurve.data_path = _BONE_PATH_RE.sub(
                    f'pose.bones["{new_name}"]',
                    fcurve.data_path,
                )
                changed += 1

    rename_action_groups(action, bone_map, slot)
    return changed, unresolved, dropped


def canonical_index(rig) -> dict[str, str]:
    result: dict[str, str] = {}
    duplicates: set[str] = set()
    for bone in rig.data.bones:
        canonical = canonical_bone_name(bone.name)
        if canonical in result:
            duplicates.add(canonical)
        else:
            result[canonical] = bone.name
    if duplicates:
        raise RuntimeError(
            "Rig has duplicate canonical bone names: "
            + ", ".join(sorted(duplicates))
        )
    return result


def build_bone_map(temp_rig, target_rig) -> tuple[dict[str, str], list[str], float, list[str]]:
    target_by_canonical = canonical_index(target_rig)
    animation_canonical = {
        canonical_bone_name(bone.name) for bone in temp_rig.data.bones
    }
    missing_core = sorted(CORE_BONES - animation_canonical)

    bone_map: dict[str, str] = {}
    unmatched: list[str] = []
    for bone in temp_rig.data.bones:
        target_name = target_by_canonical.get(canonical_bone_name(bone.name))
        if target_name:
            bone_map[bone.name] = target_name
        else:
            unmatched.append(bone.name)

    ratio = len(bone_map) / max(1, len(temp_rig.data.bones))
    return bone_map, unmatched, ratio, missing_core


def _same_slot(left, right) -> bool:
    if left is None or right is None:
        return False
    try:
        return left.as_pointer() == right.as_pointer()
    except Exception:
        return left == right


def choose_suitable_slot(suitable_slots: Iterable, preferred=None):
    slots = list(suitable_slots)
    if not slots:
        return None
    if preferred is not None:
        match = next((slot for slot in slots if _same_slot(slot, preferred)), None)
        if match is not None:
            return match
    return slots[0]


def ensure_action_usable_on_rig(rig, action, preferred_slot=None):
    animation_data = rig.animation_data_create()
    animation_data.action = action
    suitable = getattr(animation_data, "action_suitable_slots", [])
    chosen = choose_suitable_slot(suitable, preferred_slot)
    if chosen is None:
        raise RuntimeError(f"Action {action.name} has no slot suitable for AvatarRig")
    animation_data.action_slot = chosen
    try:
        chosen.name_display = rig.name
    except Exception:
        pass
    return animation_data, chosen


def stash_action_on_nla(rig, action, preferred_slot=None):
    animation_data, assigned_slot = ensure_action_usable_on_rig(
        rig,
        action,
        preferred_slot,
    )
    start = int(math.floor(action.frame_range[0]))
    track = animation_data.nla_tracks.new()
    track.name = action.name
    strip = track.strips.new(action.name, start, action)
    strip.name = action.name

    chosen = choose_suitable_slot(
        getattr(strip, "action_suitable_slots", []),
        assigned_slot,
    )
    if chosen is None:
        raise RuntimeError(f"NLA strip {action.name} has no suitable Action Slot")
    strip.action_slot = chosen

    # Muted stash tracks keep clips discoverable without playing them together.
    track.mute = True
    animation_data.action = None
    return track


def remove_objects(objects: Iterable) -> None:
    for obj in list(objects):
        if obj.name not in bpy.data.objects:
            continue
        data = obj.data if obj.type in {"ARMATURE", "MESH"} else None
        obj_type = obj.type
        bpy.data.objects.remove(obj, do_unlink=True)
        if data is not None and data.users == 0:
            if obj_type == "ARMATURE":
                bpy.data.armatures.remove(data)
            elif obj_type == "MESH":
                bpy.data.meshes.remove(data)


def remove_actions(actions: Iterable, keep: Iterable | None = None) -> None:
    keep_pointers = {action.as_pointer() for action in (keep or [])}
    for action in list(actions):
        if action.as_pointer() in keep_pointers:
            continue
        if action.name in bpy.data.actions:
            bpy.data.actions.remove(action)


def rig_height(rig) -> float:
    if not rig.data.bones:
        return 1.0
    z_values = []
    for bone in rig.data.bones:
        z_values.extend((bone.head_local.z, bone.tail_local.z))
    return max(1e-6, max(z_values) - min(z_values))


def detect_root_motion(action, slot, hips_name: str, threshold: float) -> dict:
    path = f'pose.bones["{hips_name}"].location'
    curves = {
        fcurve.array_index: fcurve
        for fcurve in iter_action_fcurves(action, slot)
        if fcurve.data_path == path and 0 <= fcurve.array_index <= 2
    }
    if not curves:
        return {
            "detected": False,
            "max_displacement": 0.0,
            "end_displacement": 0.0,
            "threshold": round(threshold, 6),
        }

    frame_start, frame_end = action.frame_range
    sample_frames = {float(frame_start), float(frame_end)}
    for curve in curves.values():
        sample_frames.update(float(point.co.x) for point in curve.keyframe_points)

    def vector_at(frame: float) -> tuple[float, float, float]:
        return tuple(
            float(curves[index].evaluate(frame)) if index in curves else 0.0
            for index in range(3)
        )

    origin = vector_at(float(frame_start))

    def distance(point: tuple[float, float, float]) -> float:
        return math.sqrt(sum((point[index] - origin[index]) ** 2 for index in range(3)))

    max_displacement = max(distance(vector_at(frame)) for frame in sample_frames)
    end_displacement = distance(vector_at(float(frame_end)))
    return {
        "detected": max_displacement > threshold,
        "max_displacement": round(max_displacement, 6),
        "end_displacement": round(end_displacement, 6),
        "threshold": round(threshold, 6),
    }


def import_animation(anim_path: Path, category: str, target_rig) -> dict:
    log(f"Processing {category}/{anim_path.name}")
    new_objects: list = []
    new_actions: list = []
    retained_action = None

    try:
        new_objects, new_actions = import_fbx(anim_path, use_anim=True)
        temp_rig = choose_armature(new_objects)
        if temp_rig is None:
            raise RuntimeError("No armature found in animation FBX")

        action = assigned_action(temp_rig)
        source_slot = assigned_action_slot(temp_rig)
        if action is None:
            if len(new_actions) == 1:
                action = new_actions[0]
            else:
                raise RuntimeError(
                    f"No assigned Action found; imported Actions={len(new_actions)}"
                )

        bone_map, unmatched, ratio, missing_core = build_bone_map(
            temp_rig,
            target_rig,
        )
        log(
            f"Bone Match: {len(bone_map)}/{len(temp_rig.data.bones)} "
            f"({ratio:.1%})"
        )
        if ratio < MIN_BONE_MATCH_RATIO:
            raise RuntimeError(
                f"Skeleton compatibility {ratio:.1%} is below "
                f"{MIN_BONE_MATCH_RATIO:.0%}; unmatched: {', '.join(unmatched[:10])}"
            )
        if missing_core:
            raise RuntimeError(
                "Animation is missing required core bones: "
                + ", ".join(missing_core)
            )

        clip_name = f"{category.upper()}_{safe_name(anim_path.stem)}"
        existing = bpy.data.actions.get(clip_name)
        if existing is not None and existing != action:
            raise RuntimeError(f"Duplicate generated clip name: {clip_name}")

        action.name = clip_name
        action.use_fake_user = True
        action.use_frame_range = True
        action.frame_range = tuple(action.curve_frame_range)

        changed, unresolved, dropped = remap_action_bones(
            action,
            bone_map,
            source_slot,
        )
        stash_action_on_nla(target_rig, action, source_slot)
        retained_action = action

        target_bones = canonical_index(target_rig)
        height = rig_height(target_rig)
        root_motion = detect_root_motion(
            action,
            source_slot,
            target_bones["Hips"],
            threshold=height * 0.01,
        )

        frame_start, frame_end = action.frame_range
        fps = bpy.context.scene.render.fps / bpy.context.scene.render.fps_base
        warnings = []
        if unmatched:
            warnings.append(f"{len(unmatched)} animation bones were unmatched")
        if unresolved:
            warnings.append(
                f"Dropped {dropped} F-Curves for {len(unresolved)} absent bones"
            )
        if root_motion["detected"]:
            warnings.append("Significant Hips translation detected; root motion preserved")

        result = {
            "name": clip_name,
            "category": category,
            "source": anim_path.name,
            "frame_start": float(frame_start),
            "frame_end": float(frame_end),
            "fps": round(fps, 6),
            "duration_seconds": round((frame_end - frame_start) / fps, 6),
            "bone_match_ratio": round(ratio, 6),
            "matched_bones": len(bone_map),
            "animation_bones": len(temp_rig.data.bones),
            "remapped_fcurves": changed,
            "dropped_fcurves": dropped,
            "unmatched_bones": unmatched,
            "unresolved_action_bones": sorted(unresolved),
            "root_motion": root_motion,
            "warnings": warnings,
        }
        log(
            f"OK {clip_name}: remapped={changed}, "
            f"frames={frame_start:.0f}-{frame_end:.0f}"
        )
        return result
    finally:
        remove_objects(new_objects)
        remove_actions(new_actions, keep={retained_action} if retained_action else None)


def validate_character_scene(character_objects: Iterable, target_rig) -> dict:
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if armatures != [target_rig]:
        names = ", ".join(sorted(obj.name for obj in armatures))
        raise RuntimeError(f"Character import must contain one armature; found: {names}")

    meshes = [
        obj
        for obj in character_objects
        if obj.name in bpy.data.objects and obj.type == "MESH"
    ]
    skinned = []
    for mesh in meshes:
        if any(
            modifier.type == "ARMATURE" and modifier.object == target_rig
            for modifier in mesh.modifiers
        ):
            skinned.append(mesh)
    if not meshes:
        raise RuntimeError("Character FBX contains no mesh objects")
    if not skinned:
        raise RuntimeError("Character meshes are not skinned to the main armature")

    return {
        "mesh_count": len(meshes),
        "skinned_mesh_count": len(skinned),
        "material_count": len(bpy.data.materials),
        "image_count": len(bpy.data.images),
    }


def select_character_objects(character_objects: Iterable, target_rig) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in character_objects:
        if obj.name in bpy.data.objects:
            obj.select_set(True)
    target_rig.select_set(True)
    bpy.context.view_layer.objects.active = target_rig


def write_manifest(path: Path, manifest: dict) -> None:
    path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def export_glb(glb_path: Path, character_objects: Iterable, target_rig) -> None:
    select_character_objects(character_objects, target_rig)
    result = bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_image_format="WEBP",
        export_image_quality=82,
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_merge_animation="ACTION",
        export_anim_single_armature=True,
        export_nla_strips=True,
        export_reset_pose_bones=True,
        export_force_sampling=True,
        export_skins=True,
        export_all_influences=False,
        export_morph=True,
        export_morph_animation=True,
        export_frame_range=False,
        export_yup=True,
    )
    if "FINISHED" not in result or not glb_path.is_file():
        raise RuntimeError(f"GLB export failed: {sorted(result)}")


def build(character_path: str | Path) -> dict:
    character_path = Path(character_path).resolve()
    if not character_path.is_file():
        raise FileNotFoundError(character_path)
    if character_path.suffix.lower() != ".fbx":
        raise RuntimeError("Selected character must be an FBX file")
    if character_path.parent.name.lower() != "characters":
        raise RuntimeError("Select a character FBX inside the 'characters' folder")
    if bpy.app.version < (5, 2, 0):
        raise RuntimeError(
            f"Blender 5.2+ is required; current version is {bpy.app.version_string}"
        )

    root = character_path.parent.parent
    output_dir = root / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    log(f"Script: {SCRIPT_VERSION}")
    log(f"Blender: {bpy.app.version_string}")
    log(f"Character: {character_path.name}")
    log("Current scene will be cleared")
    clear_scene()

    character_objects, character_actions = import_fbx(character_path, use_anim=True)
    target_rig = choose_armature(character_objects)
    if target_rig is None:
        raise RuntimeError("No armature found in character FBX")

    target_rig.name = "AvatarRig"
    target_rig.data.name = "AvatarRig"
    if target_rig.animation_data:
        target_rig.animation_data.action = None
    remove_actions(character_actions)

    scene_info = validate_character_scene(character_objects, target_rig)
    target_index = canonical_index(target_rig)
    missing_character_core = sorted(CORE_BONES - set(target_index))
    if missing_character_core:
        raise RuntimeError(
            "Character is missing required core bones: "
            + ", ".join(missing_character_core)
        )

    log(f"Main Rig: {target_rig.name}")
    log(f"Character Bones: {len(target_rig.data.bones)}")
    log(
        f"Meshes: {scene_info['mesh_count']} "
        f"(skinned: {scene_info['skinned_mesh_count']})"
    )

    manifest = {
        "schema_version": 1,
        "builder_version": SCRIPT_VERSION,
        "blender_version": bpy.app.version_string,
        "character": character_path.name,
        "rig": target_rig.name,
        "bone_count": len(target_rig.data.bones),
        "canonical_bones": sorted(target_index),
        **scene_info,
        "animations": [],
        "errors": [],
        "warnings": [],
    }

    max_end = 1.0
    for category in CATEGORIES:
        folder = root / category
        if not folder.is_dir():
            warning = f"Missing animation folder: {category}/"
            log(warning, "WARNING")
            manifest["warnings"].append(warning)
            continue

        files = sorted(folder.glob("*.fbx"), key=lambda path: path.name.lower())
        log(f"{category}: {len(files)} FBX files")
        for anim_path in files:
            try:
                info = import_animation(anim_path, category, target_rig)
                manifest["animations"].append(info)
                max_end = max(max_end, info["frame_end"])
            except Exception as exc:
                message = str(exc)
                log(f"{category}/{anim_path.name}: {message}", "ERROR")
                manifest["errors"].append(
                    {
                        "category": category,
                        "source": anim_path.name,
                        "error": message,
                    }
                )

    if not manifest["animations"]:
        raise RuntimeError("No animations were successfully imported")

    remaining_armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if remaining_armatures != [target_rig]:
        raise RuntimeError("Temporary animation armatures remain after processing")

    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = max(1, int(math.ceil(max_end)))
    bpy.context.scene.frame_set(1)
    target_rig.data.pose_position = "POSE"
    for pose_bone in target_rig.pose.bones:
        pose_bone.matrix_basis.identity()

    try:
        bpy.ops.file.pack_all()
    except Exception as exc:
        warning = f"Texture packing warning: {exc}"
        log(warning, "WARNING")
        manifest["warnings"].append(warning)

    basename = safe_name(character_path.stem)
    blend_path = output_dir / f"{basename}_avatar_master.blend"
    glb_path = output_dir / f"{basename}_avatar.glb"
    manifest_path = output_dir / f"{basename}_animations.json"

    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    export_glb(glb_path, character_objects, target_rig)

    manifest["outputs"] = {
        "blend": blend_path.name,
        "glb": glb_path.name,
        "manifest": manifest_path.name,
        "glb_bytes": glb_path.stat().st_size,
    }
    write_manifest(manifest_path, manifest)

    log("=" * 72)
    log(f"DONE: {len(manifest['animations'])} animations")
    log(f"Errors: {len(manifest['errors'])}")
    log(f"BLEND: {blend_path}")
    log(f"GLB:   {glb_path}")
    log(f"JSON:  {manifest_path}")
    log("=" * 72)
    return manifest


class VRSTANDUP_OT_build_mixamo(bpy.types.Operator, ImportHelper):
    """Build one Mixamo character and all clips into an A-Frame GLB"""

    bl_idname = "vrstandup.build_mixamo_aframe"
    bl_label = "Build Mixamo Avatar for A-Frame"
    bl_options = {"REGISTER"}

    filename_ext = ".fbx"
    filter_glob: StringProperty(
        default="*.fbx",
        options={"HIDDEN"},
        maxlen=255,
    )

    def execute(self, _context):
        try:
            manifest = build(self.filepath)
            self.report(
                {"INFO"},
                f"Built {len(manifest['animations'])} clips; "
                f"{len(manifest['errors'])} errors. See output/.",
            )
            return {"FINISHED"}
        except Exception as exc:
            traceback.print_exc()
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}


def register() -> None:
    try:
        bpy.utils.unregister_class(VRSTANDUP_OT_build_mixamo)
    except Exception:
        pass
    bpy.utils.register_class(VRSTANDUP_OT_build_mixamo)


def cli_character_path() -> str | None:
    if "--" not in sys.argv:
        return None
    args = sys.argv[sys.argv.index("--") + 1 :]
    return args[0] if args else None


if __name__ == "__main__":
    selected_path = cli_character_path()
    if bpy.app.background:
        if not selected_path:
            raise SystemExit(
                "Headless usage requires: -- <characters/Character.fbx>"
            )
        build(selected_path)
    else:
        register()
        bpy.ops.vrstandup.build_mixamo_aframe("INVOKE_DEFAULT")
