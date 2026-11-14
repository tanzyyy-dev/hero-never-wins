/**
 * public/ 配下の素材参照のガード。
 *
 * GitHub Pages ではサブパス（/hero-never-wins/）で配信するため、JS/TSX から public/ の素材を
 * '/xxx.webp' のような絶対パスで参照すると 404 になる（Vite は JS 文字列を base に合わせて書き換えない）。
 * JS/TSX では 'xxx.webp' / 'audio/xxx.wav' のように index.html からの相対パスで書くこと。
 * （index.html と CSS の url() は Vite がビルド時に書き換えるので対象外）
 *
 * 実行: npm test
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC_DIR = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url))
const ASSET_LITERAL = /['"`](\/?(?:audio\/)?[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp|svg|ico|wav|mp3|ogg))['"`]/g

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return listSourceFiles(path)
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

describe('public assets', () => {
  const refs = listSourceFiles(SRC_DIR).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(ASSET_LITERAL)].map((m) => ({ file, path: m[1]! }))
  )

  it('JS/TSX から public 素材を絶対パス（先頭 /）で参照しない', () => {
    const absolute = refs.filter((r) => r.path.startsWith('/'))
    assert.deepEqual(absolute, [])
  })

  it('JS/TSX が参照する public 素材は実在する（BGM のフォールバックパスを除く）', () => {
    const missing = refs.filter(
      (r) => !existsSync(join(PUBLIC_DIR, r.path)) && !(r.file.endsWith('bgm.ts') && !r.path.startsWith('audio/'))
    )
    assert.deepEqual(missing, [])
  })
})
