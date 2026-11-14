// =========================================================
// Pachislot High-Performance Sound Effects Engine (Web Audio)
// =========================================================

export type SeKey =
  | 'bet'
  | 'lever'
  | 'stop'
  | 'payout'
  | 'replay'
  | 'zako_hit'
  | 'voice_bonus_get'
  | 'voice_enemy_01'
  | 'voice_enemy_02'
  | 'voice_enemy_03'
  | 'voice_round_start'
  | 'voice_left_navi'
  | 'voice_middle_navi'
  | 'voice_right_navi'
  | 'voice_hero_provocation'
  | 'voice_boss_provocation'
  | 'voice_hero_damage'
  | 'voice_boss_damage'
  | 'voice_hero_special_attack'
  | 'voice_boss_spacial_attack'
  | 'voice_fellow'
  | 'voice_fellow_continue'
  | 'voice_support'

const SE_FILES: Record<SeKey, string> = {
  bet: 'audio/se_max_bet_v2_heavy.wav',
  lever: 'audio/se_reel_start_heavy.wav',
  stop: 'audio/se_reel_stop_punch.wav',
  payout: 'audio/se_credit_get_deep_v3.wav',
  replay: 'audio/se_replay.wav',
  zako_hit: 'audio/se_zako_hit.wav',
  voice_bonus_get: 'audio/voice_bonus_get.wav',
  voice_enemy_01: 'audio/voice_enemy_01.wav',
  voice_enemy_02: 'audio/voice_enemy_02.wav',
  voice_enemy_03: 'audio/voice_enemy_03.wav',
  voice_round_start: 'audio/voice_round_start.wav',
  voice_left_navi: 'audio/voice_left_navi.wav',
  voice_middle_navi: 'audio/voice_middle_navi.wav',
  voice_right_navi: 'audio/voice_right_navi.wav',
  voice_hero_provocation: 'audio/voice_hero_provocation.wav',
  voice_boss_provocation: 'audio/voice_boss_provocation.wav',
  voice_hero_damage: 'audio/voice_hero_damage.wav',
  voice_boss_damage: 'audio/voice_boss_damage.wav',
  voice_hero_special_attack: 'audio/voice_hero_special_attack.wav',
  voice_boss_spacial_attack: 'audio/voice_boss_spacial_attack.wav',
  voice_fellow: 'audio/voice_fellow.wav',
  voice_fellow_continue: 'audio/voice_fellow_continue.wav',
  voice_support: 'audio/voice_support.wav',
}

let sharedAudioContext: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    sharedAudioContext = new AudioCtx()
  }
  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume()
  }
  return sharedAudioContext
}

export function suspendSeAudio(): void {
  stopVoiceSe()
  if (sharedAudioContext && sharedAudioContext.state === 'running') {
    void sharedAudioContext.suspend().catch(() => {
      // ignore
    })
  }
}

export function resumeSeAudio(): void {
  if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume().catch(() => {
      // ignore
    })
  }
}

const bufferCache = new Map<SeKey, AudioBuffer>()
const loadPromises = new Map<SeKey, Promise<AudioBuffer | null>>()

export async function preloadSe(key: SeKey): Promise<AudioBuffer | null> {
  if (bufferCache.has(key)) return bufferCache.get(key)!
  if (loadPromises.has(key)) return loadPromises.get(key)!

  const promise = (async () => {
    try {
      const response = await fetch(SE_FILES[key])
      if (!response.ok) return null
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('text/html')) return null
      const arrayBuffer = await response.arrayBuffer()
      const ctx = getAudioContext()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      bufferCache.set(key, audioBuffer)
      return audioBuffer
    } catch {
      return null
    }
  })()

  loadPromises.set(key, promise)
  return promise
}

/**
 * すべての効果音WAVを先行デコードしてキャッシュする
 */
export function preloadAllSe() {
  ; (Object.keys(SE_FILES) as SeKey[]).forEach((key) => {
    void preloadSe(key)
  })
}

/**
 * 低遅延でWAV効果音を発音する
 * @param key 効果音キー
 * @param volume 音量 (0.0〜1.0)
 * @param pitch ピッチ倍率 (1.0 = 原音)
 */
export function playWavSe(key: SeKey, volume = 0.7, pitch = 1.0): void {
  try {
    const ctx = getAudioContext()
    const buffer = bufferCache.get(key)
    if (!buffer) {
      // 未完了時はロード後に即時再生
      void preloadSe(key).then((loadedBuf) => {
        if (!loadedBuf) return
        const source = ctx.createBufferSource()
        source.buffer = loadedBuf
        source.playbackRate.value = pitch
        const gain = ctx.createGain()
        gain.gain.value = volume
        source.connect(gain).connect(ctx.destination)
        source.start(0)
      })
      return
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = pitch

    const gain = ctx.createGain()
    gain.gain.value = volume

    source.connect(gain).connect(ctx.destination)
    source.start(0)
  } catch (err) {
    console.warn(`[SE] Could not play ${key}:`, err)
  }
}

let currentVoiceSource: AudioBufferSourceNode | null = null

/**
 * ボイス用専用再生（新規ボイス再生時に直前のボイスを停止してクリアに切り替え）
 * @param key ボイスキー
 * @param volume 音量 (0.0〜1.0)
 * @param pitch ピッチ倍率 (1.0 = 原音)
 */
export function playVoiceSe(key: SeKey, volume = 0.95, pitch = 1.0): void {
  try {
    if (typeof window !== 'undefined') {
      ; (window as unknown as { __onVoicePlay?: (k: SeKey) => void }).__onVoicePlay?.(key)
    }
    const ctx = getAudioContext()
    if (currentVoiceSource) {
      try {
        currentVoiceSource.stop()
      } catch {
        // already stopped
      }
      currentVoiceSource = null
    }

    const buffer = bufferCache.get(key)
    if (!buffer) {
      void preloadSe(key).then((loadedBuf) => {
        if (!loadedBuf) return
        const source = ctx.createBufferSource()
        source.buffer = loadedBuf
        source.playbackRate.value = pitch
        const gain = ctx.createGain()
        gain.gain.value = volume
        source.connect(gain).connect(ctx.destination)
        source.start(0)
        currentVoiceSource = source
        source.onended = () => {
          if (currentVoiceSource === source) {
            currentVoiceSource = null
          }
        }
      })
      return
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = pitch

    const gain = ctx.createGain()
    gain.gain.value = volume

    source.connect(gain).connect(ctx.destination)
    source.start(0)
    currentVoiceSource = source
    source.onended = () => {
      if (currentVoiceSource === source) {
        currentVoiceSource = null
      }
    }
  } catch (err) {
    console.warn(`[Voice] Could not play ${key}:`, err)
  }
}

/**
 * 再生中のボイスを即座に停止する
 */
export function stopVoiceSe(): void {
  if (currentVoiceSource) {
    try {
      currentVoiceSource.stop()
    } catch {
      // already stopped
    }
    currentVoiceSource = null
  }
}

/**
 * チェリー成立時の専用SE（「ピキーン！」という鋭い金属的・電子的な高音SE）
 * - 短い立ち上がり、強いアタック、余韻のある響き
 * - Web Audio API によるオリジナル合成音
 */
export function playCherrySe(volume = 0.75): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(volume, now)
    masterGain.connect(ctx.destination)

    // 1. 鋭い立ち上がりスイープ（「ピキッ」のアタック）
    const sweepOsc = ctx.createOscillator()
    const sweepGain = ctx.createGain()
    sweepOsc.type = 'sine'
    sweepOsc.frequency.setValueAtTime(1320, now)
    sweepOsc.frequency.exponentialRampToValueAtTime(2793.83, now + 0.028)
    sweepGain.gain.setValueAtTime(0.001, now)
    sweepGain.gain.linearRampToValueAtTime(0.32, now + 0.005)
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72)
    sweepOsc.connect(sweepGain).connect(masterGain)
    sweepOsc.start(now)
    sweepOsc.stop(now + 0.74)

    // 2. 金属的・電子的な倍音レイヤー（「キーン！」の響きと余韻）
    const harmonics: Array<{ freq: number; type: OscillatorType; peak: number; dur: number; delay: number }> = [
      { freq: 2637.02, type: 'triangle', peak: 0.22, dur: 0.68, delay: 0.01 },
      { freq: 3951.07, type: 'sine', peak: 0.16, dur: 0.62, delay: 0.015 },
      { freq: 5274.04, type: 'sine', peak: 0.11, dur: 0.52, delay: 0.02 },
    ]

    harmonics.forEach((h) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t0 = now + h.delay
      osc.type = h.type
      osc.frequency.setValueAtTime(h.freq, t0)
      gain.gain.setValueAtTime(0.001, t0)
      gain.gain.linearRampToValueAtTime(h.peak, t0 + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + h.dur)
      osc.connect(gain).connect(masterGain)
      osc.start(t0)
      osc.stop(t0 + h.dur + 0.02)
    })

    // 3. 高域アタック・スパーク（短い金属打撃ノイズ）
    const noiseLen = Math.floor(ctx.sampleRate * 0.03)
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseLen * 0.25))
    }
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = noiseBuf
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(4800, now)
    filter.Q.setValueAtTime(3.0, now)
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.28, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)
    noiseSrc.connect(filter).connect(noiseGain).connect(masterGain)
    noiseSrc.start(now)
  } catch (err) {
    console.warn('[SE] Could not play cherry SE:', err)
  }
}

export type BattleSeType =
  | 'standoff'
  | 'tension'
  | 'cut_in'
  | 'charge'
  | 'release'
  | 'heavy_hit'
  | 'endure'
  | 'endure_peak'
  | 'kai_arrive'
  | 'kai_parry'
  | 'ally_afterglow'
  | 'false_defeat'
  | 'chance_press'
  | 'revive_fanfare'
  | 'continue_fanfare'
  | 'defeat_toll'
  | 'emblem_slam'

export interface BattleSeOptions {
  /** 攻撃側（3G〜5G）。主人公は明るく鋭い音色、敵は暗く歪んだ音色にする */
  side?: 'hero' | 'boss'
  /** CONTINUEエンブレムのスラム位置（秒）。表示側の遅延スラムと合わせる */
  slamDelaySec?: number
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number, decayRatio = 0.35): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * durationSec))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  const tau = Math.max(1, len * decayRatio)
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / tau)
  }
  return buf
}

function triggerSweepOsc(
  ctx: AudioContext,
  dest: AudioNode,
  startTime: number,
  duration: number,
  type: OscillatorType,
  fStart: number,
  fEnd: number,
  peakGain: number,
  attackSec = 0.004
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(Math.max(20, fStart), startTime)
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), startTime + duration)
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.linearRampToValueAtTime(peakGain, startTime + attackSec)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.connect(gain).connect(dest)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.02)
}

function triggerFilteredNoise(
  ctx: AudioContext,
  dest: AudioNode,
  startTime: number,
  duration: number,
  filterType: BiquadFilterType,
  fStart: number,
  fEnd: number,
  q: number,
  peakGain: number,
  attackSec = 0.004,
  decayRatio = 0.4
): void {
  const src = ctx.createBufferSource()
  src.buffer = createNoiseBuffer(ctx, duration, decayRatio)
  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.Q.setValueAtTime(q, startTime)
  filter.frequency.setValueAtTime(Math.max(40, fStart), startTime)
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, fEnd), startTime + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.linearRampToValueAtTime(peakGain, startTime + attackSec)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  src.connect(filter).connect(gain).connect(dest)
  src.start(startTime)
}

// ---------------------------------------------------------
// BATTLE MODE 用の空間・質感ユーティリティ
// ---------------------------------------------------------

let battleReverbCache: { ctx: AudioContext; node: ConvolverNode } | null = null

/** 闘技場の残響（合成インパルス応答のホールリバーブ）。AudioContextごとに1つだけ生成する */
function getBattleReverb(ctx: AudioContext): ConvolverNode {
  if (battleReverbCache && battleReverbCache.ctx === ctx) return battleReverbCache.node
  const len = Math.floor(ctx.sampleRate * 1.8)
  const ir = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4)
    }
  }
  const node = ctx.createConvolver()
  node.buffer = ir
  node.connect(ctx.destination)
  battleReverbCache = { ctx, node }
  return node
}

let driveCurveCache: Float32Array<ArrayBuffer> | null = null

/** 打撃の芯を太くするソフトクリップ歪み */
function createDrive(ctx: AudioContext, dest: AudioNode): WaveShaperNode {
  if (!driveCurveCache) {
    const n = 1024
    const curve = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1
      curve[i] = Math.tanh(x * 3.2)
    }
    driveCurveCache = curve
  }
  const shaper = ctx.createWaveShaper()
  shaper.curve = driveCurveCache
  shaper.oversample = '2x'
  shaper.connect(dest)
  return shaper
}

/** ドライ出力＋リバーブ送りを持つ1発ぶんのバス */
function createBattleBus(ctx: AudioContext, volume: number, reverbSend: number, startTime: number): GainNode {
  const master = ctx.createGain()
  master.gain.setValueAtTime(volume, startTime)
  master.connect(ctx.destination)
  if (reverbSend > 0) {
    const send = ctx.createGain()
    send.gain.setValueAtTime(reverbSend, startTime)
    master.connect(send).connect(getBattleReverb(ctx))
  }
  return master
}

/** 心音（ドクン）：低い「ド」＋少し遅れた「クン」 */
function triggerHeartbeat(ctx: AudioContext, dest: AudioNode, t: number, peak: number): void {
  triggerSweepOsc(ctx, dest, t, 0.18, 'sine', 78, 36, peak, 0.006)
  triggerFilteredNoise(ctx, dest, t, 0.09, 'lowpass', 280, 110, 0.7, peak * 0.35, 0.003, 0.3)
  triggerSweepOsc(ctx, dest, t + 0.2, 0.15, 'sine', 66, 32, peak * 0.72, 0.006)
}

/**
 * トレモロ付きライザー（溜め・煽り）。終端で鋭く音を切り、結末を見せない「間」を作る
 */
function triggerTremoloRiser(
  ctx: AudioContext,
  dest: AudioNode,
  t: number,
  dur: number,
  type: OscillatorType,
  fStart: number,
  fEnd: number,
  peak: number,
  lfoStart: number,
  lfoEnd: number,
  lowpassHz?: number
): void {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(fStart, t)
  osc.frequency.exponentialRampToValueAtTime(fEnd, t + dur)

  const amp = ctx.createGain()
  amp.gain.setValueAtTime(0.55, t)
  const lfo = ctx.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(lfoStart, t)
  lfo.frequency.exponentialRampToValueAtTime(lfoEnd, t + dur)
  const lfoDepth = ctx.createGain()
  lfoDepth.gain.setValueAtTime(0.45, t)
  lfo.connect(lfoDepth).connect(amp.gain)

  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(peak, t + dur * 0.94)
  env.gain.linearRampToValueAtTime(0.0001, t + dur + 0.025)

  let chainHead: AudioNode = amp
  osc.connect(amp)
  if (lowpassHz) {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(lowpassHz * 0.35, t)
    lp.frequency.exponentialRampToValueAtTime(lowpassHz, t + dur)
    lp.Q.setValueAtTime(4, t)
    amp.connect(lp)
    chainHead = lp
  }
  chainHead.connect(env).connect(dest)

  osc.start(t)
  lfo.start(t)
  osc.stop(t + dur + 0.05)
  lfo.stop(t + dur + 0.05)
}

/** 確定音「キュイーン」：ビブラート付きで駆け上がって伸びる高音 */
function triggerKyuin(ctx: AudioContext, dest: AudioNode, t: number, peak: number, holdSec = 0.55): void {
  ;[1, 2].forEach((mult, idx) => {
    const osc = ctx.createOscillator()
    osc.type = idx === 0 ? 'sine' : 'triangle'
    osc.frequency.setValueAtTime(620 * mult, t)
    osc.frequency.exponentialRampToValueAtTime(2349.32 * mult, t + 0.3)
    const vib = ctx.createOscillator()
    vib.frequency.setValueAtTime(13, t)
    const vibDepth = ctx.createGain()
    vibDepth.gain.setValueAtTime(0, t)
    vibDepth.gain.linearRampToValueAtTime(38 * mult, t + 0.35)
    vib.connect(vibDepth).connect(osc.frequency)
    const env = ctx.createGain()
    const p = idx === 0 ? peak : peak * 0.35
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(p, t + 0.03)
    env.gain.setValueAtTime(p, t + 0.3 + holdSec * 0.4)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3 + holdSec)
    osc.connect(env).connect(dest)
    const end = t + 0.32 + holdSec
    osc.start(t)
    vib.start(t)
    osc.stop(end)
    vib.stop(end)
  })
}

/** 鐘・銅鑼（非整数倍音の長い余韻） */
function triggerGong(ctx: AudioContext, dest: AudioNode, t: number, base: number, peak: number, decaySec: number): void {
  const partials: Array<[number, number, number]> = [
    [1, 1, 1],
    [2.76, 0.55, 0.7],
    [5.4, 0.3, 0.45],
    [8.93, 0.16, 0.3],
  ]
  partials.forEach(([ratio, amp, decay]) => {
    triggerSweepOsc(ctx, dest, t, decaySec * decay, 'sine', base * ratio, base * ratio * 0.985, peak * amp, 0.004)
  })
  triggerFilteredNoise(ctx, dest, t, 0.12, 'bandpass', 900, 300, 1.1, peak * 0.4, 0.002, 0.3)
}

/** 左右に流れる風切り（受け流し・逸らし用）。StereoPanner非対応環境では中央で鳴らす */
function triggerPannedWhoosh(ctx: AudioContext, dest: AudioNode, t: number, dur: number, peak: number): void {
  let out: AudioNode = dest
  if (typeof ctx.createStereoPanner === 'function') {
    const pan = ctx.createStereoPanner()
    pan.pan.setValueAtTime(-0.85, t)
    pan.pan.linearRampToValueAtTime(0.9, t + dur)
    pan.connect(dest)
    out = pan
  }
  triggerFilteredNoise(ctx, out, t, dur, 'bandpass', 1400, 4200, 2.2, peak, dur * 0.35, 1.2)
}

/**
 * BATTLE MODE 演出専用SE（Web Audio API 合成）
 * 8G構成・攻防順序は変えず、各Gの意味を音で強調する
 */
export function playBattleSe(type: BattleSeType, volume = 0.72, opts: BattleSeOptions = {}): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const isBoss = opts.side === 'boss'

    switch (type) {
      case 'standoff': {
        // 1G対峙：腹に響く太鼓「ドンッ」＋闘技場を抜ける風
        const bus = createBattleBus(ctx, volume, 0.4, now)
        triggerSweepOsc(ctx, bus, now, 0.55, 'sine', 112, 42, 0.72, 0.004)
        triggerSweepOsc(ctx, bus, now, 0.24, 'triangle', 190, 62, 0.28, 0.003)
        triggerFilteredNoise(ctx, bus, now, 0.2, 'lowpass', 700, 160, 0.8, 0.34, 0.002, 0.3)
        triggerFilteredNoise(ctx, bus, now + 0.05, 1.7, 'bandpass', 380, 1150, 0.8, 0.11, 0.45, 2.2)
        break
      }
      case 'tension': {
        // 2G緊張：心音2連＋張り詰める弦のトレモロ＋耳鳴り
        const bus = createBattleBus(ctx, volume, 0.28, now)
        triggerHeartbeat(ctx, bus, now, 0.62)
        triggerHeartbeat(ctx, bus, now + 0.66, 0.68)
        triggerTremoloRiser(ctx, bus, now, 1.35, 'sawtooth', 196, 247, 0.08, 6, 12, 1800)
        triggerSweepOsc(ctx, bus, now + 0.1, 1.3, 'sine', 3136, 3200, 0.028, 0.45)
        break
      }
      case 'cut_in': {
        // 3G先制カットイン：吸い込み→斬撃→「ジャキーン」金属スティンガー
        const bus = createBattleBus(ctx, volume, 0.42, now)
        const t1 = now + 0.08
        triggerFilteredNoise(ctx, bus, now, 0.09, 'bandpass', 600, 4200, 1.4, 0.32, 0.08, 3)
        triggerSweepOsc(ctx, bus, t1, 0.22, 'sawtooth', 160, 52, 0.34, 0.003)
        triggerFilteredNoise(ctx, bus, t1, 0.16, 'bandpass', 2600, 750, 1.8, 0.46, 0.003, 0.32)
        triggerSweepOsc(ctx, bus, t1, 0.3, 'sine', 130, 40, 0.5, 0.003)
        const base = isBoss ? 1244.51 : 1567.98
        const ratios: Array<[number, OscillatorType, number, number]> = [
          [1, 'triangle', 0.17, 0.75],
          [1.5, 'sine', 0.11, 0.62],
          [isBoss ? 1.94 : 2.01, 'sine', 0.08, 0.5],
          [2.76, 'sine', 0.05, 0.4],
        ]
        ratios.forEach(([r, wave, peak, dur]) => {
          triggerSweepOsc(ctx, bus, t1 + 0.01, dur, wave, base * r, base * r, peak, 0.002)
        })
        if (isBoss) {
          // 敵先制：歪んだ低い唸り
          const drive = createDrive(ctx, bus)
          triggerSweepOsc(ctx, drive, t1, 0.55, 'sawtooth', 82, 52, 0.16, 0.01)
        }
        break
      }
      case 'charge': {
        // 4G必殺技・前半：鼓動のように脈打ちながら高まるオーラ収束
        const bus = createBattleBus(ctx, volume, 0.32, now)
        triggerSweepOsc(ctx, bus, now, 0.32, 'sine', 92, 38, 0.5, 0.003)
        triggerTremoloRiser(ctx, bus, now, 1.3, 'sawtooth', isBoss ? 62 : 74, isBoss ? 196 : 247, 0.22, 5, 19, 1400)
        triggerTremoloRiser(ctx, bus, now + 0.05, 1.25, 'sine', 110, isBoss ? 370 : 466, 0.16, 5, 19)
        triggerFilteredNoise(ctx, bus, now, 1.3, 'bandpass', 300, 3200, 1.6, 0.15, 1.1, 3)
        if (isBoss) {
          const drive = createDrive(ctx, bus)
          triggerSweepOsc(ctx, drive, now, 1.2, 'sawtooth', 55, 73, 0.1, 0.2)
        }
        break
      }
      case 'release': {
        // 5G必殺技・後半：「キュイッ」と溜めを弾き、爆風のように解放
        const bus = createBattleBus(ctx, volume, 0.46, now)
        const t1 = now + 0.1
        triggerSweepOsc(ctx, bus, now, 0.12, 'sine', 520, isBoss ? 1900 : 2600, 0.2, 0.01)
        triggerFilteredNoise(ctx, bus, t1, 0.44, 'bandpass', 3800, 380, 1.0, 0.6, 0.004, 0.42)
        triggerSweepOsc(ctx, bus, t1, 0.3, 'sawtooth', 480, 80, 0.26, 0.004)
        triggerSweepOsc(ctx, bus, t1, 0.48, 'sine', 150, 34, 0.72, 0.005)
        const drive = createDrive(ctx, bus)
        triggerFilteredNoise(ctx, drive, t1, 0.06, 'highpass', 2600, 1200, 0.8, 0.3, 0.001, 0.25)
        break
      }
      case 'heavy_hit': {
        // 6G必殺技命中：一瞬の吸い込み（ヒットストップ）→ 歪んだ重撃 → 破片 → 余震
        const bus = createBattleBus(ctx, volume, 0.55, now)
        const t1 = now + 0.09
        triggerFilteredNoise(ctx, bus, now, 0.09, 'bandpass', 300, 2600, 1.2, 0.36, 0.085, 4)
        triggerSweepOsc(ctx, bus, now, 0.09, 'sine', 60, 140, 0.22, 0.08)
        const drive = createDrive(ctx, bus)
        triggerFilteredNoise(ctx, drive, t1, 0.09, 'highpass', 2400, 900, 0.8, 0.7, 0.001, 0.22)
        triggerFilteredNoise(ctx, bus, t1 + 0.004, 0.3, 'bandpass', 1100, 240, 1.0, 0.58, 0.003, 0.35)
        triggerSweepOsc(ctx, drive, t1 + 0.003, 0.22, 'triangle', 340, 58, 0.5, 0.002)
        triggerSweepOsc(ctx, bus, t1 + 0.005, 0.62, 'sine', 120, 30, 0.86, 0.003)
        ;[0.08, 0.14, 0.23, 0.31].forEach((offset, idx) => {
          const f = 1600 + ((idx * 733) % 2000)
          triggerFilteredNoise(ctx, bus, t1 + offset, 0.05, 'bandpass', f, f * 0.7, 2.4, 0.11, 0.001, 0.3)
        })
        triggerSweepOsc(ctx, bus, t1 + 0.18, 0.42, 'sine', 82, 32, 0.38, 0.01)
        break
      }
      case 'endure': {
        // 7G被弾側が耐える：重い心音2拍＋低いドローン＋耳鳴り
        const bus = createBattleBus(ctx, volume, 0.26, now)
        triggerHeartbeat(ctx, bus, now, 0.76)
        triggerHeartbeat(ctx, bus, now + 0.74, 0.66)
        triggerSweepOsc(ctx, bus, now, 1.6, 'sine', 55, 52, 0.12, 0.3)
        triggerSweepOsc(ctx, bus, now + 0.15, 1.4, 'sine', 3520, 3480, 0.024, 0.5)
        break
      }
      case 'endure_peak': {
        // 8G耐え続ける：加速する心音3拍＋煽りライザー → 結末前に無音で断ち切る
        const bus = createBattleBus(ctx, volume, 0.26, now)
        triggerHeartbeat(ctx, bus, now, 0.7)
        triggerHeartbeat(ctx, bus, now + 0.5, 0.76)
        triggerHeartbeat(ctx, bus, now + 0.92, 0.84)
        triggerTremoloRiser(ctx, bus, now, 1.25, 'sine', 220, 880, 0.1, 8, 24)
        triggerTremoloRiser(ctx, bus, now, 1.25, 'sawtooth', 110, 440, 0.06, 8, 24, 2600)
        triggerFilteredNoise(ctx, bus, now, 1.25, 'bandpass', 400, 5200, 1.4, 0.13, 1.2, 4)
        break
      }
      case 'kai_arrive': {
        // 6Gカイ登場：澄んだ閃光と鋭い介入スウィッシュ
        const bus = createBattleBus(ctx, volume, 0.4, now)
        triggerFilteredNoise(ctx, bus, now, 0.18, 'bandpass', 3600, 1100, 1.6, 0.45, 0.002, 0.30)
        triggerSweepOsc(ctx, bus, now, 0.28, 'sine', 1320, 2200, 0.22, 0.004)
        triggerSweepOsc(ctx, bus, now + 0.01, 0.32, 'triangle', 1975, 1975, 0.14, 0.006)
        triggerSweepOsc(ctx, bus, now, 0.18, 'sine', 130, 55, 0.32, 0.003)
        break
      }
      case 'kai_parry': {
        // 7Gカイ受け流し：硬質な弾き「ガキンッ」＋金属の鳴り＋左右へ逸れる風切り
        const bus = createBattleBus(ctx, volume, 0.42, now)
        triggerSweepOsc(ctx, bus, now, 0.22, 'triangle', 2400, 880, 0.36, 0.001)
        triggerSweepOsc(ctx, bus, now, 0.30, 'sine', 3650, 3100, 0.20, 0.002)
        triggerSweepOsc(ctx, bus, now + 0.004, 0.5, 'sine', 2793.83, 2793.83, 0.07, 0.002)
        triggerFilteredNoise(ctx, bus, now + 0.01, 0.22, 'bandpass', 2800, 650, 1.4, 0.48, 0.003, 0.35)
        triggerSweepOsc(ctx, bus, now, 0.16, 'sine', 180, 60, 0.38, 0.002)
        triggerPannedWhoosh(ctx, bus, now + 0.05, 0.34, 0.3)
        break
      }
      case 'ally_afterglow': {
        // 8G三者の余韻：静かな風と淡い希望のパッド（過剰に盛らない）
        const bus = createBattleBus(ctx, volume, 0.5, now)
        triggerFilteredNoise(ctx, bus, now, 1.9, 'bandpass', 480, 900, 0.8, 0.07, 0.6, 2.2)
        ;[220, 277.18, 329.63].forEach((f) => {
          triggerSweepOsc(ctx, bus, now, 1.8, 'sine', f, f, 0.045, 0.45)
        })
        triggerSweepOsc(ctx, bus, now + 0.25, 1.4, 'sine', 1760, 1760, 0.02, 0.4)
        break
      }
      case 'false_defeat': {
        // 絶望の転倒・暗転：重いサンプ＋弔いの鐘＋不穏な低音減衰
        const bus = createBattleBus(ctx, volume, 0.52, now)
        triggerSweepOsc(ctx, bus, now, 0.42, 'sine', 92, 30, 0.58, 0.004)
        triggerSweepOsc(ctx, bus, now + 0.02, 0.55, 'triangle', 68, 28, 0.28, 0.015)
        triggerFilteredNoise(ctx, bus, now, 0.25, 'lowpass', 480, 140, 0.9, 0.36, 0.003, 0.35)
        triggerGong(ctx, bus, now + 0.06, 73.42, 0.32, 2.6)
        triggerSweepOsc(ctx, bus, now + 0.1, 2.2, 'sawtooth', 77.78, 73.42, 0.035, 0.6)
        break
      }
      case 'chance_press': {
        // CHANCE押下：「ガコン」→ ホワイトアウト頂点へ駆け上がる煽り → 白光の炸裂
        // ※復活・敗北どちらにも共通（結果を示唆しない）
        const bus = createBattleBus(ctx, volume, 0.5, now)
        triggerSweepOsc(ctx, bus, now, 0.07, 'square', 220, 110, 0.26, 0.001)
        triggerFilteredNoise(ctx, bus, now, 0.04, 'highpass', 3000, 1800, 0.8, 0.3, 0.001, 0.25)
        triggerTremoloRiser(ctx, bus, now + 0.02, 0.3, 'sine', 400, 3200, 0.17, 12, 30)
        triggerFilteredNoise(ctx, bus, now + 0.02, 0.3, 'bandpass', 800, 8000, 1.2, 0.3, 0.28, 4)
        const t1 = now + 0.33
        triggerFilteredNoise(ctx, bus, t1, 0.32, 'highpass', 5200, 2400, 0.7, 0.42, 0.002, 0.35)
        triggerSweepOsc(ctx, bus, t1, 0.18, 'sine', 140, 44, 0.5, 0.003)
        triggerSweepOsc(ctx, bus, t1, 0.65, 'sine', 4186.01, 4186.01, 0.06, 0.004)
        break
      }
      case 'revive_fanfare': {
        // セリーヌ復活：大地を揺らす衝撃＋確定「キュイーン」＋聖歌パッド＋鐘のアルペジオ
        const bus = createBattleBus(ctx, volume, 0.6, now)
        triggerSweepOsc(ctx, bus, now, 0.8, 'sine', 140, 30, 0.82, 0.002)
        triggerFilteredNoise(ctx, bus, now, 0.1, 'highpass', 2600, 1100, 0.9, 0.5, 0.001, 0.25)
        triggerKyuin(ctx, bus, now + 0.02, 0.2, 0.7)
        ;[523.25, 659.25, 783.99, 987.77].forEach((f) => {
          triggerSweepOsc(ctx, bus, now + 0.05, 1.45, 'triangle', f, f, 0.06, 0.16)
          triggerSweepOsc(ctx, bus, now + 0.05, 1.45, 'sine', f * 1.004, f * 1.004, 0.04, 0.16)
        })
        ;[2093.0, 2637.02, 3135.96, 4186.01, 3135.96, 4186.01].forEach((f, idx) => {
          triggerSweepOsc(ctx, bus, now + 0.28 + idx * 0.07, 0.55, 'sine', f, f, 0.1, 0.003)
        })
        break
      }
      case 'continue_fanfare': {
        // 継続確定：（必要なら先に結果画のズン）→ エンブレムスラム＋キュイーン＋ブラス＋上昇アルペジオ
        const bus = createBattleBus(ctx, volume, 0.46, now)
        const slamDelay = Math.max(0, opts.slamDelaySec ?? 0)
        if (slamDelay > 0) {
          triggerSweepOsc(ctx, bus, now, 0.36, 'sine', 92, 40, 0.52, 0.004)
          triggerFilteredNoise(ctx, bus, now, 0.14, 'lowpass', 600, 160, 0.8, 0.28, 0.002, 0.3)
          triggerFilteredNoise(ctx, bus, now + 0.04, slamDelay, 'bandpass', 600, 5200, 1.3, 0.2, slamDelay * 0.9, 4)
        }
        const t1 = now + slamDelay
        const drive = createDrive(ctx, bus)
        triggerSweepOsc(ctx, bus, t1, 0.5, 'sine', 160, 38, 0.72, 0.002)
        triggerFilteredNoise(ctx, drive, t1, 0.08, 'highpass', 2600, 1000, 0.8, 0.36, 0.001, 0.25)
        triggerFilteredNoise(ctx, bus, t1, 0.16, 'bandpass', 1800, 500, 1.2, 0.42, 0.002, 0.28)
        triggerKyuin(ctx, bus, t1 + 0.02, 0.15, 0.45)
        ;[392.0, 523.25, 659.25, 783.99].forEach((f) => {
          triggerSweepOsc(ctx, bus, t1 + 0.02, 0.5, 'sawtooth', f, f, 0.045, 0.006)
          triggerSweepOsc(ctx, bus, t1 + 0.02, 0.6, 'triangle', f * 2, f * 2, 0.06, 0.006)
        })
        ;[1046.5, 1318.51, 1567.98, 2093.0, 2637.02].forEach((f, idx) => {
          triggerSweepOsc(ctx, bus, t1 + 0.14 + idx * 0.05, 0.36, 'sine', f, f, 0.09, 0.003)
        })
        break
      }
      case 'defeat_toll': {
        // 本当の敗北：低い弔鐘＋沈み込む短調の下降
        const bus = createBattleBus(ctx, volume, 0.58, now)
        triggerSweepOsc(ctx, bus, now, 0.6, 'sine', 100, 28, 0.6, 0.003)
        triggerGong(ctx, bus, now, 55, 0.4, 3.0)
        ;[293.66, 261.63, 233.08, 196.0].forEach((f, idx) => {
          triggerSweepOsc(ctx, bus, now + 0.15 + idx * 0.24, 0.55, 'triangle', f, f * 0.985, 0.09, 0.01)
          triggerSweepOsc(ctx, bus, now + 0.15 + idx * 0.24, 0.55, 'sawtooth', f * 0.5, f * 0.49, 0.03, 0.01)
        })
        break
      }
      case 'emblem_slam': {
        // REVIVAL CONTINUE スラムイン：重い叩き込み＋金色のきらめき
        const bus = createBattleBus(ctx, volume, 0.42, now)
        triggerSweepOsc(ctx, bus, now, 0.32, 'sine', 150, 40, 0.58, 0.002)
        triggerFilteredNoise(ctx, bus, now, 0.14, 'bandpass', 1600, 500, 1.2, 0.4, 0.002, 0.28)
        triggerSweepOsc(ctx, bus, now, 0.4, 'triangle', 880, 880, 0.16, 0.004)
        triggerSweepOsc(ctx, bus, now, 0.4, 'triangle', 1318.51, 1318.51, 0.1, 0.004)
        ;[2637.02, 3135.96, 3951.07].forEach((f, idx) => {
          triggerSweepOsc(ctx, bus, now + 0.08 + idx * 0.05, 0.4, 'sine', f, f, 0.07, 0.003)
        })
        break
      }
    }
  } catch (err) {
    console.warn(`[SE] Could not play battle SE (${type}):`, err)
  }
}

/**
 * スイカ成立時の専用SE（爽やかで澄んだエメラルド系高音チャイム）
 */
export function playMelonSe(volume = 0.72): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(volume, now)
    master.connect(ctx.destination)

    triggerFilteredNoise(ctx, master, now, 0.12, 'bandpass', 3600, 1400, 1.8, 0.25, 0.002, 0.25)
    ;[1046.5, 1318.51, 1567.98, 2093.0].forEach((freq, idx) => {
      const t = now + idx * 0.032
      triggerSweepOsc(ctx, master, t, 0.45, 'sine', freq, freq, 0.22, 0.004)
      triggerSweepOsc(ctx, master, t, 0.38, 'triangle', freq * 2, freq * 2, 0.08, 0.004)
    })
  } catch (err) {
    console.warn('[SE] Could not play melon SE:', err)
  }
}

/**
 * 「BARを狙え！」カットイン専用SE（鋭い斬撃＋期待感を煽る上昇チャイム）
 */
export function playBarAimSe(volume = 0.78): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(volume, now)
    master.connect(ctx.destination)

    triggerFilteredNoise(ctx, master, now, 0.22, 'bandpass', 4200, 1100, 1.5, 0.45, 0.002, 0.30)
    triggerSweepOsc(ctx, master, now, 0.18, 'sine', 160, 52, 0.44, 0.003)

    const notes = [880, 1174.66, 1567.98, 2093.0]
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.045
      triggerSweepOsc(ctx, master, t, 0.42, 'triangle', freq, freq, 0.22, 0.004)
      triggerSweepOsc(ctx, master, t + 0.01, 0.38, 'sine', freq * 1.5, freq * 1.5, 0.10, 0.005)
    })
  } catch (err) {
    console.warn('[SE] Could not play BAR aim SE:', err)
  }
}

/**
 * プレミアムBAR揃い成功時の専用ファンファーレ（重厚な衝撃低音＋雷撃クラック連打＋白銀シマー＋祝祭ブラス）
 */
export function playPremiumBarFanfare(volume = 0.9): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(volume, now)
    master.connect(ctx.destination)

    // 1. 脳天を貫く重低音インパクト＋電撃スパーク（多段）
    ;[0, 0.24, 0.56].forEach((offset, idx) => {
      const peak = idx === 0 ? 0.78 : 0.55
      triggerSweepOsc(ctx, master, now + offset, 0.52, 'sine', 130, 30, peak, 0.002)
      triggerSweepOsc(ctx, master, now + offset, 0.30, 'triangle', 240, 44, peak * 0.65, 0.002)
      triggerFilteredNoise(ctx, master, now + offset, 0.28, 'highpass', 2600, 1100, 1.1, 0.45, 0.002, 0.26)
    })

    // 2. 雷撃クラック連打（揃った直後のバチバチ感）
    ;[0.06, 0.14, 0.32, 0.44, 0.70].forEach((offset) => {
      triggerFilteredNoise(ctx, master, now + offset, 0.12, 'bandpass', 4200, 1400, 1.8, 0.38, 0.001, 0.22)
      triggerSweepOsc(ctx, master, now + offset, 0.10, 'sawtooth', 1800, 320, 0.14, 0.002)
    })

    // 3. パチスロ確定「キィィィン！」超高域金属共鳴（2連打）
    ;[0, 0.56].forEach((offset) => {
      triggerSweepOsc(ctx, master, now + offset, 0.95, 'sine', 2637.02, 2637.02, 0.18, 0.004)
      triggerSweepOsc(ctx, master, now + offset + 0.01, 0.88, 'triangle', 3951.07, 3951.07, 0.12, 0.004)
      triggerSweepOsc(ctx, master, now + offset + 0.02, 0.72, 'sine', 5274.04, 5274.04, 0.08, 0.004)
    })

    // 4. 昇華ライザー（期待と高揚のスイープ）
    triggerSweepOsc(ctx, master, now + 0.12, 0.46, 'triangle', 440, 1760, 0.16, 0.04)

    // 5. 祝祭ブラス・ファンファーレ進行
    const chords: Array<{ t: number; dur: number; freqs: number[] }> = [
      { t: 0.04, dur: 0.14, freqs: [523.25, 659.25, 783.99] },
      { t: 0.16, dur: 0.14, freqs: [587.33, 739.99, 880.0] },
      { t: 0.28, dur: 0.16, freqs: [659.25, 830.61, 987.77] },
      { t: 0.42, dur: 0.20, freqs: [783.99, 987.77, 1174.66] },
      { t: 0.58, dur: 1.05, freqs: [1046.5, 1318.51, 1567.98, 2093.0] },
    ]
    chords.forEach((chord) => {
      chord.freqs.forEach((f) => {
        triggerSweepOsc(ctx, master, now + chord.t, chord.dur, 'triangle', f, f, 0.19, 0.006)
        triggerSweepOsc(ctx, master, now + chord.t, chord.dur, 'sawtooth', f * 0.5, f * 0.5, 0.12, 0.008)
      })
    })

    // 6. 高域シマーアルペジオ（2周）
    ;[1567.98, 2093.0, 2637.02, 3135.96, 4186.01, 2637.02, 3135.96, 4186.01].forEach((f, idx) => {
      triggerSweepOsc(ctx, master, now + 0.60 + idx * 0.055, 0.62, 'sine', f, f, 0.13, 0.004)
    })
  } catch (err) {
    console.warn('[SE] Could not play premium BAR fanfare:', err)
  }
}



