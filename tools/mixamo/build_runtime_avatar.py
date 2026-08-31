"""Create a lightweight WebXR runtime GLB from a full Mixamo pipeline GLB.

Run with Blender 5.2+:

  blender --factory-startup --background --python tools/mixamo/build_runtime_avatar.py -- \
    source.glb destination.glb --max-texture 1024 --quality 78

Use ``--clip SIT_Sitting_Idle1`` for an audience-only asset. The source GLB is
never modified; this script is the reproducible boundary between local master
assets and files that are allowed into ``public/avatars/active``.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    if "--" not in sys.argv:
        raise SystemExit("Pass arguments after --")
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--max-texture", type=int, default=1024)
    parser.add_argument("--quality", type=int, default=78)
    parser.add_argument("--clip", action="append", default=[])
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.actions,
        bpy.data.armatures,
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.images,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def resize_images(max_texture: int) -> list[dict[str, object]]:
    resized: list[dict[str, object]] = []
    for image in bpy.data.images:
        width, height = image.size
        if width <= 0 or height <= 0:
            continue
        scale = min(1.0, max_texture / max(width, height))
        target_width = max(1, int(math.floor(width * scale)))
        target_height = max(1, int(math.floor(height * scale)))
        if (target_width, target_height) != (width, height):
            image.scale(target_width, target_height)
        resized.append(
            {
                "name": image.name,
                "source": [width, height],
                "runtime": [target_width, target_height],
            }
        )
    return resized


def retain_clips(names: list[str]) -> list[str]:
    available = {action.name: action for action in bpy.data.actions}
    if not names:
        return sorted(available)

    missing = sorted(set(names) - set(available))
    if missing:
        raise RuntimeError(f"Missing requested clips: {', '.join(missing)}")

    keep = set(names)
    for obj in bpy.data.objects:
        if obj.animation_data:
            obj.animation_data.action = None
            for track in list(obj.animation_data.nla_tracks):
                obj.animation_data.nla_tracks.remove(track)
    for action in list(bpy.data.actions):
        if action.name not in keep:
            bpy.data.actions.remove(action)
    return sorted(action.name for action in bpy.data.actions)


def main() -> None:
    args = parse_args()
    source = args.source.resolve()
    destination = args.destination.resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    if not 64 <= args.max_texture <= 4096:
        raise ValueError("--max-texture must be between 64 and 4096")
    if not 1 <= args.quality <= 100:
        raise ValueError("--quality must be between 1 and 100")

    clear_scene()
    result = bpy.ops.import_scene.gltf(filepath=str(source))
    if "FINISHED" not in result:
        raise RuntimeError(f"Unable to import {source}")

    retained_clips = retain_clips(args.clip)
    textures = resize_images(args.max_texture)
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    if len(armatures) != 1 or not meshes:
        raise RuntimeError(
            f"Expected one armature and at least one mesh; got {len(armatures)} / {len(meshes)}"
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    export_result = bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_format="GLB",
        export_image_format="WEBP",
        export_image_quality=args.quality,
        use_selection=True,
        export_animations=bool(retained_clips),
        export_animation_mode="ACTIONS",
        export_merge_animation="ACTION",
        export_anim_single_armature=True,
        export_force_sampling=True,
        export_skins=True,
        export_all_influences=False,
        export_morph=True,
        export_morph_animation=True,
        export_yup=True,
    )
    if "FINISHED" not in export_result or not destination.is_file():
        raise RuntimeError(f"Unable to export {destination}")

    report = {
        "source": source.name,
        "destination": destination.name,
        "blender_version": bpy.app.version_string,
        "max_texture": args.max_texture,
        "image_quality": args.quality,
        "clips": retained_clips,
        "armatures": len(armatures),
        "meshes": len(meshes),
        "textures": textures,
        "bytes": destination.stat().st_size,
    }
    report_path = destination.with_suffix(".runtime.json")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
