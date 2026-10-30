export type XrSupport = {
  connection: string;
  secure: boolean;
  supported: boolean;
  message: string;
  browser: string;
};

/** Report actual browser capabilities without requesting an immersive session. */
export async function inspectXrSupport(): Promise<XrSupport> {
  const result: XrSupport = {
    connection: window.location.protocol === 'https:' ? 'HTTPS 加密连接' : 'HTTP 预览，头显连接需使用 HTTPS',
    secure: window.isSecureContext,
    supported: false,
    message: '',
    browser: navigator.userAgent,
  };
  if (!result.secure) return { ...result, message: '浏览器没有认可当前安全环境，请先检查 HTTPS 地址与证书。' };
  if (!navigator.xr) return { ...result, message: '当前浏览器没有提供 VR 接口；普通电脑浏览器出现此提示是正常情况。' };
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    return {
      ...result,
      supported,
      message: supported ? '检测到可进入 VR 的设备。' : '当前没有可用的 VR 设备，请在头显浏览器打开同一检查页。',
    };
  } catch {
    return { ...result, message: '浏览器未能完成 VR 检查，请确认设备连接和浏览器权限后重新检查。' };
  }
}

export function xrErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return '浏览器没有允许进入 VR。请检查安全地址和权限，再由你点击进入。';
    }
    if (error.name === 'NotSupportedError') return '设备不支持这次 VR 请求或地面定位，请记录设备和浏览器版本。';
    if (error.name === 'InvalidStateError') return '设备可能已有 VR 会话，请先退出其他 VR 页面后再试。';
  }
  return '未能进入 VR。请重新检查，并确认是在支持 VR 的头显浏览器中操作。';
}
