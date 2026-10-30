import { isIP } from 'node:net';
import path from 'node:path';
import { parseArgs } from 'node:util';

/** Parse explicit CLI options instead of using shell-specific environment syntax. */
function readHttpsArgs(args: string[]) {
  try {
    return parseArgs({
      args,
      options: {
        host: { type: 'string', default: '127.0.0.1' },
        port: { type: 'string', default: '8443' },
        cert: { type: 'string', default: 'certs/lab-cert.pem' },
        key: { type: 'string', default: 'certs/lab-key.pem' },
        dev: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
        http: { type: 'boolean', default: false },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch {
    throw new Error('启动参数格式不正确。端口示例为 --port 8443，其他选项请查看 --help。');
  }
}

export function parseHttpsOptions(args: string[], root: string) {
  const values = readHttpsArgs(args);
  if (values.host !== 'localhost' && isIP(values.host) === 0) {
    throw new Error('监听地址必须是 localhost 或有效 IP，不能填写网址。');
  }
  if (!/^\d+$/.test(values.port) || Number(values.port) < 1 || Number(values.port) > 65535) {
    throw new Error('端口必须是 1 到 65535 之间的整数。');
  }
  if (values.http && !['127.0.0.1', '::1', 'localhost'].includes(values.host)) {
    throw new Error('HTTP 检查仅供本机使用；局域网连接请使用 HTTPS。');
  }
  return {
    root,
    host: values.host,
    port: Number(values.port),
    cert: path.resolve(root, values.cert),
    key: path.resolve(root, values.key),
    dev: values.dev,
    help: values.help,
    http: values.http,
  };
}

export function certificateNames(ip: string): string[] {
  const first = Number(ip.split('.')[0]);
  if (isIP(ip) !== 4 || first === 0 || first >= 224) {
    throw new Error('请填写实验电脑可访问的 IPv4 地址，例如 192.168.50.10，而不是网址或 0.0.0.0。');
  }
  return [...new Set(['localhost', '127.0.0.1', '::1', ip])];
}

export function parseCertificateOptions(args: string[], root: string) {
  const { values } = parseArgs({
    args,
    options: {
      ip: { type: 'string' },
      mkcert: { type: 'string', default: 'mkcert' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  return {
    directory: path.join(root, 'certs'),
    mkcert: values.mkcert,
    names: values.help ? [] : certificateNames(values.ip ?? ''),
    help: values.help,
  };
}
