"""Keep performer facial detail from the already-owned full source, never upscale the 256px audience copy."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'local_assets/models/human-v3'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'local_assets/mixamo/output/Ch23_nonPBR_avatar.glb'))
data=json.loads((OUT/'male-ch23.json').read_text())
for i,entry in enumerate(data['materials']):
    if not entry['image']:continue
    o=bpy.data.objects.get(entry['name'].rsplit('_',1)[0])
    if not o:raise RuntimeError(entry['name'])
    mat=o.data.materials[0];bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');tex=bs.inputs['Base Color'].links[0].from_node;im=tex.image
    width,height=im.size;factor=min(1,1024/max(width,height))
    if factor<1:im.scale(round(width*factor),round(height*factor))
    im.file_format='PNG';im.filepath_raw=str(OUT/('hi-'+entry['image']));im.save()
    print('FACE_TEXTURE',entry['name'],(width,height),list(im.size))
