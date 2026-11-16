import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BgmPlayerController,
  MAX_BGM_RETRY,
  classifyBgmPlayError,
  getBgmRetryDelayMs,
  type BgmAudioElementLike,
} from './bgmController.ts'
import {
  ALL_STARTUP_IMAGES,
  ALL_STARTUP_SE,
  createStartupLoader,
} from './startupLoader.ts'

class MockAudio implements BgmAudioElementLike {
  src = ''
  loop = false
  volume = 1
  muted = false
  paused = true
  currentTime = 0
  onerror: (() => void) | null = null
  onended: (() => void) | null = null

  playCalls: Array<{ src: string }> = []
  pauseCalls = 0
  loadCalls = 0
  nextPlayImpl: (() => Promise<void> | undefined) | null = null

  play(): Promise<void> | undefined {
    this.playCalls.push({ src: this.src })
    if (this.nextPlayImpl) {
      const impl = this.nextPlayImpl
      this.nextPlayImpl = null
      return impl()
    }
    this.paused = false
    return Promise.resolve()
  }

  pause(): void {
    this.pauseCalls++
    this.paused = true
  }

  load(): void {
    this.loadCalls++
  }

  removeAttribute(name: string): void {
    if (name === 'src') {
      this.src = ''
    }
  }
}

describe('BgmPlayerController', () => {
  it('単一 HTMLAudioElement を再利用して連続トラック切り替えができる', async () => {
    let createdCount = 0
    const audio = new MockAudio()
    const ctrl = new BgmPlayerController(() => {
      createdCount++
      return audio
    })

    ctrl.unlockFromUserGesture()
    ctrl.setTrack('opening')
    await Promise.resolve()
    assert.equal(createdCount, 1)
    assert.equal(audio.src, 'audio/bgm_opening.mp3')
    assert.equal(audio.playCalls.length, 1)

    ctrl.setTrack('pre_battle')
    await Promise.resolve()
    assert.equal(createdCount, 1)
    assert.equal(audio.src, 'audio/bgm_pre_battle.mp3')

    ctrl.setTrack('battle')
    await Promise.resolve()
    assert.equal(createdCount, 1)
    assert.equal(audio.src, 'audio/bgm_battle.mp3')

    // 2回目の雑魚戦への復帰でも Audio 要素を再生成しない
    ctrl.setTrack('pre_battle')
    await Promise.resolve()
    assert.equal(createdCount, 1)
    assert.equal(audio.src, 'audio/bgm_pre_battle.mp3')
    assert.equal(audio.paused, false)
    assert.equal(audio.playCalls.length, 4)

    ctrl.dispose()
  })

  it('音量変更はトラック切り替えや pause/play を発生させない', async () => {
    const audio = new MockAudio()
    const ctrl = new BgmPlayerController(() => audio)
    ctrl.unlockFromUserGesture()
    ctrl.setTrack('pre_battle')
    await Promise.resolve()

    const playBefore = audio.playCalls.length
    const pauseBefore = audio.pauseCalls
    const loadBefore = audio.loadCalls

    ctrl.setVolume(0.19)
    assert.equal(audio.volume, 0.19)
    assert.equal(audio.playCalls.length, playBefore)
    assert.equal(audio.pauseCalls, pauseBefore)
    assert.equal(audio.loadCalls, loadBefore)

    ctrl.setVolume(0.38)
    assert.equal(audio.volume, 0.38)
    assert.equal(audio.playCalls.length, playBefore)

    ctrl.dispose()
  })

  it('NotAllowedError 時は次のユーザー操作で復旧し、無限リトライしない', async () => {
    const audio = new MockAudio()
    const errors: string[] = []
    const ctrl = new BgmPlayerController(() => audio, {
      onError: (rec) => errors.push(`${rec.kind}:${rec.name}`),
    })

    const notAllowed = Object.assign(new Error('not allowed'), { name: 'NotAllowedError' })
    audio.nextPlayImpl = () => Promise.reject(notAllowed)

    ctrl.unlockFromUserGesture()
    ctrl.setTrack('pre_battle')
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(ctrl.hasPendingUserGestureRetry(), true)
    assert.equal(errors[0], 'not_allowed:NotAllowedError')
    assert.equal(audio.playCalls.length, 1)

    // 次のユーザー操作で再生再開
    ctrl.unlockFromUserGesture()
    await Promise.resolve()
    assert.equal(ctrl.hasPendingUserGestureRetry(), false)
    assert.equal(audio.playCalls.length, 2)
    assert.equal(audio.paused, false)

    ctrl.dispose()
  })

  it('一時的エラー時は上限回数内でバックオフ再試行し、成功でリセットされる', async () => {
    const audio = new MockAudio()
    const scheduled: Array<() => void> = []
    const ctrl = new BgmPlayerController(() => audio, {
      scheduler: {
        setTimeout: (fn) => {
          scheduled.push(fn)
          return scheduled.length as unknown as ReturnType<typeof setTimeout>
        },
        clearTimeout: () => {},
      },
    })

    ctrl.unlockFromUserGesture()
    audio.nextPlayImpl = () => Promise.reject(new Error('network hiccup'))
    ctrl.setTrack('battle')
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(scheduled.length, 1)
    assert.equal(getBgmRetryDelayMs(0), 500)
    assert.equal(getBgmRetryDelayMs(MAX_BGM_RETRY), null)

    // 2回目も失敗
    audio.nextPlayImpl = () => Promise.reject(new Error('network hiccup 2'))
    scheduled.shift()!()
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(scheduled.length, 1)

    // 3回目も失敗 → 上限到達でこれ以上スケジュールされない
    audio.nextPlayImpl = () => Promise.reject(new Error('network hiccup 3'))
    scheduled.shift()!()
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(scheduled.length, 0)

    ctrl.dispose()
  })

  it('再生 Promise の競合時に古い失敗・成功結果を破棄する', async () => {
    const audio = new MockAudio()
    const errors: string[] = []
    const ctrl = new BgmPlayerController(() => audio, {
      onError: (rec) => errors.push(rec.track ?? 'none'),
    })

    let rejectFirst!: (err: unknown) => void
    audio.nextPlayImpl = () =>
      new Promise<void>((_resolve, reject) => {
        rejectFirst = reject
      })

    ctrl.unlockFromUserGesture()
    ctrl.setTrack('opening')

    // opening の play() 解決前に battle へ切り替え
    ctrl.setTrack('battle')
    await Promise.resolve()
    assert.equal(audio.src, 'audio/bgm_battle.mp3')

    // 古い opening の play() が失敗しても無視される
    rejectFirst(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }))
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(errors.length, 0)
    assert.equal(ctrl.hasPendingUserGestureRetry(), false)
    assert.equal(ctrl.getDesiredTrack(), 'battle')

    // AbortError もエラー記録されない
    assert.equal(classifyBgmPlayError({ name: 'AbortError', message: 'aborted' }).kind, 'aborted')

    ctrl.dispose()
  })

  it('ミュート（タブ非表示含む）と解除・復帰が正しく連動する', async () => {
    const audio = new MockAudio()
    const ctrl = new BgmPlayerController(() => audio)
    ctrl.unlockFromUserGesture()
    ctrl.setTrack('pre_battle')
    await Promise.resolve()
    assert.equal(audio.paused, false)

    // タブ非表示相当（effectiveMuted = true）
    ctrl.setMuted(true)
    assert.equal(audio.muted, true)
    assert.equal(audio.paused, true)

    // タブ復帰相当（effectiveMuted = false）
    ctrl.setMuted(false)
    await Promise.resolve()
    assert.equal(audio.muted, false)
    assert.equal(audio.paused, false)

    ctrl.dispose()
  })
})

describe('startupLoader', () => {
  it('全画像・全SEの読み込み成功を完了し、進捗通知と二重実行防止ができる', async () => {
    let imageCalls = 0
    let seCalls = 0
    const progressEvents: Array<[number, number]> = []
    const loader = createStartupLoader({
      loadImage: async () => {
        imageCalls++
        return true
      },
      loadSe: async () => {
        seCalls++
        return true
      },
      onProgress: (loaded, total) => progressEvents.push([loaded, total]),
      timeoutMs: 2000,
    })

    const [res1, res2] = await Promise.all([loader.run(), loader.run()])
    const expectedTotal = ALL_STARTUP_IMAGES.length + ALL_STARTUP_SE.length
    assert.equal(res1.completed, true)
    assert.equal(res1.timedOut, false)
    assert.equal(res1.failedAssets.length, 0)
    assert.deepEqual(res1, res2)
    assert.equal(imageCalls, ALL_STARTUP_IMAGES.length)
    assert.equal(seCalls, ALL_STARTUP_SE.length)
    assert.deepEqual(progressEvents[0], [0, expectedTotal])
    assert.deepEqual(progressEvents[progressEvents.length - 1], [expectedTotal, expectedTotal])

    // 完了後の再呼び出しもキャッシュを返す
    const res3 = await loader.run()
    assert.equal(res3, res1)
    assert.equal(seCalls, ALL_STARTUP_SE.length)
  })

  it('アセット失敗やタイムアウト時も無限ロードにならず completed を返す', async () => {
    const failLoader = createStartupLoader({
      loadImage: async (src) => src !== ALL_STARTUP_IMAGES[0],
      loadSe: async (key) => key !== ALL_STARTUP_SE[0],
      timeoutMs: 2000,
    })
    const failRes = await failLoader.run()
    assert.equal(failRes.completed, true)
    assert.equal(failRes.timedOut, false)
    assert.ok(failRes.failedAssets.includes(ALL_STARTUP_IMAGES[0]!))
    assert.ok(failRes.failedAssets.includes(`se:${ALL_STARTUP_SE[0]!}`))

    const timeoutLoader = createStartupLoader({
      loadImage: () => new Promise(() => {}),
      loadSe: () => new Promise(() => {}),
      timeoutMs: 25,
    })
    const timeoutRes = await timeoutLoader.run()
    assert.equal(timeoutRes.completed, true)
    assert.equal(timeoutRes.timedOut, true)
  })
})
