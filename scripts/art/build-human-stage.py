"""Editable stage inspection project: shipped geometry and authored sitting actions."""
import bpy
import json
import math
import argparse
import sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--output',default='local_assets/models/human-v3/club-stage-review.blend')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
output=ROOT/args.output
output.parent.mkdir(parents=True,exist_ok=True)
BASE=ROOT/'public/study/club/v1'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(BASE/'models/scene-empty.glb'))
for o in bpy.context.scene.objects:
    if o.name in ['RoomCeiling','FrontWallSegment','FrontWallSegment.001','FrontDoorHeader']:
        o.hide_render=True;o.hide_set(True)

def character(asset,name,position,yaw,action):
    previous=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(BASE/'models'/f'{asset}.glb'))
    objects=set(bpy.context.scene.objects)-previous
    anchor=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(anchor)
    for o in objects:
        if o.parent not in objects: o.parent=anchor
        if o.animation_data:
            data=o.animation_data;data.action=None
            for track in data.nla_tracks: track.mute=not track.name.startswith(action)
    anchor.location=(position[0],-position[2],position[1]);anchor.rotation_euler.z=yaw
    return anchor

character('actor','Performer anchor',(0,.36,-3.78),math.pi,'standing-idle')
layout=json.loads((BASE/'scene-layout.json').read_text(encoding='utf8'))
for i,seat in enumerate(layout['seats']):
    if i==1: continue
    character(f'audience-0{i%5+1}',f'Audience seat {i+1}',seat['position'],0,'seated-idle')
scene=bpy.context.scene;scene.frame_set(24)
def light(name,pos,power,size,target):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
light('Stage softbox',(0,1.8,3.35),600,4,(0,3.8,1.5))
light('Audience softbox',(0,-2,3.5),900,6,(0,0,0))
scene.world.color=(.18,.16,.12)
data=bpy.data.cameras.new('Stage inspection');cam=bpy.data.objects.new('Stage inspection',data);bpy.context.collection.objects.link(cam);cam.location=(7,-8,7)
cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=15;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
for area in bpy.context.screen.areas if bpy.context.screen else []:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=15;area.spaces.active.region_3d.view_location=(0,0,1)
        area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(output))
print('EDITABLE_STAGE_COMPLETE',len(bpy.context.scene.objects))
