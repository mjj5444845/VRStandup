const destinations = ['/study/session', '/lab/session', '/lab/assets'] as const;
export type LabDestination = typeof destinations[number];
/** Navigation only: credentials remain on the laboratory origin, never this portal. */
export function labDestination(address: string, destination: LabDestination) {
  if (!destinations.includes(destination)) throw new Error('无效的实验室入口。');
  let url: URL; try { url = new URL(address.trim()); } catch { throw new Error('请输入实验员提供的完整实验室地址。'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('实验室地址需要 HTTPS；HTTP 仅供本机开发。');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('这里只填写实验室网址，不要附带路径、密钥或其他参数。');
  return new URL(destination, url.origin).href;
}
