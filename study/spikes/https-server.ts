import { readFile } from 'node:fs/promises';
import { X509Certificate } from 'node:crypto';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createHttpServer, type RequestListener } from 'node:http';
import { createSecureContext } from 'node:tls';
import { networkInterfaces } from 'node:os';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';
import next from 'next';
import { parseHttpsOptions } from './https-config.js';
import { createNetworkHub } from './network-hub.js';
import { CHECK_SOCKET_PATH } from './network-protocol.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

async function main() {
  const options = parseHttpsOptions(process.argv.slice(2), root);
  if (options.help) {
    console.log('HTTPS 检查服务：npm run spike:https -- [--host 127.0.0.1] [--port 8443] [--dev]');
    console.log('默认读取 certs/lab-cert.pem 和 certs/lab-key.pem；可用 --cert、--key 指定其他路径。');
    console.log('默认仅本机访问；实验室同网设备访问时显式填写 --host 0.0.0.0。');
    console.log('默认使用生产构建，先运行 npm run build；--dev 仅用于开发调试。');
    console.log('本机通信检查可用 npm run spike:net；--http 只允许本机地址，不能用于局域网部署。');
    return;
  }

  // Fail before starting Next if files, dates, or the certificate/key pair are wrong.
  let certificate: X509Certificate | undefined;
  let credentials: { cert: Buffer; key: Buffer } | undefined;
  const wildcard = options.host === '0.0.0.0' || options.host === '::';
  if (!options.http) {
    const [cert, key] = await Promise.all([readFile(options.cert), readFile(options.key)]);
    certificate = new X509Certificate(cert);
    if (Date.now() < Date.parse(certificate.validFrom) || Date.now() > Date.parse(certificate.validTo)) {
      throw new Error('证书尚未生效或已经过期，请检查电脑时间和证书。');
    }
    createSecureContext({ cert, key, minVersion: 'TLSv1.2' });
    if (!wildcard && !(isIP(options.host) ? certificate.checkIP(options.host) : certificate.checkHost(options.host))) {
      throw new Error('证书没有包含当前监听地址，请按实际 IP 重新准备证书。');
    }
    credentials = { cert, key };
  }
  const app = next({ dev: options.dev, dir: root, hostname: options.host, port: options.port });
  await app.prepare();
  const handleRequest = app.getRequestHandler();
  const handleUpgrade = app.getUpgradeHandler();
  const hub = createNetworkHub(!options.http);
  const handle: RequestListener = (request, response) => {
    response.setHeader('Permissions-Policy', 'xr-spatial-tracking=(self)');
    void handleRequest(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end('页面处理失败，请查看服务窗口。');
    });
  };
  const server = credentials
    ? createHttpsServer({ ...credentials, minVersion: 'TLSv1.2' }, handle)
    : createHttpServer(handle);
  // Each upgrade has exactly one owner: our check socket or Next's HMR socket.
  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url?.split('?')[0];
    if (pathname === CHECK_SOCKET_PATH) hub.handleUpgrade(request, socket, head);
    else void handleUpgrade(request, socket, head).catch(() => socket.destroy());
  });

  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    console.log('正在停止检查服务…');
    await hub.close();
    server.close();
    server.closeAllConnections();
    await app.close();
    process.exit(0);
  }
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(options.port, options.host, resolve);
    });
  } catch (error) {
    await hub.close();
    await app.close();
    throw error;
  }

  const protocol = options.http ? 'http' : 'https';
  console.log(`${protocol.toUpperCase()} 检查服务已启动（${options.dev ? '开发' : '生产构建'}模式）。`);
  if (wildcard) {
    if (certificate?.checkHost('localhost')) console.log(`本机检查：https://localhost:${options.port}/spike/xr`);
    const addresses = Object.values(networkInterfaces()).flatMap((entries) => entries ?? [])
      .filter((entry) => !entry.internal && entry.family === 'IPv4' && certificate?.checkIP(entry.address));
    addresses.forEach((entry) => console.log(`局域网检查：https://${entry.address}:${options.port}/spike/xr`));
    if (addresses.length === 0) console.log('没有找到与证书匹配的局域网 IPv4，请核对当前网卡地址和证书。');
  } else {
    const address = options.host.includes(':') ? `[${options.host}]` : options.host;
    console.log(`连接检查：${protocol}://${address}:${options.port}/spike/xr`);
    console.log(`通信检查：${protocol}://${address}:${options.port}/spike/network`);
  }
  console.log('检查页与 /lab-ws 共用当前端口。这只是技术验证，不记录实验数据。按 Control + C 停止。');
}

main().catch((error: unknown) => {
  const code = error instanceof Error && 'code' in error ? error.code : undefined;
  if (code === 'ENOENT') console.error('缺少证书、密钥或生产构建。请先按 05 说明准备证书，再运行 npm run build。');
  else if (code === 'EADDRINUSE') console.error('端口已经被占用。请停止旧服务，或用 --port 指定另一个端口。');
  else console.error(`HTTPS 启动失败：${error instanceof Error ? error.message : '未知错误'}`);
  process.exitCode = 1;
});
