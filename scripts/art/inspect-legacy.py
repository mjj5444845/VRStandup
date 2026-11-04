"""Read-only anatomy/animation inspection of archived avatars."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'archive/legacy-2026-10-30/project/public/avatars/active'
OUT=ROOT/'output/art-review-v3'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
report=[]
for i,name in enumerate(['performers/male-ch06','performers/female-ch02','audience/female-ch07','audience/female-ch21','audience/male-ch23','audience/male-ch31']):
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(BASE/(name+'.glb')))
    obs=set(bpy.data.objects)-before
    for o in obs:
        if o.animation_data:
            o.animation_data.action=None
            for track in o.animation_data.nla_tracks:track.mute=True
    rig=next(o for o in obs if o.type=='ARMATURE')
    for p in rig.pose.bones:p.matrix_basis.identity()
    bpy.context.view_layer.update()
    pts=[o.matrix_world@Vector(v) for o in obs if o.type=='MESH' for v in o.bound_box]
    low=min(p.z for p in pts);height=max(p.z for p in pts)-low
    parent=bpy.data.objects.new('Inspect '+name,None);bpy.context.collection.objects.link(parent)
    for o in obs:
        if o.parent not in obs:o.parent=parent
    parent.scale=(1.75/height,)*3;parent.location=(i*1.5-3.75,0,-low*1.75/height)
    for o in obs:
        if o.type=='MESH':
            for m in o.data.materials:
                if m and m.use_nodes:
                    bs=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
                    if bs:
                        for k,v in [('Metallic',0),('Roughness',.8)]:
                            for link in list(bs.inputs[k].links):m.node_tree.links.remove(link)
                            bs.inputs[k].default_value=v
    report.append({'name':name,'height':height,'objects':[o.name for o in obs if o.type=='MESH'],'bones':len(rig.data.bones)})
def point(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for pos,power in [((-3,-4,6),1800),((4,-2,4),1200)]:
    d=bpy.data.lights.new('Studio','AREA');d.energy=power;d.shape='DISK';d.size=6;o=bpy.data.objects.new('Studio',d);bpy.context.collection.objects.link(o);o.location=pos;point(o,(0,0,1))
bpy.ops.mesh.primitive_plane_add(size=200)
c=bpy.data.cameras.new('Inspection');o=bpy.data.objects.new('Inspection',c);bpy.context.collection.objects.link(o);o.location=(0,-12,3);point(o,(0,0,.95));c.type='ORTHO';c.ortho_scale=10;bpy.context.scene.camera=o
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=16;s.render.resolution_x=1800;s.render.resolution_y=650;s.render.resolution_percentage=100;s.world.color=(.3,.3,.3);s.render.filepath=str(OUT/'legacy-lineup.png')
(OUT/'legacy-inspection.json').write_text(json.dumps(report,indent=2))
bpy.ops.render.render(write_still=True)
