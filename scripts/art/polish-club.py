"""Author editable, bevelled stage access and finish details in Blender (Y-up inputs)."""
import bpy
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'local_assets/models/scene-polish-v4'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, roughness):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    return m
wood = material('V4 smoked oak', (.19, .10, .055), .84)
brass = material('V4 muted brass', (.36, .25, .12), .65)

def box(name, pos, size, mat, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(pos[0], -pos[2], pos[1]))
    o = bpy.context.object
    o.name = name
    o.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod = o.modifiers.new('Soft edge', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

box('StageWing', (4, .18, -4.17), (1.6, .36, 1.94), wood)
box('StageStepUpper', (4, .12, -3.05), (1.6, .24, .3), wood)
box('StageStepLower', (4, .06, -2.75), (1.6, .12, .3), wood)
# Small nosings remain attached to the steps, with no luminous strip or animation.
box('StepNosingUpper', (4, .236, -2.919), (1.5, .008, .028), brass, .002)
box('StepNosingLower', (4, .116, -2.619), (1.5, .008, .028), brass, .002)
slat = box('ApronFlute_00', (-3.05, .16, -2.632), (.032, .25, .025), wood, .003)
for i in range(1, 41):
    o = slat.copy()
    o.data = slat.data
    o.name = f'ApronFlute_{i:02}'
    o.location.x = -3.05 + i * .1525
    bpy.context.collection.objects.link(o)
# One shared profile keeps repeated details batchable in Three.js.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'stage-details.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'stage-details.glb'), export_format='GLB', export_animations=False, export_cameras=False, export_lights=False)
print('POLISH_DETAILS_COMPLETE')
