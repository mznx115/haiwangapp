import { Clipboard } from '@capacitor/clipboard'

/**
 * 复制文本。优先走 Capacitor Clipboard（Android 原生剪贴板），
 * 失败时退回到 textarea + execCommand 兜底。
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false
  try {
    await Clipboard.write({ string: text })
    return true
  } catch {
    /* 落到兜底实现 */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
