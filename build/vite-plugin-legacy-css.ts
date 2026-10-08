import type { Plugin } from 'vite'

/**
 * 让构建产物能在老版 Android System WebView 上正常渲染。
 *
 * ## 为什么需要这个插件
 *
 * Tailwind CSS v4 输出的是原生 CSS `@layer`：
 *
 *     @layer properties { ... }
 *     @layer theme      { :root, :host { --color-... } }
 *     @layer base       { ... preflight ... }
 *     @layer utilities  { .flex { ... } ... }
 *
 * 按 CSS 规范，解析器遇到**不认识的 at-rule 必须连同它的块一起丢弃**。
 * `@layer` 是 Chromium 99（2022-03）才支持的，在那之前的 WebView 上
 * 整份样式表会被逐块丢掉 —— 于是 HTML 有、JS 有、Vue 也渲染了，
 * 唯独一个样式都不生效，看起来和「CSS 没加载」一模一样。
 *
 * 国内很多 ROM 的 Android System WebView 不随 Google Play 更新
 * （或根本没有 GMS），长期停在 Chrome 80~95，正好落在这个区间里。
 *
 * 这里在构建后把 `@layer` 展开成普通规则。Tailwind 输出的层顺序是
 * properties → theme → base → utilities，展开后保持同样的先后顺序，
 * 层叠结果一致（层内规则的相对顺序本来就由源码顺序决定）。
 *
 * ## 顺带把 CSS 内联进 HTML
 *
 * App 里样式只在首屏需要，内联后少一次子资源请求，也就顺带绕开了
 * WebView 本地资源加载器可能带来的 MIME / CORS 类问题。
 */

/** 跳过一段字符串字面量，返回结束引号之后的位置 */
function skipString(css: string, i: number): number {
  const quote = css[i]
  let j = i + 1
  while (j < css.length) {
    if (css[j] === '\\') {
      j += 2
      continue
    }
    if (css[j] === quote) return j + 1
    j++
  }
  return j
}

/** 跳过一段注释，返回 `*​/` 之后的位置 */
function skipComment(css: string, i: number): number {
  const end = css.indexOf('*/', i + 2)
  return end === -1 ? css.length : end + 2
}

/** 从 `{` 出发找到配对的 `}` */
function matchBrace(css: string, open: number): number {
  let depth = 0
  let i = open
  while (i < css.length) {
    const c = css[i] as string
    if (c === '/' && css[i + 1] === '*') {
      i = skipComment(css, i)
      continue
    }
    if (c === '"' || c === "'") {
      i = skipString(css, i)
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return css.length - 1
}

interface LayerHit {
  /** `@layer` 关键字的起始位置 */
  start: number
  /** 块头的 `{`，或语句形式的 `;` */
  open: number
  /** 形如 `@layer a, b;` 的声明语句（只声明顺序，没有内容） */
  statement: boolean
}

/** 从 from 开始找下一个 `@layer`（跳过字符串与注释） */
function findLayer(css: string, from: number): LayerHit | null {
  let i = from
  while (i < css.length) {
    const c = css[i] as string
    if (c === '/' && css[i + 1] === '*') {
      i = skipComment(css, i)
      continue
    }
    if (c === '"' || c === "'") {
      i = skipString(css, i)
      continue
    }
    if (c === '@' && css.startsWith('@layer', i)) {
      const next = css[i + 6]
      // 排除 @layerfoo 这类同前缀的其他 at-rule
      if (next === undefined || /[\s{,]/.test(next)) {
        let j = i + 6
        while (j < css.length && css[j] !== '{' && css[j] !== ';') {
          if (css[j] === '/' && css[j + 1] === '*') {
            j = skipComment(css, j)
            continue
          }
          if (css[j] === '"' || css[j] === "'") {
            j = skipString(css, j)
            continue
          }
          j++
        }
        if (j >= css.length) return null
        return { start: i, open: j, statement: css[j] === ';' }
      }
    }
    i++
  }
  return null
}

/** 递归展开所有 `@layer`，保留原有顺序 */
export function flattenLayers(css: string): string {
  let out = ''
  let i = 0
  for (;;) {
    const hit = findLayer(css, i)
    if (!hit) return out + css.slice(i)
    out += css.slice(i, hit.start)
    if (hit.statement) {
      i = hit.open + 1
      continue
    }
    const close = matchBrace(css, hit.open)
    out += flattenLayers(css.slice(hit.open + 1, close))
    i = close + 1
  }
}

function asText(source: string | Uint8Array | undefined): string {
  if (source === undefined) return ''
  return typeof source === 'string' ? source : Buffer.from(source).toString('utf8')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface AssetLike {
  type: 'asset'
  fileName: string
  source: string | Uint8Array
}

export interface LegacyCssOptions {
  /** 把 CSS 内联进 HTML 并删掉独立的 .css 资源，默认 true */
  inline?: boolean
}

export function legacyCss(options: LegacyCssOptions = {}): Plugin {
  const inline = options.inline ?? true

  return {
    name: 'haiwang:legacy-css',
    apply: 'build',
    // post：确保在 Vite 压缩完成后、vite-plugin-pwa 生成 Service Worker 之前改完产物
    enforce: 'post',

    generateBundle(_outputOptions, bundle) {
      const assets = Object.values(bundle).filter(
        (f): f is typeof f & AssetLike => f.type === 'asset',
      )
      const cssFiles = assets.filter((f) => f.fileName.endsWith('.css'))
      if (cssFiles.length === 0) return

      for (const file of cssFiles) {
        file.source = flattenLayers(asText(file.source))
      }

      if (!inline) return

      const html = assets.find((f) => f.fileName.endsWith('.html'))
      if (!html) return

      let doc = asText(html.source)
      let inlined = 0

      for (const file of cssFiles) {
        const link = new RegExp(`<link\\b[^>]*href="[^"]*${escapeRegExp(file.fileName)}"[^>]*>`)
        if (!link.test(doc)) continue
        doc = doc.replace(link, `<style>${asText(file.source)}</style>`)
        delete bundle[file.fileName]
        inlined++
      }

      if (inlined === 0) return
      html.source = doc

      // 自检：产物里不该再残留 @layer，否则老 WebView 上依然是白板
      if (doc.includes('@layer')) {
        this.warn('legacy-css: 产物中仍残留 @layer，老版 WebView 会丢弃这些样式')
      }
    },
  }
}
