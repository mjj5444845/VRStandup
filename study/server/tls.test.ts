import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { get } from 'node:https';
import { WebSocket } from 'ws';
import { startLabServer } from './http';
test('HTTPS and WSS require the explicit test CA and the exact secure origin', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'punchcap-tls-')), certFile = path.join(root, 'cert.pem'), keyFile = path.join(root, 'key.pem');
  let running: Awaited<ReturnType<typeof startLabServer>> | undefined;
  try {
    if (process.platform === 'win32') {
      const script = "$r=[System.Security.Cryptography.RSA]::Create(2048);$q=[System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=localhost',$r,[System.Security.Cryptography.HashAlgorithmName]::SHA256,[System.Security.Cryptography.RSASignaturePadding]::Pkcs1);$s=[System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new();$s.AddDnsName('localhost');$s.AddIpAddress([System.Net.IPAddress]::Parse('127.0.0.1'));$q.CertificateExtensions.Add($s.Build());$c=$q.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-1),[DateTimeOffset]::UtcNow.AddDays(1));[IO.File]::WriteAllText((Join-Path $env:PUNCHCAP_TEST_CERT_DIR 'cert.pem'),$c.ExportCertificatePem());[IO.File]::WriteAllText((Join-Path $env:PUNCHCAP_TEST_CERT_DIR 'key.pem'),$r.ExportPkcs8PrivateKeyPem());$c.Dispose();$r.Dispose()";
      execFileSync('pwsh', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, PUNCHCAP_TEST_CERT_DIR: root }, stdio: 'ignore' });
    } else execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
    const cert = await fs.readFile(certFile), key = await fs.readFile(keyFile), operatorKey = 'test-only-tls-key-not-a-credential';
    running = await startLabServer({ port: 0, dataRoot: path.join(root, 'sessions'), assetRoot: path.join(root, 'assets'), operatorKey, tls: { cert, key } });
    const port = running.port;
    const request = (ca?: Buffer) => new Promise<number>((resolve, reject) => { get({ hostname: '127.0.0.1', port, path: '/api/lab/assets', ca, headers: { Authorization: `Bearer ${operatorKey}` } }, res => { res.resume(); resolve(res.statusCode!); }).on('error', reject); });
    assert.equal(await request(cert), 200); await assert.rejects(request());
    const ws = new WebSocket(`wss://127.0.0.1:${port}/lab-ws`, { ca: cert, origin: `https://127.0.0.1:${port}` });
    await new Promise<void>((resolve, reject) => { ws.on('error', reject); ws.once('open', () => ws.send(JSON.stringify({ v: 1, type: 'hello', role: 'operator', clientId: 'tls-client', key: operatorKey }))); ws.once('message', bytes => { const m = JSON.parse(bytes.toString()); assert.equal(m.type, 'welcome'); resolve(); }); });
    await new Promise<void>(resolve => { ws.once('close', () => resolve()); ws.close(); });
    const wrong = new WebSocket(`wss://127.0.0.1:${port}/lab-ws`, { ca: cert, origin: `http://127.0.0.1:${port}` }); await new Promise<void>(resolve => { wrong.once('error', () => resolve()); }); wrong.terminate();
  } finally { await running?.close(); await fs.rm(root, { recursive: true, force: true }); }
});
