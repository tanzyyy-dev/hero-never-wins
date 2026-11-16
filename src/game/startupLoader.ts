import { ALLY_SAVE_IMAGES, BATTLE_BASE_IMAGES, REVIVE_CUTIN_IMAGE } from '../battle/battleArtwork.ts'
import type { SeKey } from '../se.ts'

export const ALL_STARTUP_IMAGES: readonly string[] = Array.from(
  new Set([
    'belly_glass_protagonist.jpg',
    'reel_side_bg.jpg',
    'battle_mode_off.jpg',
    'battle_mode_lit.jpg',
    'battle_intro_arena.jpg',
    'mass_production_soldier.webp',
    ...Object.values(BATTLE_BASE_IMAGES),
    ...Object.values(ALLY_SAVE_IMAGES),
    REVIVE_CUTIN_IMAGE,
  ]),
)

export const ALL_STARTUP_SE: readonly SeKey[] = [
  'stop',
  'bet',
  'lever',
  'payout',
  'replay',
  'zako_hit',
  'voice_bonus_get',
  'voice_enemy_01',
  'voice_enemy_02',
  'voice_enemy_03',
  'voice_round_start',
  'voice_left_navi',
  'voice_middle_navi',
  'voice_right_navi',
  'voice_hero_provocation',
  'voice_boss_provocation',
  'voice_hero_damage',
  'voice_boss_damage',
  'voice_hero_special_attack',
  'voice_boss_spacial_attack',
  'voice_fellow',
  'voice_fellow_continue',
  'voice_support',
]

export const DEFAULT_STARTUP_TIMEOUT_MS = 15000
export const DEFAULT_STARTUP_CONCURRENCY = 6

export type StartupPhase = 'loading' | 'ready'

export interface StartupLoadResult {
  completed: boolean
  failedAssets: string[]
  timedOut: boolean
}

export interface StartupLoaderDeps {
  loadImage: (src: string) => Promise<boolean>
  loadSe: (key: SeKey) => Promise<boolean>
  onProgress?: (loaded: number, total: number) => void
  timeoutMs?: number
  concurrency?: number
}

/**
 * 初期ロードの二重実行防止・タイムアウト保護・失敗耐性・進捗通知を管理する純粋コントローラ。
 */
export function createStartupLoader(deps: StartupLoaderDeps) {
  let inflightPromise: Promise<StartupLoadResult> | null = null
  let cachedResult: StartupLoadResult | null = null
  const timeoutMs = deps.timeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS
  const concurrency = Math.max(1, deps.concurrency ?? DEFAULT_STARTUP_CONCURRENCY)

  const run = (): Promise<StartupLoadResult> => {
    if (cachedResult) return Promise.resolve(cachedResult)
    if (inflightPromise) return inflightPromise

    const failedAssets: string[] = []
    const tasks: Array<{ id: string; exec: () => Promise<boolean> }> = [
      ...ALL_STARTUP_IMAGES.map((src) => ({
        id: src,
        exec: () => deps.loadImage(src),
      })),
      ...ALL_STARTUP_SE.map((key) => ({
        id: `se:${key}`,
        exec: () => deps.loadSe(key),
      })),
    ]

    const total = tasks.length
    let loaded = 0
    deps.onProgress?.(0, total)

    const loadTask = (async (): Promise<StartupLoadResult> => {
      let nextIndex = 0
      const workerCount = Math.min(concurrency, total)
      const runWorker = async () => {
        while (nextIndex < total) {
          const task = tasks[nextIndex++]!
          try {
            const ok = await task.exec()
            if (!ok) failedAssets.push(task.id)
          } catch {
            failedAssets.push(task.id)
          } finally {
            loaded++
            deps.onProgress?.(loaded, total)
          }
        }
      }
      await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
      return { completed: true, failedAssets, timedOut: false }
    })()

    let timerId: ReturnType<typeof setTimeout> | null = null
    const timeoutTask = new Promise<StartupLoadResult>((resolve) => {
      timerId = setTimeout(() => {
        resolve({ completed: true, failedAssets: [...failedAssets, 'timeout'], timedOut: true })
      }, timeoutMs)
    })

    inflightPromise = Promise.race([loadTask, timeoutTask]).then((res) => {
      if (timerId !== null) {
        clearTimeout(timerId)
        timerId = null
      }
      cachedResult = res
      inflightPromise = null
      return res
    })

    return inflightPromise
  }

  const reset = () => {
    inflightPromise = null
    cachedResult = null
  }

  return { run, reset }
}

/**
 * ブラウザ環境向けの画像プリロード・デコードヘルパー
 */
export function preloadAndDecodeImage(src: string): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(true)
  return new Promise((resolve) => {
    const img = new Image()
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(
          () => finish(true),
          () => finish(true),
        )
      } else {
        finish(true)
      }
    }
    img.onerror = () => finish(false)
    img.src = src
  })
}
