export type CheckResult = Readonly<{ id: string; name: string; status: 'pass' | 'blocked' | 'unavailable'; detail: string }>;
export type BrowserReport = Readonly<{ checkedAt: string; checks: readonly CheckResult[] }>;
export type BrowserProbe = { secure: boolean; webgl2: () => boolean; audio: boolean; xr?: () => Promise<boolean> };

/** Bound capability probes without requesting a session, a microphone or camera permission. */
export async function checkBrowser(probe: BrowserProbe, timeoutMs = 2500): Promise<BrowserReport> {
  const checks: CheckResult[] = [{ id:'secure',name:'安全连接',status:probe.secure ? 'pass' : 'blocked',detail:probe.secure ? '浏览器认可当前安全环境；localhost 在本机也可以成立。' : '头显连接需要有效 HTTPS，请核对地址与证书。' }];
  try { const supported = probe.webgl2(); checks.push({id:'graphics',name:'三维图形 WebGL 2',status:supported ? 'pass' : 'blocked',detail:supported ? '当前浏览器能够创建 WebGL 2 画面。' : '未能创建 WebGL 2；请检查浏览器与显卡设置。'}); }
  catch { checks.push({id:'graphics',name:'三维图形 WebGL 2',status:'blocked',detail:'图形检查发生错误，请重新检查或更换浏览器。'}); }
  checks.push({id:'audio',name:'声音接口',status:probe.audio ? 'pass' : 'blocked',detail:probe.audio ? '浏览器提供声音接口；实际出声仍需点击解锁并单独试听。' : '浏览器没有提供所需声音接口。'});
  if (!probe.secure) checks.push({id:'xr',name:'沉浸式 VR',status:'blocked',detail:'安全环境未通过，暂不探测 VR。'});
  else if (!probe.xr) checks.push({id:'xr',name:'沉浸式 VR',status:'unavailable',detail:'当前浏览器未提供 WebXR。普通 Mac 浏览器出现此结果是正常情况。'});
  else {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const supported = await Promise.race([probe.xr(),new Promise<never>((_,reject)=>{ timer=setTimeout(()=>reject(new Error('timeout')),timeoutMs); })]);
      checks.push({id:'xr',name:'沉浸式 VR',status:supported ? 'pass' : 'unavailable',detail:supported ? '浏览器报告可用 VR 能力；本次没有进入场景。' : '当前没有可用的沉浸式 VR 设备，请在头显浏览器另测。'});
    } catch { checks.push({id:'xr',name:'沉浸式 VR',status:'unavailable',detail:'VR 能力检查未完成，可能超时或被浏览器拒绝；可重新检查。'}); }
    finally { clearTimeout(timer); }
  }
  return {checkedAt:new Date().toISOString(),checks};
}
export function inspectBrowser(): Promise<BrowserReport> {
  return checkBrowser({
    secure:window.isSecureContext,
    audio:typeof window.AudioContext === 'function',
    webgl2:()=>{
      const canvas=document.createElement('canvas');
      const gl=canvas.getContext('webgl2');
      if(!gl) return false;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.width=0; canvas.height=0;
      return true;
    },
    xr:navigator.xr ? ()=>navigator.xr!.isSessionSupported('immersive-vr') : undefined,
  });
}
