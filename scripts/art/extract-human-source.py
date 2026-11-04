"""Extract original anatomy, skin weights and sampled animation. Archive stays read-only.
Blender is used for decoding textures/rigs; runtime export normalizes bone axes.
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2];BASE=ROOT/'archive/legacy-2026-10-30/project/public/avatars/active';OUT=ROOT/'local_assets/models/human-v3';OUT.mkdir(parents=True,exist_ok=True)
FILES=['audience/male-ch23','audience/female-ch07','audience/male-ch31','audience/female-ch21','performers/female-ch02','performers/male-ch06']
# Blender Z-up/front -Y to runtime Y-up/front -Z.
C=Matrix(((-1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))
def name(s):return s.split(':')[-1]
for file in FILES:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for a in list(bpy.data.actions):bpy.data.actions.remove(a)
    bpy.ops.import_scene.gltf(filepath=str(BASE/(file+'.glb')))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
    for o in bpy.context.scene.objects:
        if o.animation_data:
            o.animation_data.action=None
            for t in o.animation_data.nla_tracks:t.mute=True
    for p in rig.pose.bones:p.matrix_basis.identity()
    bpy.context.view_layer.update()
    rest={name(b.name):C@rig.matrix_world@b.matrix_local for b in rig.data.bones}
    pts=[C@o.matrix_world@v.co for o in meshes for v in o.data.vertices]
    floor=min(p.y for p in pts);height=max(p.y for p in pts)-floor;scale=1.78/height
    bones=[{'name':name(b.name),'parent':name(b.parent.name) if b.parent else None,'position':[(rest[name(b.name)].translation[i]-(floor if i==1 else 0))*scale for i in range(3)]} for b in rig.data.bones]
    parts=[];materials=[]
    for o in meshes:
        geo=o.data;geo.calc_loop_triangles();transform=C@o.matrix_world
        material_ids=[]
        for mat in geo.materials:
            bs=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if mat and mat.use_nodes else None
            tex=bs.inputs['Base Color'].links[0].from_node if bs and bs.inputs['Base Color'].links else None
            image=tex.image if tex and tex.type=='TEX_IMAGE' else None
            entry={'name':o.name+'_'+str(len(materials)),'image':None,'color':[1,1,1,1]}
            # Preserve facial paint, iris and hair details. Repaint clothing with a warm matte palette.
            palette={'Suit':(.38,.19,.105,1),'Pants':(.18,.235,.16,1),'Sweater':(.23,.33,.28,1),'Shirt':(.73,.65,.48,1),'Cloth':(.52,.28,.17,1),'Shoes':(.55,.49,.38,1),'Sneakers':(.6,.55,.44,1),'Heels':(.24,.20,.16,1),'Socks':(.45,.42,.32,1),'Belt':(.1,.07,.045,1),'Collar':(.7,.64,.52,1)}
            solid=next((v for k,v in palette.items() if k in o.name),None)
            if solid:entry['color']=solid
            elif image:
                dest=OUT/(file.split('/')[-1]+'-'+str(len(materials))+'.png')
                image.filepath_raw=str(dest);image.file_format='PNG';image.save();entry['image']=dest.name
            material_ids.append(len(materials));materials.append(entry)
        groups={v.index:sorted([(name(o.vertex_groups[g.group].name),g.weight) for g in v.groups if name(o.vertex_groups[g.group].name) in rest],key=lambda g:-g[1])[:4] for v in geo.vertices}
        for mi,mid in enumerate(material_ids):
            vertices={};p=[];n=[];uv=[];weights=[];indices=[]
            for tri in geo.loop_triangles:
                if tri.material_index!=mi:continue
                for li in tri.loops:
                    loop=geo.loops[li];v=geo.vertices[loop.vertex_index];texcoord=geo.uv_layers.active.data[li].uv if geo.uv_layers.active else (0,0)
                    key=(v.index,round(texcoord[0],6),round(texcoord[1],6))
                    if key not in vertices:
                        vertices[key]=len(p)//3;point=transform@v.co;normal=transform.to_3x3().inverted().transposed()@v.normal;normal.normalize()
                        p.extend([(point[i]-(floor if i==1 else 0))*scale for i in range(3)]);n.extend(normal);uv.extend([texcoord[0],1-texcoord[1]]);weights.append(groups[v.index])
                    indices.append(vertices[key])
            if p:parts.append({'name':o.name,'material':mid,'position':p,'normal':n,'uv':uv,'weights':weights,'index':indices})
    animations=[]
    for action in list(bpy.data.actions):
        rig.animation_data.action=action
        if action.slots:rig.animation_data.action_slot=action.slots[0]
        start,end=action.frame_range;duration=(end-start)/bpy.context.scene.render.fps
        if duration<=0:continue
        count=math.ceil(duration*20)+1;frames=[]
        for i in range(count):
            frame=start+(end-start)*i/(count-1);bpy.context.scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update()
            framebones={}
            for pb in rig.pose.bones:
                key=name(pb.name);posed=C@rig.matrix_world@pb.matrix
                q=(posed.to_quaternion()@rest[key].to_quaternion().inverted()).normalized()
                point=posed.translation
                framebones[key]={'q':[q.x,q.y,q.z,q.w],'p':[(point[k]-(floor if k==1 else 0))*scale for k in range(3)]}
            frames.append(framebones)
        animations.append({'name':action.name,'duration':duration,'frames':frames})
    data={'source':file,'height':1.78,'bones':bones,'parts':parts,'materials':materials,'animations':animations}
    (OUT/(file.split('/')[-1]+'.json')).write_text(json.dumps(data,separators=(',',':')))
    print('EXTRACTED',file,len(parts),len(bones),[(a['name'],len(a['frames'])) for a in animations],flush=True)
