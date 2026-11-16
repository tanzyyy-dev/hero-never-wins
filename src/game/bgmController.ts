export type BgmTrack = 'opening' | 'pre_battle' | 'battle' | 'gameover' | null

export type NonNullBgmTrack = Exclude<BgmTrack, null>

export type BgmPathMap = Record<NonNullBgmTrack, string[]>

export const DEFAULT_BGM_PATHS: BgmPathMap = {
  opening: ['audio/bgm_opening.mp3'],
  pre_battle: ['audio/bgm_pre_battle.mp3'],
  battle: ['audio/bgm_battle.mp3'],
  gameover: ['audio/bgm_gameover.mp3'],
}

export const MAX_BGM_RETRY = 2

export type BgmPlayErrorKind = 'aborted' | 'not_allowed' | 'other'

export interface BgmErrorRecord {
  kind: BgmPlayErrorKind
  name: string
  message: string
  track: BgmTrack
  src: string
}

/**
 * play() 失敗時のエラー種別を分類する。
 * - AbortError: トラック切り替えや pause() による正常キャンセル
 * - NotAllowedError: iOS WebKit / ブラウザの自動再生制限
 * - その他: デコード・ネットワーク等の一時的エラー
 */
export function classifyBgmPlayError(err: unknown): { kind: BgmPlayErrorKind; name: string; message: string } {
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; message?: unknown }
    const name = typeof e.name === 'string' ? e.name : 'Error'
    const message = typeof e.message === 'string' ? e.message : String(err)
    if (name === 'AbortError') {
      return { kind: 'aborted', name, message }
    }
    if (name === 'NotAllowedError') {
      return { kind: 'not_allowed', name, message }
    }
    return { kind: 'other', name, message }
  }
  return { kind: 'other', name: 'UnknownError', message: String(err) }
}

/**
 * 一時的エラー後のリトライ待機時間（ms）を返す。上限到達時は null。
 */
export function getBgmRetryDelayMs(retryCount: number): number | null {
  if (retryCount < 0 || retryCount >= MAX_BGM_RETRY) return null
  return 500 * (retryCount + 1)
}

export interface BgmAudioElementLike {
  src: string
  loop: boolean
  volume: number
  muted: boolean
  paused: boolean
  currentTime: number
  play: () => Promise<void> | undefined
  pause: () => void
  load?: () => void
  removeAttribute?: (name: string) => void
  onended?: ((...args: never[]) => unknown) | null
  onerror?: ((...args: never[]) => unknown) | null
}

export interface BgmScheduler {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void
}

const defaultScheduler: BgmScheduler = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
}

/**
 * 単一 HTMLAudioElement を再利用して BGM 再生を管理するコントローラ。
 * - トラック切り替え時に Audio 要素を再生成しない
 * - 音量変更・ミュート変更とトラック切り替えを分離
 * - requestId による非同期 play() 競合ガード
 * - NotAllowedError は次のユーザー操作で再試行、その他エラーは回数制限付きで再試行
 */
export class BgmPlayerController {
  private audio: BgmAudioElementLike | null = null
  private createAudio: () => BgmAudioElementLike
  private paths: BgmPathMap
  private scheduler: BgmScheduler

  private desiredTrack: BgmTrack = null
  private loadedTrack: NonNullBgmTrack | null = null
  private unlocked = false
  private muted = false
  private volume = 0.38

  private requestId = 0
  private retryCount = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private pendingUserGestureRetry = false
  private lastError: BgmErrorRecord | null = null
  private onError?: (record: BgmErrorRecord) => void

  constructor(
    createAudio: () => BgmAudioElementLike,
    options?: {
      paths?: BgmPathMap
      scheduler?: BgmScheduler
      onError?: (record: BgmErrorRecord) => void
      initialVolume?: number
    },
  ) {
    this.createAudio = createAudio
    this.paths = options?.paths ?? DEFAULT_BGM_PATHS
    this.scheduler = options?.scheduler ?? defaultScheduler
    this.onError = options?.onError
    if (options?.initialVolume !== undefined) {
      this.volume = options.initialVolume
    }
  }

  private ensureAudio(): BgmAudioElementLike {
    if (!this.audio) {
      const el = this.createAudio()
      el.loop = true
      el.volume = this.volume
      el.muted = this.muted
      this.audio = el
    }
    return this.audio
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      this.scheduler.clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  getAudio(): BgmAudioElementLike | null {
    return this.audio
  }

  isUnlocked(): boolean {
    return this.unlocked
  }

  hasPendingUserGestureRetry(): boolean {
    return this.pendingUserGestureRetry
  }

  getLastError(): BgmErrorRecord | null {
    return this.lastError
  }

  getDesiredTrack(): BgmTrack {
    return this.desiredTrack
  }

  getLoadedTrack(): NonNullBgmTrack | null {
    return this.loadedTrack
  }

  /**
   * 音量のみを更新する（トラック切り替えや pause/play を発生させない）
   */
  setVolume(volume: number): void {
    this.volume = volume
    if (this.audio) {
      this.audio.volume = volume
    }
  }

  /**
   * ミュート状態を更新する（タブ非表示・ユーザーミュート兼用）
   */
  setMuted(muted: boolean): void {
    const prevMuted = this.muted
    this.muted = muted
    if (this.audio) {
      this.audio.muted = muted
    }
    if (muted) {
      this.clearRetryTimer()
      if (this.audio && !this.audio.paused) {
        this.requestId++
        this.audio.pause()
      }
      return
    }
    // ミュート解除時、再生すべきトラックがあれば再開
    if (prevMuted && this.unlocked && this.desiredTrack) {
      this.resumeOrStartDesiredTrack()
    }
  }

  /**
   * ユーザー操作イベント内で呼び出し、再生許可の確立および保留中の再試行を行う
   */
  unlockFromUserGesture(): boolean {
    const wasUnlocked = this.unlocked
    this.unlocked = true
    const shouldAttemptPlay =
      this.desiredTrack !== null &&
      !this.muted &&
      (this.pendingUserGestureRetry || !wasUnlocked || Boolean(this.audio?.paused))

    if (shouldAttemptPlay) {
      this.pendingUserGestureRetry = false
      this.resumeOrStartDesiredTrack()
    }
    return !wasUnlocked
  }

  /**
   * トラックを切り替える
   */
  setTrack(track: BgmTrack): void {
    const prevTrack = this.desiredTrack
    this.desiredTrack = track

    if (!track) {
      this.requestId++
      this.clearRetryTimer()
      this.pendingUserGestureRetry = false
      this.loadedTrack = null
      if (this.audio) {
        this.audio.pause()
        this.audio.currentTime = 0
      }
      return
    }

    if (!this.unlocked) {
      return
    }

    if (prevTrack === track && this.loadedTrack === track && this.audio) {
      if (!this.muted && this.audio.paused) {
        this.startPlayForTrack(track, 0, false)
      }
      return
    }

    this.retryCount = 0
    this.pendingUserGestureRetry = false
    this.startPlayForTrack(track, 0, this.loadedTrack !== track)
  }

  private resumeOrStartDesiredTrack(): void {
    const track = this.desiredTrack
    if (!track || !this.unlocked || this.muted) return
    const needsLoad = this.loadedTrack !== track
    this.startPlayForTrack(track, 0, needsLoad)
  }

  private startPlayForTrack(track: NonNullBgmTrack, pathIndex: number, loadNewSrc: boolean): void {
    this.clearRetryTimer()
    const paths = this.paths[track]
    if (pathIndex >= paths.length) return

    const src = paths[pathIndex]!
    const audio = this.ensureAudio()
    const currentReqId = ++this.requestId

    audio.loop = true
    audio.volume = this.volume
    audio.muted = this.muted

    if (loadNewSrc) {
      this.loadedTrack = track
      audio.src = src
      audio.currentTime = 0
      audio.load?.()
    }

    audio.onerror = () => {
      if (currentReqId !== this.requestId) return
      if (this.desiredTrack !== track) return
      const nextIndex = pathIndex + 1
      if (nextIndex < paths.length) {
        this.startPlayForTrack(track, nextIndex, true)
      } else {
        this.recordError({
          kind: 'other',
          name: 'MediaError',
          message: `Failed to load audio source for ${track}`,
          track,
          src,
        })
      }
    }

    if (this.muted) {
      return
    }

    let playResult: Promise<void> | undefined
    try {
      playResult = audio.play()
    } catch (err) {
      this.handlePlayFailure(err, currentReqId, track, pathIndex, src)
      return
    }

    if (playResult && typeof playResult.then === 'function') {
      playResult.then(
        () => {
          if (currentReqId !== this.requestId) return
          this.retryCount = 0
          this.pendingUserGestureRetry = false
        },
        (err) => {
          this.handlePlayFailure(err, currentReqId, track, pathIndex, src)
        },
      )
    }
  }

  private handlePlayFailure(
    err: unknown,
    reqId: number,
    track: NonNullBgmTrack,
    pathIndex: number,
    src: string,
  ): void {
    if (reqId !== this.requestId) return
    if (this.desiredTrack !== track) return

    const classified = classifyBgmPlayError(err)
    if (classified.kind === 'aborted') {
      return
    }

    const record: BgmErrorRecord = {
      kind: classified.kind,
      name: classified.name,
      message: classified.message,
      track,
      src,
    }
    this.recordError(record)

    if (classified.kind === 'not_allowed') {
      this.pendingUserGestureRetry = true
      return
    }

    const delay = getBgmRetryDelayMs(this.retryCount)
    if (delay !== null) {
      this.retryCount++
      this.retryTimer = this.scheduler.setTimeout(() => {
        if (reqId !== this.requestId) return
        if (this.desiredTrack !== track || this.muted || !this.unlocked) return
        this.startPlayForTrack(track, pathIndex, false)
      }, delay)
    }
  }

  private recordError(record: BgmErrorRecord): void {
    this.lastError = record
    this.onError?.(record)
  }

  dispose(): void {
    this.requestId++
    this.clearRetryTimer()
    this.pendingUserGestureRetry = false
    this.loadedTrack = null
    if (this.audio) {
      this.audio.onerror = null
      this.audio.onended = null
      this.audio.pause()
      this.audio.removeAttribute?.('src')
      this.audio.load?.()
      this.audio = null
    }
  }
}
