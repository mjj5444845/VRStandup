import path from 'node:path';
import { createServer as httpServer, type IncomingMessage, type ServerResponse, type RequestListener } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import type { Duplex } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { createLab } from './lab';
import { listBundles, readBundle, saveBundle, type ClipMetadata } from '../storage/assets';
import { atomicJson, privateRoot, regularFile } from '../storage/private-files';
import { assert, object, text, id } from '../core/validation';
import { prepareEngineering } from '../storage/engineering';
import { saveMeasurement, readMeasurement } from '../storage/measurements';
import { validateAudioUpload, MEASUREMENT_AUDIO_BYTES } from '../core/measurement';
import { executionReport } from './report';
import { audioForSession } from './audio-guard';
import { RECORDING_FILE_BYTES } from '../core/recording';
import { demoPlan } from '../core/demo';
import { validatePlan } from '../core/plan';
export async function loadAccess(file: string) {
  await privateRoot(path.dirname(file));
  try { const data: unknown = JSON.parse((await regularFile(file, 10000)).toString('utf8')); assert(object(data) && typeof data.operatorKey === 'string' && data.operatorKey.length >= 20, '实验员密钥文件无效。'); return data.operatorKey; }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; const key = randomBytes(32).toString('base64url'); await atomicJson(file, { operatorKey: key }); return key; }
}
export async function startLabServer(options: { host?: string; port?: number; dataRoot: string; assetRoot: string; backupRoot?: string; operatorKey: string; tls?: { cert: Buffer; key: Buffer }; page?: RequestListener; upgradePage?: (req: IncomingMessage, socket: Duplex, head: Buffer) => Promise<void>; verifyAssets?: boolean }) {
  const host = options.host ?? '127.0.0.1', port = options.port ?? 3002;
  assert(options.tls || ['127.0.0.1', 'localhost', '::1'].includes(host), 'HTTP 正式服务只允许本机；局域网必须配置可信 HTTPS。');
  const lab = await createLab({ ...options, allowStudy: false });
  const json = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
  async function body(req: IncomingMessage, max: number) {
    let bytes = 0; const chunks: Buffer[] = []; for await (const part of req) { const b = Buffer.from(part); bytes += b.length; assert(bytes <= max, '上传超过工程大小上限。'); chunks.push(b); } return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  }
  const handler: RequestListener = (req, res) => {
    res.setHeader('Permissions-Policy', 'xr-spatial-tracking=(self), microphone=(self), camera=()'); res.setHeader('Referrer-Policy', 'no-referrer');
    void (async () => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`), route = url.pathname;
      if (!route.startsWith('/api/lab/') && !route.startsWith('/api/run/')) { if (options.page) options.page(req, res); else json(res, 404, { error: '不存在' }); return; }
      const origin = req.headers.origin;
      assert(!origin || origin === `${options.tls ? 'https:' : 'http:'}//${req.headers.host}`, '拒绝跨站请求。');
      const authorization = req.headers.authorization ?? '', key = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      if (route.startsWith('/api/run/')) {
        const sid = req.headers['x-punchcap-session'], clientId = req.headers['x-punchcap-client'];
        assert(id(sid) && id(clientId) && lab.participantAuthorized(sid, key, clientId), '需要当前场次及已绑定参与者身份。');
        const session = lab.sessions().find(s => s.id === sid)!; assert(session.execution, '该场次不是完整流程。');
        if (route === '/api/run/clip' && req.method === 'GET') {
          const clip = url.searchParams.get('clip'), own = session.plan.assignments.find(a => a.participantId === session.participantId)!;
          const allowed = new Set([session.plan.practiceClipId, ...own.rounds.flatMap(r => [r.clipId, ...(session.plan.responses[r.clipId] ?? [])])]); assert(clip && allowed.has(clip), '该片段不属于本参与者。');
          const b = await readBundle(options.assetRoot, clip); json(res, 200, { manifest: b.manifest, take: b.take }); return;
        }
        if (route === '/api/run/audio' && req.method === 'POST') {
          const header = req.headers['x-punchcap-metadata']; assert(typeof header === 'string' && header.length <= 20000, '录音元数据头无效。'); const metadata = validateAudioUpload(JSON.parse(decodeURIComponent(header)));
          audioForSession(session, metadata); let length = 0; const chunks: Buffer[] = [];
          for await (const part of req) { const chunk = Buffer.from(part); length += chunk.length; assert(length <= MEASUREMENT_AUDIO_BYTES, '录音分段过大。'); chunks.push(chunk); }
          const saved = await saveMeasurement(options.dataRoot, metadata, Buffer.concat(chunks)); await lab.recordAudio(sid, saved, clientId, key); json(res, 201, saved); return;
        }
        if (route === '/api/run/audio' && req.method === 'GET') { const audioId = url.searchParams.get('audio'); assert(id(audioId), '需要录音编号。'); const saved = await readMeasurement(options.dataRoot, sid, audioId); res.writeHead(200, { 'Content-Type': saved.metadata.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(saved.bytes); return; }
        if (route === '/api/run/report' && req.method === 'GET') { json(res, 200, await executionReport(options.dataRoot, session, lab.journal(sid))); return; }
        json(res, 404, { error: '接口不存在' }); return;
      }
      assert(lab.operatorAuthorized(key), '需要实验员访问密钥。');
      if (route === '/api/lab/integrated-plan' && req.method === 'POST') { json(res, 201, await prepareEngineering(options.assetRoot)); return; }
      if ((route === '/api/lab/report' || route === '/api/lab/backup') && ['GET', 'POST'].includes(req.method ?? '')) {
        const sid = url.searchParams.get('session'), session = lab.sessions().find(s => s.id === sid); assert(session, '会话不存在。');
        if (route.endsWith('/backup')) { assert(req.method === 'POST', '备份需明确提交。'); json(res, 201, await lab.backup(session.id, options.backupRoot ?? path.resolve('backups/sessions'))); }
        else json(res, 200, await executionReport(options.dataRoot, session, lab.journal(session.id))); return;
      }
      if (route === '/api/lab/rehearsal-plan' && req.method === 'GET') {
        const plan = demoPlan(); plan.clips = await Promise.all(plan.clips.map(async c => (await readBundle(options.assetRoot, c.id)).manifest)); json(res, 200, validatePlan(plan)); return;
      }
      if (route === '/api/lab/assets' && req.method === 'GET') { json(res, 200, await listBundles(options.assetRoot)); return; }
      if (route === '/api/lab/assets' && req.method === 'POST') { const data = await body(req, RECORDING_FILE_BYTES); assert(object(data) && object(data.metadata), '需要录制原件和片段元数据。'); json(res, 201, await saveBundle(options.assetRoot, data.take, data.metadata as ClipMetadata)); return; }
      const clipId = url.searchParams.get('clip');
      if (route === '/api/lab/take' && req.method === 'GET' && clipId) { json(res, 200, (await readBundle(options.assetRoot, clipId)).take); return; }
      if (route === '/api/lab/events' && req.method === 'GET') { const sid = url.searchParams.get('session'); assert(text(sid, 80), '需要场次编号。'); json(res, 200, lab.journal(sid)); return; }
      json(res, 404, { error: '接口不存在' });
    })().catch(error => { if (!res.headersSent) json(res, 400, { error: error instanceof Error ? error.message : '请求失败' }); else res.end(); });
  };
  const server = options.tls ? httpsServer({ ...options.tls, minVersion: 'TLSv1.2' }, handler) : httpServer(handler);
  server.on('upgrade', (req, socket, head) => { if (req.url === '/lab-ws') lab.upgrade(req, socket, head); else if (options.upgradePage && req.url?.startsWith('/_next/')) void options.upgradePage(req, socket, head).catch(() => socket.destroy()); else socket.destroy(); });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  const address = server.address(); assert(address && typeof address !== 'string', '无法读取服务端口。');
  return { lab, port: address.port, close: async () => { await lab.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
