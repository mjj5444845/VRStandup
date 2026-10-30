import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { certificateNames, parseCertificateOptions, parseHttpsOptions } from './https-config.js';

const root = path.resolve('example-project');

test('HTTPS defaults stay local and resolve certificates from the project', () => {
  const options = parseHttpsOptions([], root);
  assert.equal(options.host, '127.0.0.1');
  assert.equal(options.port, 8443);
  assert.equal(options.dev, false);
  assert.equal(options.cert, path.join(root, 'certs', 'lab-cert.pem'));
  assert.equal(options.key, path.join(root, 'certs', 'lab-key.pem'));
});

test('explicit lab binding, development mode, and certificate paths are accepted', () => {
  const options = parseHttpsOptions([
    '--host', '0.0.0.0', '--port', '9443', '--dev', '--cert', 'certs/custom.pem',
  ], root);
  assert.equal(options.host, '0.0.0.0');
  assert.equal(options.port, 9443);
  assert.equal(options.dev, true);
  assert.equal(options.cert, path.join(root, 'certs', 'custom.pem'));
});

test('invalid ports never silently become a different port', () => {
  for (const port of ['0', '65536', '-1', '8443x', '1.5', '']) {
    assert.throws(() => parseHttpsOptions(['--port', port], root), /端口/);
  }
});

test('invalid hosts, unknown flags, and positional arguments are rejected', () => {
  assert.throws(() => parseHttpsOptions(['--host', 'https://example.test'], root), /监听地址/);
  assert.throws(() => parseHttpsOptions(['--unknown'], root));
  assert.throws(() => parseHttpsOptions(['extra'], root));
  assert.equal(parseHttpsOptions(['--host', '::1'], root).host, '::1');
});

test('help can be read before any certificates or IP addresses exist', () => {
  assert.equal(parseHttpsOptions(['--help'], root).help, true);
  assert.equal(parseCertificateOptions(['--help'], root).help, true);
});

test('HTTP check mode is restricted to loopback and does not expose the lab network', () => {
  assert.equal(parseHttpsOptions(['--http', '--port', '3001'], root).http, true);
  for (const host of ['0.0.0.0', '::', '192.168.50.10']) {
    assert.throws(() => parseHttpsOptions(['--http', '--host', host], root), /仅供本机/);
  }
});

test('certificate names include the actual IP and local addresses', () => {
  assert.deepEqual(certificateNames('192.168.50.10'), ['localhost', '127.0.0.1', '::1', '192.168.50.10']);
  assert.equal(new Set(certificateNames('127.0.0.1')).size, 3);
});

test('certificate IP must be a usable IPv4 address, not a URL or wildcard bind', () => {
  for (const ip of ['', '192.168.1.999', 'https://192.168.1.2', '0.0.0.0', '255.255.255.255', '224.0.0.1']) {
    assert.throws(() => certificateNames(ip), /IPv4/);
  }
});

test('certificate tool path is passed separately from its arguments', () => {
  const options = parseCertificateOptions([
    '--ip', '192.168.50.10', '--mkcert', 'C:\\Tools with spaces\\mkcert.exe',
  ], root);
  assert.equal(options.mkcert, 'C:\\Tools with spaces\\mkcert.exe');
  assert.equal(options.directory, path.join(root, 'certs'));
  assert.throws(() => parseCertificateOptions([], root), /IPv4/);
});
