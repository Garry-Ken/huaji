// 应用内检查更新：对比当前版本与 GitHub 最新 Release，发现新版引导到下载页。
// 固定签名后，安卓可原地覆盖安装，无需先卸载。
const REPO = 'Garry-Ken/huaji'
const DOWNLOAD_PAGE = 'https://huaji.pages.dev/download.html'

export interface UpdateInfo {
  current: string
  latest: string
  hasUpdate: boolean
  url: string
}

function cmpVer(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

export async function checkUpdate(current: string): Promise<UpdateInfo | { error: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return { error: '检查失败，请稍后重试' }
    const data = await res.json()
    const latest = String(data.tag_name || '').replace(/^v/i, '')
    if (!latest) return { error: '未获取到版本信息' }
    return { current, latest, hasUpdate: cmpVer(latest, current) > 0, url: DOWNLOAD_PAGE }
  } catch {
    return { error: '网络错误，请检查联网' }
  }
}
