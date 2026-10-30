import { execFileSync } from 'node:child_process';
import { constants, existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCertificateOptions } from './https-config.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

async function main() {
  const options = parseCertificateOptions(process.argv.slice(2), root);
  if (options.help) {
    console.log('准备本机证书：npm run spike:cert -- --ip <实验电脑IPv4> [--mkcert <工具路径>]');
    console.log('只调用已安装的 mkcert 生成文件，不安装根证书，不覆盖已有证书。');
    return;
  }
  const cert = path.join(options.directory, 'lab-cert.pem');
  const key = path.join(options.directory, 'lab-key.pem');
  if (existsSync(cert) || existsSync(key)) {
    throw new Error('certs 中已有证书或密钥，已停止以免覆盖。若 IP 变更，先停止服务并保管好旧文件，再移走后生成。');
  }
  await mkdir(options.directory, { recursive: true });
  const temporary = await mkdtemp(path.join(options.directory, '.prepare-'));
  try {
    const temporaryCert = path.join(temporary, 'cert.pem');
    const temporaryKey = path.join(temporary, 'key.pem');
    // No shell is used: paths containing spaces cannot become extra commands.
    // Root trust installation is deliberately a separate, human-controlled step.
    execFileSync(options.mkcert, [
      '-cert-file', temporaryCert, '-key-file', temporaryKey, ...options.names,
    ], { stdio: 'inherit' });
    // Exclusive copies also protect a certificate created by another process.
    await copyFile(temporaryCert, cert, constants.COPYFILE_EXCL);
    await copyFile(temporaryKey, key, constants.COPYFILE_EXCL);
    if (process.platform !== 'win32') await chmod(key, 0o600);
    console.log('证书已生成在 certs/，不会上传 Git。下一步按说明启动 HTTPS 服务。');
    console.log('生成文件不代表浏览器或头显已经信任该证书，需分别验证。');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  const code = error instanceof Error && 'code' in error ? error.code : undefined;
  console.error(code === 'ENOENT'
    ? '没有找到 mkcert 工具。请按 05 操作说明安装，或用 --mkcert 指定完整路径。'
    : `证书准备失败：${error instanceof Error ? error.message : '未知错误'}`);
  process.exitCode = 1;
});
