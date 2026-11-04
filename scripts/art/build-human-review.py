"""Create an editable rigged Blender deliverable from the exact shipped GLB."""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'local_assets/models/human-v3'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/study/club/v1/models/actor.glb'))
bpy.context.scene.frame_set(24)
print('ACTIONS',[(a.name,len(a.slots)) for a in bpy.data.actions])
for o in bpy.context.scene.objects:
    if o.type=='ARMATURE':
        print('ARMATURE',o.name,'ACTION',o.animation_data.action.name if o.animation_data and o.animation_data.action else None)

def point(o,p): o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size in [('Key',(-3,4,5),500,4),('Fill',(3,2,3),220,3),('Rim',(0,-3,4),380,3)]:
    light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size
    o=bpy.data.objects.new(name,light);bpy.context.collection.objects.link(o);o.location=pos;point(o,(0,0,1))
floor=bpy.data.materials.new('Warm studio');floor.diffuse_color=(.64,.58,.48,1)
bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.name='Studio floor';bpy.context.object.data.materials.append(floor)
world=bpy.context.scene.world;world.use_nodes=True
bg=next((n for n in world.node_tree.nodes if n.type=='BACKGROUND'),None)
if bg: bg.inputs['Color'].default_value=(.55,.50,.43,1);bg.inputs['Strength'].default_value=.45
camera=bpy.data.cameras.new('Portrait camera');cam=bpy.data.objects.new('Portrait camera',camera);bpy.context.collection.objects.link(cam)
cam.location=(2.3,4.5,2.1);point(cam,(0,0,.92));camera.type='ORTHO';camera.ortho_scale=2.18;bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
# Use the embedded animation in Blender. Keep the armature, morphs, materials and NLA editable.
for area in bpy.context.screen.areas if bpy.context.screen else []:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=3.2;area.spaces.active.region_3d.view_location=(0,0,.95)
        area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'actor-rigged-review.blend'))
scene.render.filepath=str(ROOT/'output/art-review-v3/blender-actor.png');bpy.ops.render.render(write_still=True)
print('RIGGED_REVIEW_COMPLETE')
