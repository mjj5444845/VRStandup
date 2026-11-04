import { CanvasTexture, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Raycaster } from 'three';
import type { ScenePanel } from '../core/scene-interface';
export function createScenePanel() {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 900;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('中文面板无法绘制。');
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  const geometry = new PlaneGeometry(1.6, 1.2), material = new MeshBasicMaterial({ map: texture, side: DoubleSide, depthTest: false, toneMapped: false }), mesh = new Mesh(geometry, material);
  mesh.renderOrder = 20; let data: ScenePanel | null = null; const hits: { id: string; x: number; y: number; w: number; h: number }[] = [];
  function line(text: string, y: number, size: number) { ctx!.font = `${size}px "PunchCap Chinese", sans-serif`; let row = '', top = y; for (const char of text) { if (ctx!.measureText(row + char).width > 1070) { ctx!.fillText(row, 60, top); row = ''; top += size + 12; } row += char; } ctx!.fillText(row, 60, top); return top + size + 20; }
  function update(value: ScenePanel | null) {
    data = value; mesh.visible = Boolean(value); hits.length = 0; if (!value) return;
    ctx!.fillStyle = '#f6f6ee'; ctx!.fillRect(0, 0, 1200, 900); ctx!.fillStyle = '#183c2a'; let y = line(value.title, 65, 42);
    for (const text of value.lines.slice(0, 4)) y = line(text, y, 29);
    const buttons = value.buttons.slice(0, 8), top = Math.max(360, Math.min(460, y));
    buttons.forEach((button, i) => { const x = 60 + i % 2 * 555, yy = top + Math.floor(i / 2) * 98; ctx!.fillStyle = '#d9e7d1'; ctx!.fillRect(x, yy, 520, 80); ctx!.fillStyle = '#183c2a'; ctx!.font = '26px "PunchCap Chinese", sans-serif'; ctx!.fillText(button.label.slice(0, 19), x + 18, yy + 49); hits.push({ id: button.id, x, y: yy, w: 520, h: 80 }); });
    texture.needsUpdate = true;
  }
  function select(ray: Raycaster) { if (!data || !mesh.visible) return false; const hit = ray.intersectObject(mesh)[0]; if (!hit?.uv) return false; const x = hit.uv.x * 1200, y = (1 - hit.uv.y) * 900, button = hits.find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h); if (button) data.choose(button.id); return true; }
  return { mesh, update, refresh: () => update(data), select, dispose: () => { geometry.dispose(); material.dispose(); texture.dispose(); } };
}
