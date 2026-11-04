"""Blender authoring source. Run with blender --background --python this-file.

Creates editable, continuous lofted garments and sculpted heads. The separate
rigging/export step preserves the project's existing head/hand recording space.
No downloaded mesh or generated reference image is embedded in the runtime.
"""
import bpy
import bmesh
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'local_assets/models/clay-avatar-v2'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
PARTS = []
COLORS = {'skin': '#c98f70', 'hair': '#302821', 'coat': '#a84e32',
          'pants': '#59644a', 'shirt': '#ede0c4', 'shoe': '#e1d1ad',
          'sole': '#b7a78c', 'eye': '#f3e5ce', 'iris': '#49362b',
          'pupil': '#201d1b', 'lip': '#925e50', 'gold': '#bca17b'}
MATS = {}
def linear(v):
    return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4
for key, value in COLORS.items():
    rgb = [linear(int(value[i:i+2], 16)/255) for i in (1,3,5)]
    mat = bpy.data.materials.new(key); mat.diffuse_color = (*rgb,1)
    mat.use_nodes = True
    p = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) or mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    p.inputs['Base Color'].default_value = (*rgb,1)
    p.inputs['Roughness'].default_value = .68 if key == 'skin' else .82
    MATS[key] = mat

def xyz(p):
    # Author in the runtime's Y-up, -Z-facing space; Blender is Z-up.
    return (p[0], -p[2], p[1])

def finish(obj, name, color, region='body', bind='Spine', variant='all'):
    obj.name = name
    obj.data.materials.clear(); obj.data.materials.append(MATS[color])
    for face in obj.data.polygons: face.use_smooth = True
    obj['region'] = region; obj['bind'] = bind; obj['palette'] = color; obj['variant'] = variant
    PARTS.append(obj)
    return obj

def mesh(name, verts, faces, color, region='body', bind='Spine', variant='all', subdiv=1):
    data = bpy.data.meshes.new(name); data.from_pydata([xyz(v) for v in verts],[],faces); data.update()
    bm=bmesh.new(); bm.from_mesh(data); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(data); bm.free()
    obj = bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj)
    finish(obj,name,color,region,bind,variant)
    if subdiv:
        mod = obj.modifiers.new('Tailored smooth surface','SUBSURF'); mod.levels=subdiv
    return obj

def loft(name, rings, color, region='body', bind='Spine', sides=32, subdiv=1):
    # Rings: centre x,y,z; horizontal/depth radii. Quad strips share vertices.
    verts=[]
    opened=name=='Tailored jacket'
    for x,y,z,rx,rz in rings:
        for j in range(sides):
            a=(-math.pi/2+.32+j/(sides-1)*(2*math.pi-.64)) if opened else 2*math.pi*j/sides
            verts.append((x+rx*math.cos(a),y,z+rz*math.sin(a)))
    faces=[] if opened else [tuple(reversed(range(sides)))]
    for i in range(len(rings)-1):
        for j in range(sides-1 if opened else sides):
            n=(j+1)%sides; a=i*sides; b=(i+1)*sides
            faces.append((a+j,a+n,b+n,b+j))
    if not opened: faces.append(tuple((len(rings)-1)*sides+j for j in range(sides)))
    o=mesh(name,verts,faces,color,region,bind,subdiv=subdiv)
    if opened:
        mod=o.modifiers.new('Fabric thickness','SOLIDIFY');mod.thickness=.012;mod.offset=-1
    return o

def tube(name, points, radii, color, region='body', bind='Spine', sides=16, subdiv=1):
    verts=[]
    for i,p in enumerate(points):
        direction=Vector(points[min(len(points)-1,i+1)])-Vector(points[max(0,i-1)])
        direction.normalize(); across=direction.cross(Vector((0,0,1))).normalized()
        depth=across.cross(direction).normalized()
        rx,rz = radii[i] if isinstance(radii[i],tuple) else (radii[i],radii[i])
        for j in range(sides):
            a=2*math.pi*j/sides; v=Vector(p)+across*(rx*math.cos(a))+depth*(rz*math.sin(a)); verts.append(tuple(v))
    faces=[tuple(reversed(range(sides)))]
    for i in range(len(points)-1):
        for j in range(sides):
            k=(j+1)%sides; a=i*sides; b=a+sides; faces.append((a+j,b+j,b+k,a+k))
    faces.append(tuple((len(points)-1)*sides+j for j in range(sides)))
    return mesh(name,verts,faces,color,region,bind,subdiv=subdiv)

def ellipsoid(name,p,r,color,region='head',bind='Head',variant='all'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=xyz(p))
    o=bpy.context.object; o.scale=(r[0],r[2],r[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,color,region,bind,variant)

def fuse(objects,name,color,region,bind,voxel):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True); PARTS.remove(o)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join(); o=bpy.context.object
    mod=o.modifiers.new('Sculpt union','REMESH'); mod.mode='VOXEL'; mod.voxel_size=voxel; mod.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('Surface relaxation','SMOOTH'); mod.factor=1.1; mod.iterations=4
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('Runtime topology','DECIMATE'); mod.ratio=.35
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,color,region,bind)

# Continuous, tapered jacket torso with a shaped shoulder line and hem.
loft('Tailored jacket',[(0,.96,0,.145,.102),(0,.975,0,.159,.112),(0,1.07,0,.16,.113),
    (0,1.18,0,.158,.112),(0,1.30,0,.185,.12),(0,1.385,0,.192,.102),
    (0,1.425,0,.16,.085),(0,1.455,0,.058,.05)],'coat',bind='torso')
loft('Soft shirt front',[(0,.975,0,.13,.092),(0,1.05,0,.145,.099),
    (0,1.30,0,.145,.101),(0,1.39,0,.12,.073),(0,1.445,0,.046,.04)],'shirt',bind='torso')
loft('Neck',[(0,1.395,0,.049,.045),(0,1.42,0,.05,.045),(0,1.50,0,.046,.043),(0,1.535,0,.052,.047)],'skin',bind='neck')
loft('Trouser seat',[(0,.82,0,.115,.075),(0,.88,0,.15,.101),(0,1.005,0,.153,.109),(0,1.04,0,.144,.099)],'pants',bind='Hips')

for side,s in [('Left',-1),('Right',1)]:
    # One sleeve from shoulder through elbow to cuff, with blended bone weights.
    tube(side+' sculpted sleeve',[(s*.14,1.385,0),(s*.19,1.385,0),(s*.23,1.33,0),
        (s*.30,1.25,0),(s*.39,1.14,0),(s*.415,1.105,0),(s*.465,1.00,0),(s*.50,.93,0)],
        [(.060,.062),(.067,.064),(.065,.061),(.060,.056),(.053,.050),(.052,.050),(.045,.043),(.041,.039)],'coat',bind=side+'Sleeve')
    tube(side+' cuff',[(s*.487,.951,0),(s*.493,.94,0),(s*.508,.912,0)], [.046,.047,.043],'coat',bind=side+'LowerArm')
    loft(side+' trouser leg',[(s*.095,.105,0,.059,.055),(s*.095,.13,0,.065,.06),
        (s*.095,.32,.005,.067,.065),(s*.095,.49,0,.073,.067),(s*.095,.57,0,.076,.072),
        (s*.095,.79,0,.087,.08),(s*.095,.97,0,.102,.092)],'pants',bind=side+'Leg')
    loft(side+' sneaker sole',[(s*.095,.015,-.058,.061,.124),(s*.095,.025,-.058,.069,.132),
        (s*.095,.049,-.058,.069,.132),(s*.095,.058,-.058,.065,.126)],'sole',bind=side+'Foot')
    loft(side+' canvas shoe',[(s*.095,.055,-.056,.064,.123),(s*.095,.07,-.056,.064,.122),
        (s*.095,.096,-.035,.057,.095),(s*.095,.13,.005,.047,.046)],'shoe',bind=side+'Foot')
    for i in range(3):
        tube(side+' lace '+str(i),[(s*.095-.025,.105,-.075+i*.016),(s*.095,.112,-.075+i*.016),(s*.095+.025,.105,-.075+i*.016)],[.0025]*3,'shirt',bind=side+'Foot',sides=6)
    # Lapel, collar, pocket flap and stitching follow the jacket, not box patches.
    mesh(side+' collar',[(s*.04,1.46,-.031),(s*.091,1.415,-.079),(s*.077,1.341,-.139),(s*.047,1.38,-.123)],[(0,1,2,3)],'coat',bind='torso')
    tube(side+' placket',[(s*.05,.975,-.107),(s*.05,1.17,-.109),(s*.058,1.30,-.115),(s*.043,1.40,-.083)], [.005]*4,'coat',bind='torso',sides=8)
    pocket=[]
    for row in range(4):
        y=1.30-row*.022;rx=.185-(1.30-y)*.16
        for col in range(4):
            x=.088+col*.019;pocket.append((s*x,y,-.12*math.sqrt(max(.05,1-(x/rx)**2))-.003))
    mesh(side+' pocket',pocket,[(r*4+c,r*4+c+1,(r+1)*4+c+1,(r+1)*4+c) for r in range(3) for c in range(3)],'coat',bind='torso')
    tube(side+' pocket seam',[pocket[i] for i in range(4)],[.0012]*4,'gold',bind='torso',sides=6)
    # A unified palm and rounded, separated fingers (rest axis matches existing rig).
    wrist=Vector((s*.51,.91,0)); axis=Vector((s*.11,-.22,0)).normalized(); across=Vector((-axis.y,axis.x,0))*s
    palm=ellipsoid(side+' palm',tuple(wrist+axis*.038),(.034,.047,.018),'skin','left' if s<0 else 'right',side+'Hand')
    palm.rotation_euler[1]=-s*.46365
    pieces=[palm]
    for i,length in enumerate([.054,.061,.055,.043]):
        start=wrist+axis*.063+across*((i-1.5)*.016)
        points=[tuple(start),tuple(start+axis*(length*.45)+Vector((0,0,-.004))),tuple(start+axis*length+Vector((0,0,-.011)))]
        pieces.append(tube(side+' finger '+str(i),points,[.008,.007,.0055],'skin','left' if s<0 else 'right',side+'Hand',sides=10))
    start=wrist+axis*.027-across*.026
    pieces.append(tube(side+' thumb',[tuple(start),tuple(start-across*.028+axis*.012),tuple(start-across*.041+axis*.029)],[.012,.01,.006],'skin','left' if s<0 else 'right',side+'Hand',sides=10))
    # Evaluate subdivision before joining/remeshing the palm/fingers.
    for o in pieces:
        bpy.context.view_layer.objects.active=o
        for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    fuse(pieces,side+' continuous hand','skin','left' if s<0 else 'right',side+'Hand',.003)

for y in [1.08,1.145,1.21,1.275,1.34]: ellipsoid('Jacket button',( .057,y,-.117),(.003,.003,.002),'gold','body','torso')

# Head has deliberate jaw, cheek, brow and crown rings, not a spherical cranium.
head=loft('Sculpted face',[(0,1.493,-.004,.022,.026),(0,1.507,-.015,.047,.047),
    (0,1.53,-.01,.067,.063),(0,1.56,0,.083,.075),(0,1.60,.006,.094,.085),
    (0,1.64,.01,.094,.084),(0,1.68,.014,.087,.077),(0,1.711,.019,.064,.058),(0,1.73,.02,.015,.02)],'skin','head','Head',subdiv=2)
nose=ellipsoid('Nose bridge',(0,1.608,-.075),(.014,.032,.018),'skin')
tip=ellipsoid('Nose tip',(0,1.584,-.089),(.019,.013,.020),'skin')
ears=[ellipsoid('Ear '+str(s),(s*.092,1.594,.006),(.018,.031,.017),'skin') for s in [-1,1]]
bpy.context.view_layer.objects.active=head
bpy.ops.object.modifier_apply(modifier=head.modifiers[0].name)
fuse([head,nose,tip,*ears],'Continuous face and nose','skin','head','Head',.0035)
for s in [-1,1]:
    # Small embedded almond eyes, lids and soft brow arcs.
    ellipsoid('Eye '+str(s),(s*.037,1.617,-.070),(.020,.009,.005),'eye')
    ellipsoid('Iris '+str(s),(s*.035,1.617,-.074),(.006,.007,.0015),'iris')
    ellipsoid('Pupil '+str(s),(s*.035,1.617,-.0755),(.003,.004,.001),'pupil')
    ellipsoid('Eye glint '+str(s),(s*.035-.002,1.62,-.0765),(.0015,.0015,.0006),'eye')
    tube('Upper lid '+str(s),[(s*.015,1.617,-.077),(s*.028,1.627,-.078),(s*.045,1.628,-.074),(s*.058,1.618,-.067)],[.0025]*4,'skin','head','Head',sides=8)
    tube('Brow '+str(s),[(s*.016,1.644,-.077),(s*.032,1.65,-.076),(s*.049,1.647,-.07),(s*.059,1.641,-.064)],[.003,.004,.0035,.0015],'hair','head','Head',sides=8)
    ellipsoid('Ear inner '+str(s),(s*.102,1.596,-.005),(.006,.017,.006),'lip')
tube('Smile crease',[(-.029,1.555,-.071),(-.018,1.549,-.079),(0,1.548,-.082),(.018,1.549,-.079),(.029,1.555,-.071)],[.0015,.002,.002,.002,.0015],'lip','head','Head',sides=8)
tube('Lower lip',[(-.019,1.545,-.077),(0,1.541,-.079),(.019,1.545,-.077)],[.002,.003,.002],'skin','head','Head',sides=8)

# A shaped continuous hair cap, with a swept front quiff and fine sculpted ridges.
verts=[]; faces=[]; n=48
for row in range(10):
    t=row/9
    for j in range(n):
        a=2*math.pi*j/n; front=max(0,-math.sin(a)); bottom=1.59+.077*front+.018*abs(math.cos(a))
        phi=(1-t)*math.pi/2; radius=math.sin(phi)
        verts.append((.101*math.cos(a)*radius, bottom+(1.752-bottom)*math.cos(phi),.018+.09*math.sin(a)*radius))
for i in range(9):
    for j in range(n): faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
mesh('Sculpted swept hair cap',verts,faces,'hair','head','Head',subdiv=1)
for i in range(6):
    x=-.072+i*.023
    tube('Swept lock '+str(i),[(x,1.674,-.056),(x-.01,1.711,-.06),(x+.014,1.741,-.025),(x+.033,1.725,.035)], [.009,.014,.016,.006],'hair','head','Head',sides=10)
bob=loft('Bob silhouette',[(0,1.50,.041,.076,.035),(0,1.515,.044,.103,.055),(0,1.61,.035,.106,.068),(0,1.69,.03,.087,.068)],'hair','head','Head'); bob['variant']='bob'
bun=ellipsoid('Sculpted bun',(0,1.735,.078),(.045,.043,.044),'hair',variant='bun')

# Fuse garment shells into continuous shoulder/elbow/crotch surfaces before skinning.
for names,name,color,bind,voxel in [
    (['Tailored jacket','Left sculpted sleeve','Right sculpted sleeve','Left cuff','Right cuff'],'Unified jacket','coat','jacket',.0045),
    (['Trouser seat','Left trouser leg','Right trouser leg'],'Unified trousers','pants','trousers',.0045),
]:
    objects=[o for o in PARTS if o.name in names]
    for o in objects:
        bpy.context.view_layer.objects.active=o
        for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    fuse(objects,name,color,'body',bind,voxel)

# Preserve editable modifiers in the .blend and export evaluated meshes as data.
for obj in PARTS:
    if len(obj.data.polygons)>150:
        mod=obj.modifiers.new('Mobile mesh budget','DECIMATE'); mod.ratio=.10 if obj.name.startswith('Unified') else .4 if obj.name=='Continuous face and nose' else .18
bpy.context.scene.world.color=(.25,.25,.25)
for area in bpy.context.screen.areas if bpy.context.screen else []:
    if area.type=='VIEW_3D': area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'clay-avatar-v2.blend'))
deps=bpy.context.evaluated_depsgraph_get(); result=[]
for obj in PARTS:
    evaluated=obj.evaluated_get(deps); geo=evaluated.to_mesh(); geo.calc_loop_triangles()
    positions=[]; normals=[]; faces=[]
    for v in geo.vertices:
        p=obj.matrix_world@v.co; positions.extend([round(p.x,6),round(p.z,6),round(-p.y,6)])
        n=obj.matrix_world.to_3x3()@v.normal; n.normalize(); normals.extend([round(n.x,6),round(n.z,6),round(-n.y,6)])
    for tri in geo.loop_triangles: faces.extend(tri.vertices)
    result.append({k:obj[k] for k in ['region','bind','palette','variant']}|{'name':obj.name,'position':positions,'normal':normals,'index':faces})
    evaluated.to_mesh_clear()
(OUT/'sculpt-meshes.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf8')
print('SCULPT_COMPLETE',len(result),'parts',sum(len(p['index'])//3 for p in result),'triangles')

