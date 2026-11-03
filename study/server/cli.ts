import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { X509Certificate } from 'node:crypto';
import { createSecureContext } from 'node:tls';
import { isIP } from 'node:net';
import next from 'next';
import { loadAccess, startLabServer } from './http';
async function main() {
  const args = process.argv.slice(2), values = new Map<string, string>(); let dev = false;
  for (let i = 0; i < args.length; i++) { if (args[i] === '--dev') { dev = true; continue; } if (!['--host', '--port', '--cert', '--key', '--data', '--assets', '--access'].includes(args[i]) || !args[i + 1]) throw new Error('未知参数或缺少参数值。'); values.set(args[i], args[++i]); }
  const root = fileURLToPath(new URL('../../', import.meta.url)), host = values.get('--host') ?? '127.0.0.1', port = Number(values.get('--port') ?? 3002);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口必须在 1–65535。');
  let tls: { cert: Buffer; key: Buffer } | undefined;
  if (values.has('--cert') || values.has('--key')) {
    if (!values.has('--cert') || !values.has('--key')) throw new Error('证书和私钥需同时提供。');
    const [cert, key] = await Promise.all([fs.readFile(path.resolve(values.get('--cert')!)), fs.readFile(path.resolve(values.get('--key')!))]);
    const x = new X509Certificate(cert); if (Date.now() < Date.parse(x.validFrom) || Date.now() > Date.parse(x.validTo)) throw new Error('证书有效期不符。');
    if (!['0.0.0.0', '::'].includes(host) && !(isIP(host) ? x.checkIP(host) : x.checkHost(host))) throw new Error('证书不包含监听地址。');
    createSecureContext({ cert, key, minVersion: 'TLSv1.2' }); tls = { cert, key };
  }
  const access = path.resolve(values.get('--access') ?? 'data/lab-access.json'), operatorKey = await loadAccess(access);
  const app = next({ dev, dir: root, hostname: host, port }); await app.prepare(); const request = app.getRequestHandler(), upgrade = app.getUpgradeHandler();
  const running = await startLabServer({ host, port, tls, operatorKey, dataRoot: path.resolve(values.get('--data') ?? 'data/sessions'), assetRoot: path.resolve(values.get('--assets') ?? 'local_assets/performances'), page: (req, res) => { void request(req, res); }, upgradePage: upgrade });
  console.log(`实验室服务已启动：${tls ? 'https' : 'http'}://${host}:${running.port}/lab/session`); console.log(`本机访问密钥文件：${access}。原始凭据不会打印到日志。`);
  console.log('当前开放 M4 工程预演；正式剧场与集中实机验收完成前不能运行正式研究。');
  let stopping = false; const close = async () => { if (stopping) return; stopping = true; await running.close(); await app.close(); };
  process.once('SIGINT', () => { void close(); }); process.once('SIGTERM', () => { void close(); });
}
void main().catch(error => { console.error(error instanceof Error ? error.message : '实验室服务启动失败'); process.exitCode = 1; });
