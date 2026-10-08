#!/usr/bin/env node
/**
 * 构建产物 CSS 兼容性自检。
 *
 * 目标：保证打包进 App 的样式能在 Chrome 84+ 的 Android System WebView 上完整生效
 * （国内 ROM 的 WebView 常年不更新，这是真实下限）。详见 src/style.css 顶部说明。
 *
 * 用法：
 *   node scripts/check-css-compat.mjs            # 检查 dist/
 *   node scripts/check-css-compat.mjs dist       # 指定目录
 *
 * 退出码非 0 表示存在会导致「整个页面没样式」的问题。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2] ?? 'dist'

if (!existsSync(root)) {
  console.error(`✗ 找不到构建产物目录：${root}（先跑 pnpm build）`)
  process.exit(1)
}

/** 递归收集 .html / .css */
function collect(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...collect(full))
    else if (/\.(html|css)$/.test(name)) out.push(full)
  }
  return out
}

const files = collect(root)
if (files.length === 0) {
  console.error(`✗ ${root} 里没有 html/css 产物`)
  process.exit(1)
}

/** 致命：会让解析器丢弃整块样式 */
const FATAL = [
  {
    re: /@layer\b/g,
    why: 'Chromium < 99 不认识 @layer，会连同块内容整块丢弃 → 页面完全没有样式',
    fix: 'build/vite-plugin-legacy-css.ts 会展开它；若此处仍报错说明插件没生效',
  },
  {
    re: /@container\b/g,
    why: 'Chromium < 105 不支持容器查询，整块丢弃',
    fix: '改用媒体查询',
  },
]

/** 警告：只影响个别声明，不会整体失效 */
const WARN = [
  {
    re: /:where\(/g,
    why: 'Chromium < 88 不认识 :where()，该条规则被丢弃（Preflight 里剩几条是无害的）',
  },
  {
    re: /:is\(/g,
    why: 'Chromium < 88 不认识 :is()，该条规则被丢弃',
  },
]

let failed = 0
let warned = 0

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const label = relative(process.cwd(), file)

  for (const { re, why, fix } of FATAL) {
    const hits = text.match(re)
    if (!hits) continue
    failed++
    console.error(`✗ ${label}：出现 ${re.source} 共 ${hits.length} 处`)
    console.error(`    ${why}`)
    if (fix) console.error(`    ${fix}`)
  }

  for (const { re, why } of WARN) {
    const hits = text.match(re)
    if (!hits) continue
    warned++
    console.warn(`· ${label}：${re.source} 共 ${hits.length} 处 —— ${why}`)
  }
}

const totalSize = files.reduce((n, f) => n + statSync(f).size, 0)
console.log(`\n检查了 ${files.length} 个产物文件（合计 ${(totalSize / 1024).toFixed(1)} KB）`)

if (failed > 0) {
  console.error(`\n✗ 发现 ${failed} 类致命兼容问题，老版 WebView 上会整份丢样式。`)
  process.exit(1)
}

console.log(`✓ 没有致命兼容问题${warned ? `（${warned} 类警告，仅影响个别规则）` : ''}`)
