/**
 * アプリ本体（App）: ゲーム進行の状態管理・操作ハンドラ・筐体全体の描画。
 * 機能ごとの入口は docs/code-map.md を参照。UI 非依存の判定ロジックは src/engine.ts / src/game/ / src/battle/ / src/layout/ に置く。
 *
 * ファイル内の主な入口（関数名で検索）:
 * - 進行シーン: Scene = bonusSpin → bonusGet → ready ⇄ lever → spinning → (battleModeIntro → BATTLE MODE 8G) → finished
 * - 操作: onBet / onLever（抽選・レバーON時の告知・BATTLE MODE各GのSE/VOICE）/ onStop（押し順判定・払出し・ベル8回・8G終了後の分岐）
 * - BATTLE MODE: onStartBattleAction（継続抽選）/ resolveFalseDefeatChance（CHANCE→復活 or 敗北）/ finishToNextRound / finishToGameOver
 * - 入力経路: performPrimaryAction（どこでもタップ・Space/Enter）/ stopNextReel / AUTO PLAY Timer Logic / onChancePress / Keyboard shortcut
 * - リセット: resetGameState / onRetry / resetForNewSession（30分放置のセッション切れ）
 * - 演出トリガー: sound* / trigger*（SE・液晶エフェクト・筐体フラッシュ）
 * - 開発用: window.__setBattleTest など（import.meta.env.DEV のみ）、DebugSettingsPanel / DebugStatusPanel
 *
 * 注意: scene 'battle' / 'battleResult' と onBattle / onNext は旧バトル方式の名残で、現在これらの scene へ遷移する経路はない。
 */
import { StrictMode, useEffect, useRef, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BATTLE_PART_GAMES,
  BELLS_TO_BATTLE,
  calculateMedalPayout,
  drawSettingIndex,
  drawSpin,
  getMissReels,
  getReelWindow,
  RATES,
  resolveBattleWithStock,
  resolveDebugBattleSelection,
  resolveTopLampMode,
} from './engine'
import type { BattlePhase, BattleResult, DebugBattleScenarioId, NaviNumbers, NaviOrder, Scene, SpinOutcome, SymbolId } from './engine'
import { ReelSymbolSvg } from './components/ReelSymbolSvg'
import { BonusKakuteiDisplay } from './components/BonusKakuteiDisplay'
import { BonusGetDisplay } from './components/BonusGetDisplay'
import { PremiumBarDisplay } from './components/PremiumBarDisplay'
import { BattleModeIntroDisplay } from './components/BattleModeIntroDisplay'
import { BattleSceneDisplay } from './components/BattleSceneDisplay'
import { ZakoNaviDisplay } from './components/ZakoNaviDisplay'
import { GameOverResultDisplay } from './components/GameOverResultDisplay'
import { useBgm, type BgmTrack } from './bgm'
import { preloadSe, unlockSeAudio, playWavSe, playVoiceSe, stopVoiceSe, playCherrySe, playMelonSe, playBarAimSe, playPremiumBarFanfare, playBattleSe, suspendSeAudio, resumeSeAudio, type SeKey, type BattleSeType, type BattleSeOptions } from './se'
import {
  ALL_STARTUP_IMAGES,
  ALL_STARTUP_SE,
  createStartupLoader,
  preloadAndDecodeImage,
  type StartupPhase,
} from './game/startupLoader'
import { BellyGlassPanel, BottomCabinetDeck, CabinetSideWing, TopCrown } from './components/cabinet/CabinetFrame'
import { DebugSettingsPanel, DebugStatusPanel } from './components/cabinet/DebugPanels'
import { LcdSettingsView } from './components/cabinet/LcdSettingsView'
import { BarAimCutinOverlay, CherryEffectOverlay, MelonEffectOverlay, MelonStockBanner } from './components/cabinet/SmallRoleOverlays'
import { resolveBattleLeverCue } from './battle/battleCues'
import { resolveDebugSpinRequest } from './game/debugOptions'
import { isNaviMissOnStop, pickBonusStopReel, pickNaviStopReel, resolveNaviReelDisplay, type ReelIndex } from './game/navi'
import { resolveSceneBgmTrack } from './game/sceneBgm'
import { computeCabinetLayout } from './layout/cabinetLayout'
import './style.css'

const START_REELS: [SymbolId, SymbolId, SymbolId] = ['seven', 'seven', 'seven']
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30分操作なしでセッション切れ扱い

function App() {
  const [scene, setScene] = useState<Scene>('bonusSpin')
  const [round, setRound] = useState(1)
  const [games, setGames] = useState(0)
  const [credit, setCredit] = useState(50) // 通常MAX50、初期値50
  const [totalMedals, setTotalMedals] = useState(0) // 液晶右上のTOTAL総獲得枚数（ドル箱表示の基準）
  const [payout, setPayout] = useState(0)
  // 確率を決定する台設定(1〜6)はゲーム起動時に重み付き抽選で決定し、同一セッション中は固定
  const [rateIndex, setRateIndex] = useState(() => drawSettingIndex())
  const [stockCount, setStockCount] = useState(0)
  const [forcedSpinRole, setForcedSpinRole] = useState<string | null>(null)
  const [forcedStockMode, setForcedStockMode] = useState<'auto' | 'win' | 'lose'>('auto')
  const [forcedBarAimMode, setForcedBarAimMode] = useState<'auto' | 'on' | 'off'>('auto')
  const [forcedBattlePattern, setForcedBattlePattern] = useState<DebugBattleScenarioId | null>(null)
  const [isSpecialEnemyDefeat, setIsSpecialEnemyDefeat] = useState(false)
  const [totalStockEarned, setTotalStockEarned] = useState(0)
  const [, setTotalStockUsed] = useState(0)
  const [cherryEffectKey, setCherryEffectKey] = useState(0)
  const [showCherryEffect, setShowCherryEffect] = useState(false)
  const [cabinetCherryFlash, setCabinetCherryFlash] = useState(false)
  const [melonEffectKey, setMelonEffectKey] = useState(0)
  const [showMelonEffect, setShowMelonEffect] = useState(false)
  const [melonStockKey, setMelonStockKey] = useState(0)
  const [showMelonStockBanner, setShowMelonStockBanner] = useState(false)
  const [cabinetMelonFlash, setCabinetMelonFlash] = useState(false)
  const [barAimEffectKey, setBarAimEffectKey] = useState(0)
  const [showBarAimEffect, setShowBarAimEffect] = useState(false)
  const [premiumBarEffectKey, setPremiumBarEffectKey] = useState(0)
  const [showPremiumBarEffect, setShowPremiumBarEffect] = useState(false)
  const [cabinetPremiumFlash, setCabinetPremiumFlash] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const [fastSpeed, setFastSpeed] = useState(false)
  const [startupPhase, setStartupPhase] = useState<StartupPhase>('loading')
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number }>({
    loaded: 0,
    total: ALL_STARTUP_IMAGES.length + ALL_STARTUP_SE.length,
  })
  const startupPhaseRef = useRef<StartupPhase>(startupPhase)
  const [reels, setReels] = useState<[SymbolId, SymbolId, SymbolId]>(START_REELS)
  const [stopped, setStopped] = useState<[boolean, boolean, boolean]>([false, false, false])
  const [bouncing, setBouncing] = useState<[boolean, boolean, boolean]>([false, false, false])
  const [spin, setSpin] = useState<SpinOutcome | null>(null)
  const [battle, setBattle] = useState<BattleResult | null>(null)
  const [, setHistory] = useState<Array<{ round: number; result: BattleResult }>>([])
  const [muted, setMuted] = useState(false)
  const [isTabHidden, setIsTabHidden] = useState(() => (typeof document !== 'undefined' ? document.hidden : false))
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [cabinetLayout, setCabinetLayout] = useState(() => computeCabinetLayout())
  const effectiveMuted = muted || isTabHidden
  const [activeControl, setActiveControl] = useState<'bet' | 'lever' | 'chance' | 0 | 1 | 2 | null>(null)
  const [winLamp, setWinLamp] = useState(false)
  const [screenFlash, setScreenFlash] = useState(false)

  // 押し順ナビ・ベルカウント・リプレイ管理・BATTLE MODE管理
  const [bellCount, setBellCount] = useState(0) // 8回ベルGETでBATTLE BONUSへ
  const [isBattleMode, setIsBattleMode] = useState(false) // BATTLE BONUS中フラグ (大型ランプ点灯 & ROUND表示)
  const [battleGame, setBattleGame] = useState(1) // バトルパート全8G進行用カウンター (1..8)
  const [battlePhase, setBattlePhase] = useState<BattlePhase>('fighting') // バトル決着・復活フェーズ
  const [falseDefeatWhiteout, setFalseDefeatWhiteout] = useState(false) // false_defeat時にCHANCE押下後のホワイトアウト演出
  const [isReplayPending, setIsReplayPending] = useState(false) // リプレイ成立時は次回転クレジット消費0でレバー始動
  const [currentNavi, setCurrentNavi] = useState<NaviNumbers>([1, 2, 3])
  const [currentNaviOrder, setCurrentNaviOrder] = useState<NaviOrder>([0, 1, 2])
  const [litRole, setLitRole] = useState<'bell' | 'replay' | null>(null) // 最後のリールが停止した後に点灯する役ランプ
  const [naviAlert, setNaviAlert] = useState<string | null>(null) // 押し順失敗時の警告
  const [naviStep, setNaviStep] = useState(0)

  // シーン→BGM の対応表: src/game/sceneBgm.ts
  const currentBgmTrack: BgmTrack = resolveSceneBgmTrack(scene, isBattleMode)

  // 設定画面 (menuOpen) が開いている時はBGM音量を半分に下げる / 別タブ表示中は自動ミュート
  const { unlockAudio } = useBgm(currentBgmTrack, effectiveMuted, menuOpen)

  const audioRef = useRef<AudioContext | null>(null)
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sceneRef = useRef(scene)
  const stoppedRef = useRef(stopped)
  const spinResultRef = useRef<SpinOutcome | null>(null)
  const gamesRef = useRef(games)
  const creditRef = useRef(credit)
  const menuOpenRef = useRef(menuOpen)
  const isBattleModeRef = useRef(isBattleMode)
  const battleGameRef = useRef(battleGame)
  const battlePhaseRef = useRef(battlePhase)
  const battleRef = useRef(battle)
  const battleClimaxTimersRef = useRef<number[]>([])
  const playedBattleVoicesRef = useRef<Set<SeKey>>(new Set())
  // BATTLE MODE: 各Gの演出SE・エフェクトを再生済みのG（リプレイ・小役・押し順ミスで同じGを再回転しても繰り返さない）
  const playedBattleFxGamesRef = useRef<Set<number>>(new Set())
  const [battleLeverFxArmed, setBattleLeverFxArmed] = useState(false)
  const isSpecialEnemyDefeatRef = useRef(false)
  const currentNaviOrderRef = useRef(currentNaviOrder)
  const naviStepRef = useRef(naviStep)
  const isNaviFailedRef = useRef(false)
  const naviStopCountRef = useRef(0)
  const lastBattleStepTimeRef = useRef(0)
  const stockCountRef = useRef(0)
  const totalStockEarnedRef = useRef(0)
  const totalStockUsedRef = useRef(0)
  const forcedSpinRoleRef = useRef<string | null>(null)
  const forcedStockModeRef = useRef<'auto' | 'win' | 'lose'>('auto')
  const forcedBarAimModeRef = useRef<'auto' | 'on' | 'off'>('auto')
  const forcedBattlePatternRef = useRef<DebugBattleScenarioId | null>(null)
  const isForcedBattleDefeatRef = useRef(false)
  const falseDefeatActionDoneRef = useRef(false)
  const cabinetCherryFlashTimerRef = useRef<number | null>(null)
  const cabinetMelonFlashTimerRef = useRef<number | null>(null)
  const melonStockTimerRef = useRef<number | null>(null)
  const cabinetPremiumFlashTimerRef = useRef<number | null>(null)
  const premiumBarEffectTimerRef = useRef<number | null>(null)
  const lastActiveAtRef = useRef(Date.now())
  const mutedRef = useRef(muted)
  const sessionExpiredNoticeRef = useRef(sessionExpiredNotice)
  const currentRate = RATES[rateIndex] ?? RATES[0]!

  useEffect(() => { sceneRef.current = scene }, [scene])
  useEffect(() => { stoppedRef.current = stopped }, [stopped])
  useEffect(() => { gamesRef.current = games }, [games])
  useEffect(() => { creditRef.current = credit }, [credit])
  useEffect(() => { menuOpenRef.current = menuOpen }, [menuOpen])
  useEffect(() => { startupPhaseRef.current = startupPhase }, [startupPhase])
  useEffect(() => { isBattleModeRef.current = isBattleMode }, [isBattleMode])
  useEffect(() => { battleGameRef.current = battleGame }, [battleGame])
  useEffect(() => { battlePhaseRef.current = battlePhase }, [battlePhase])
  useEffect(() => { battleRef.current = battle }, [battle])
  useEffect(() => { currentNaviOrderRef.current = currentNaviOrder }, [currentNaviOrder])
  useEffect(() => { naviStepRef.current = naviStep }, [naviStep])
  useEffect(() => { mutedRef.current = muted }, [muted])
  useEffect(() => { sessionExpiredNoticeRef.current = sessionExpiredNotice }, [sessionExpiredNotice])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    ; (window as any).__setBattleTest = (testPattern: BattleResult, testG = 1, testPhase: BattlePhase = 'fighting', specialEnemyDefeat = false) => {
      setBattle(testPattern)
      battleRef.current = testPattern
      setBattleGame(testG)
      battleGameRef.current = testG
      setBattlePhase(testPhase)
      battlePhaseRef.current = testPhase
      isSpecialEnemyDefeatRef.current = specialEnemyDefeat
      setIsSpecialEnemyDefeat(specialEnemyDefeat)
      setIsBattleMode(true)
      isBattleModeRef.current = true
      sceneRef.current = 'ready'
      setScene('ready')
    }
      ; (window as any).__setBattleIntroTest = () => {
        sceneRef.current = 'battleModeIntro'
        setScene('battleModeIntro')
      }
      ; (window as any).__playVoiceTest = (key: SeKey) => {
        playVoiceSe(key, 0.95)
      }
      ; (window as any).__setMedalsTest = (medals: number) => {
        setTotalMedals(Math.max(0, Math.floor(medals)))
      }
  }, [])

  // 初期表示時に全画像・全SEをロード・デコード完了してからゲーム画面を表示する（二重実行防止・タイムアウト保護付き）
  const startupLoaderRef = useRef<ReturnType<typeof createStartupLoader> | null>(null)
  if (!startupLoaderRef.current) {
    startupLoaderRef.current = createStartupLoader({
      loadImage: preloadAndDecodeImage,
      loadSe: async (key) => (await preloadSe(key)) !== null,
      onProgress: (loaded, total) => {
        setLoadProgress({ loaded, total })
      },
    })
  }

  useEffect(() => {
    let cancelled = false
    void startupLoaderRef.current?.run().then(() => {
      if (cancelled) return
      startupPhaseRef.current = 'ready'
      setStartupPhase('ready')
      lastActiveAtRef.current = Date.now()
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 画面サイズ・visualViewport変化に応じて筐体全体の縮小率を再計算
  useEffect(() => {
    const updateLayout = () => {
      const el = wrapperRef.current
      if (el) {
        const cs = window.getComputedStyle(el)
        const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
        const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
        const availW = Math.max(0, el.clientWidth - padX)
        const availH = Math.max(0, el.clientHeight - padY)
        if (availW > 0 && availH > 0) {
          setCabinetLayout(computeCabinetLayout(availW, availH))
          return
        }
      }
      setCabinetLayout(computeCabinetLayout())
    }
    updateLayout()
    window.addEventListener('resize', updateLayout)
    window.addEventListener('orientationchange', updateLayout)
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', updateLayout)
      vv.addEventListener('scroll', updateLayout)
    }
    const ro = typeof ResizeObserver !== 'undefined' && wrapperRef.current ? new ResizeObserver(updateLayout) : null
    if (ro && wrapperRef.current) ro.observe(wrapperRef.current)
    return () => {
      window.removeEventListener('resize', updateLayout)
      window.removeEventListener('orientationchange', updateLayout)
      if (vv) {
        vv.removeEventListener('resize', updateLayout)
        vv.removeEventListener('scroll', updateLayout)
      }
      ro?.disconnect()
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('mobile-portrait-lock', cabinetLayout.isMobilePortrait)
  }, [cabinetLayout.isMobilePortrait])

  // Sound Engine
  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'square', delay = 0) => {
    if (effectiveMuted) return
    try {
      const ctx = audioRef.current ?? new AudioContext()
      audioRef.current = ctx
      if (ctx.state === 'suspended') void ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay)
      gain.gain.setValueAtTime(0.045, ctx.currentTime + delay)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + duration)
    } catch { /* Audio is optional */ }
  }, [effectiveMuted])

  // MAX BET押下時: se_max_bet_v2_heavy.wav
  const soundBet = useCallback(() => {
    if (effectiveMuted) return
    playWavSe('bet', 0.85)
  }, [effectiveMuted])

  // レバー押下時: se_reel_start_heavy.wav
  const soundLever = useCallback(() => {
    if (effectiveMuted) return
    playWavSe('lever', 0.85)
  }, [effectiveMuted])

  // 各種リール停止ボタン押下時: se_reel_stop_punch.wav
  const soundStop = useCallback((index: number) => {
    if (effectiveMuted) return
    const pitches = [0.98, 1.0, 1.02]
    playWavSe('stop', 0.85, pitches[index] ?? 1.0)
  }, [effectiveMuted])

  const soundChance = useCallback(() => {
    playTone(160, 0.15, 'sawtooth', 0)
    playTone(320, 0.12, 'square', 0.04)
    playTone(640, 0.25, 'triangle', 0.08)
  }, [playTone])

  // ベルによるコイン獲得時: se_credit_get_deep_v3.wav
  const soundPayout = useCallback(() => {
    if (effectiveMuted) return
    playWavSe('payout', 0.85)
  }, [effectiveMuted])

  const soundWin = useCallback(() => {
    ;[523, 659, 783, 1046].forEach((f, i) => {
      playTone(f, 0.15, 'triangle', i * 0.1)
    })
  }, [playTone])

  // リプレイ獲得時: se_replay.wav
  const soundReplay = useCallback(() => {
    if (effectiveMuted) return
    playWavSe('replay', 0.85)
  }, [effectiveMuted])

  // チェリー成立時: 鋭い金属的・電子的な高音SE（「ピキーン！」）
  const soundCherry = useCallback(() => {
    if (effectiveMuted) return
    playCherrySe(0.75)
  }, [effectiveMuted])

  // チェリー成立時の視覚エフェクト（第3リール停止まで継続・ストック成否や種類による差異はつけない）
  const triggerCherryEffect = useCallback(() => {
    setCherryEffectKey((k) => k + 1)
    setShowCherryEffect(true)
  }, [])

  // 単チェリー確定時の筐体全体フラッシュ演出
  const triggerCabinetCherryFlash = useCallback(() => {
    if (cabinetCherryFlashTimerRef.current !== null) {
      clearTimeout(cabinetCherryFlashTimerRef.current)
    }
    setCabinetCherryFlash(true)
    setScreenFlash(true)
    window.setTimeout(() => setScreenFlash(false), 350)
    cabinetCherryFlashTimerRef.current = window.setTimeout(() => {
      setCabinetCherryFlash(false)
      cabinetCherryFlashTimerRef.current = null
    }, 950)
  }, [])

  // スイカ成立時SE＆視覚エフェクト
  const soundMelon = useCallback(() => {
    if (effectiveMuted) return
    playMelonSe(0.72)
  }, [effectiveMuted])

  const triggerMelonEffect = useCallback(() => {
    setMelonEffectKey((k) => k + 1)
    setShowMelonEffect(true)
  }, [])

  const triggerMelonStockBanner = useCallback(() => {
    if (melonStockTimerRef.current !== null) {
      clearTimeout(melonStockTimerRef.current)
    }
    setMelonStockKey((k) => k + 1)
    setShowMelonStockBanner(true)
    melonStockTimerRef.current = window.setTimeout(() => {
      setShowMelonStockBanner(false)
      melonStockTimerRef.current = null
    }, 1800)
  }, [])

  const triggerCabinetMelonFlash = useCallback(() => {
    if (cabinetMelonFlashTimerRef.current !== null) {
      clearTimeout(cabinetMelonFlashTimerRef.current)
    }
    setCabinetMelonFlash(true)
    setScreenFlash(true)
    window.setTimeout(() => setScreenFlash(false), 320)
    cabinetMelonFlashTimerRef.current = window.setTimeout(() => {
      setCabinetMelonFlash(false)
      cabinetMelonFlashTimerRef.current = null
    }, 900)
  }, [])

  // 「BARを狙え！」カットインSE＆視覚エフェクト
  const soundBarAim = useCallback(() => {
    if (effectiveMuted) return
    playBarAimSe(0.78)
  }, [effectiveMuted])

  const triggerBarAimEffect = useCallback(() => {
    setBarAimEffectKey((k) => k + 1)
    setShowBarAimEffect(true)
  }, [])

  // プレミアムBAR揃い成功時ファンファーレ＆演出＆筐体フラッシュ
  const soundPremiumBarSuccess = useCallback(() => {
    if (effectiveMuted) return
    playPremiumBarFanfare(0.85)
  }, [effectiveMuted])

  const triggerPremiumBarEffect = useCallback(() => {
    if (premiumBarEffectTimerRef.current !== null) {
      clearTimeout(premiumBarEffectTimerRef.current)
    }
    setPremiumBarEffectKey((k) => k + 1)
    setShowPremiumBarEffect(true)
    premiumBarEffectTimerRef.current = window.setTimeout(() => {
      setShowPremiumBarEffect(false)
      premiumBarEffectTimerRef.current = null
    }, 2800)
  }, [])

  const triggerCabinetPremiumFlash = useCallback(() => {
    if (cabinetPremiumFlashTimerRef.current !== null) {
      clearTimeout(cabinetPremiumFlashTimerRef.current)
    }
    setCabinetPremiumFlash(true)
    // 多段ストロボフラッシュ (0ms -> 220ms -> 480ms -> 780ms)
    ;[0, 220, 480, 780].forEach((delay) => {
      window.setTimeout(() => setScreenFlash(true), delay)
      window.setTimeout(() => setScreenFlash(false), delay + 140)
    })
    cabinetPremiumFlashTimerRef.current = window.setTimeout(() => {
      setCabinetPremiumFlash(false)
      cabinetPremiumFlashTimerRef.current = null
    }, 2400)
  }, [])

  // 共通ストック加算処理（1回の状態更新で加算）
  const applyStockGain = useCallback((gain: number) => {
    if (gain <= 0) return
    const nextStock = stockCountRef.current + gain
    stockCountRef.current = nextStock
    setStockCount(nextStock)

    const nextEarned = totalStockEarnedRef.current + gain
    totalStockEarnedRef.current = nextEarned
    setTotalStockEarned(nextEarned)
  }, [])

  const soundMiss = useCallback(() => {
    playTone(180, 0.22, 'sawtooth', 0)
    playTone(130, 0.28, 'sawtooth', 0.18)
  }, [playTone])

  const soundCoinDrop = useCallback(() => {
    ;[1800, 2200, 1950, 2400, 2100].forEach((f, i) => {
      playTone(f, 0.04, 'triangle', i * 0.05)
    })
  }, [playTone])

  const soundPremiumCoinCascade = useCallback(() => {
    ;[1760, 2093, 2349, 2637, 2217, 2489, 2794, 3136].forEach((f, i) => {
      playTone(f, 0.045, 'triangle', i * 0.045)
    })
  }, [playTone])

  // 共通メダル払い出し処理 (CREDIT上限50枚 + 超過分の下皿排出 + TOTAL獲得枚数加算)
  const applyMedalPayout = useCallback((pay: number, options?: { alwaysCoinSound?: boolean; cascade?: boolean }) => {
    setPayout(pay)
    const { nextCredit, toTray } = calculateMedalPayout(creditRef.current, pay)
    creditRef.current = nextCredit
    setCredit(nextCredit)
    setTotalMedals((t) => t + toTray)

    const shouldPlayCoinSound = toTray > 0 || Boolean(options?.alwaysCoinSound)
    if (shouldPlayCoinSound) {
      if (options?.cascade) {
        soundPremiumCoinCascade()
      } else {
        soundCoinDrop()
      }
    }
  }, [soundCoinDrop, soundPremiumCoinCascade])

  const soundDefeat = useCallback(() => {
    ;[380, 320, 260, 200].forEach((f, i) => {
      playTone(f, 0.18, 'sawtooth', i * 0.12)
    })
  }, [playTone])

  const soundSevenTenpai = useCallback(() => {
    // 赤７テンパイ時の激アツ和音 (2停止時)
    ;[659.25, 830.61, 1046.50, 1318.51].forEach((f, i) => {
      playTone(f, 0.18, 'triangle', i * 0.04)
      playTone(f * 0.5, 0.18, 'square', i * 0.04)
    })
  }, [playTone])

  const soundBonusFanfare = useCallback(() => {
    // 華やかな大当たり・ボーナス確定ブラスファンファーレ
    const chords = [
      [523.25, 659.25, 783.99],    // C
      [587.33, 739.99, 880.00],    // D
      [659.25, 830.61, 987.77],    // E
      [783.99, 987.77, 1174.66],   // G
      [1046.50, 1318.51, 1567.98], // High C
    ]
    chords.forEach((chord, i) => {
      chord.forEach((freq) => {
        playTone(freq, 0.25, 'triangle', i * 0.12)
        playTone(freq * 0.5, 0.25, 'sawtooth', i * 0.12)
      })
    })
  }, [playTone])

  // 最初の777揃った後のボーナスゲットボイス: voice_bonus_get.wav
  const soundVoiceBonusGet = useCallback(() => {
    if (effectiveMuted) return
    playVoiceSe('voice_bonus_get', 0.95)
  }, [effectiveMuted])

  // 雑魚3体撃破時の攻撃ヒットSE: se_zako_hit.wav（1体目→2体目→3体目でわずかにピッチを変えて連撃感を演出）
  const soundZakoHit = useCallback((stepIndex: number) => {
    if (effectiveMuted) return
    const pitches = [0.97, 1.01, 1.06]
    playWavSe('zako_hit', 0.85, pitches[stepIndex] ?? 1.0)
  }, [effectiveMuted])

  // 雑魚3体撃破時ボイス (左:0 -> 01, 中:1 -> 02, 右:2 -> 03): voice_enemy_0n.wav
  const soundVoiceEnemyDefeat = useCallback((index: number) => {
    if (effectiveMuted) return
    const key: SeKey = index === 0 ? 'voice_enemy_01' : index === 1 ? 'voice_enemy_02' : 'voice_enemy_03'
    playVoiceSe(key, 0.95)
  }, [effectiveMuted])

  // BATTLE MODE開始時ボイス: voice_round_start.wav
  const soundVoiceRoundStart = useCallback(() => {
    if (effectiveMuted) return
    playVoiceSe('voice_round_start', 0.95)
  }, [effectiveMuted])

  // BATTLE MODE中の押し順ナビボイス (0:左, 1:中, 2:右)
  const soundBattleNaviVoice = useCallback((reelIdx: number) => {
    if (effectiveMuted) return
    const key: SeKey =
      reelIdx === 0 ? 'voice_left_navi' : reelIdx === 1 ? 'voice_middle_navi' : 'voice_right_navi'
    playWavSe(key, 0.85)
  }, [effectiveMuted])

  // BATTLE MODE中の各種キャラクターボイス
  const soundBattleVoice = useCallback((key: SeKey) => {
    if (effectiveMuted) return
    playVoiceSe(key, 0.95)
  }, [effectiveMuted])

  // BATTLE MODE中の演出SE
  const soundBattleSe = useCallback((type: BattleSeType, opts?: BattleSeOptions) => {
    if (effectiveMuted) return
    playBattleSe(type, 0.72, opts)
  }, [effectiveMuted])

  const triggerVisual = (control: 'bet' | 'lever' | 'chance' | 0 | 1 | 2) => {
    setActiveControl(control)
    setTimeout(() => setActiveControl(null), 180)
  }

  // Reel spin animation timer
  useEffect(() => {
    if (startupPhase !== 'ready' || (scene !== 'spinning' && scene !== 'bonusSpin')) {
      if (spinRef.current) clearInterval(spinRef.current)
      spinRef.current = null
      return
    }
    const symKeys: SymbolId[] = ['seven', 'bell', 'replay', 'bar', 'cherry', 'melon', 'blank']
    spinRef.current = setInterval(() => {
      setReels((prev) =>
        prev.map((s, i) => (stoppedRef.current[i] ? s : symKeys[Math.floor(Math.random() * symKeys.length)]!)) as [SymbolId, SymbolId, SymbolId]
      )
    }, 45)
    return () => {
      if (spinRef.current) clearInterval(spinRef.current)
    }
  }, [scene, startupPhase])

  // Actions
  const onBet = useCallback(() => {
    if (startupPhaseRef.current !== 'ready') return
    if (menuOpenRef.current) {
      setMenuOpen(false)
      return
    }
    if (sceneRef.current !== 'ready') return

    // 直前がリプレイだった場合はクレジット消費なしで即座にレバーへ
    if (isReplayPending) {
      setIsReplayPending(false)
      setScene('lever')
      sceneRef.current = 'lever'
      return
    }

    // 通常BET: クレジットを3枚消費（3枚未満の場合は50枚補充して3枚消費）
    setCredit((prev) => {
      const base = prev >= 3 ? prev : prev + 50
      const next = Math.max(0, base - 3)
      creditRef.current = next
      return next
    })

    soundBet()
    setPayout(0)
    setLitRole(null) // 次スピン開始で前回の役ランプ消灯
    setNaviAlert(null)
    setScene('lever')
    sceneRef.current = 'lever'
  }, [soundBet, isReplayPending])

  const onLever = useCallback(() => {
    if (startupPhaseRef.current !== 'ready') return
    if (menuOpenRef.current) {
      setMenuOpen(false)
      return
    }
    if (sceneRef.current !== 'lever') return
    soundLever()
    setIsReplayPending(false)
    setLitRole(null) // レバーONで役ランプ消灯
    setNaviAlert(null)
    setShowBarAimEffect(false)
    setShowPremiumBarEffect(false)
    setShowMelonEffect(false)
    setShowMelonStockBanner(false)
    isNaviFailedRef.current = false
    naviStopCountRef.current = 0
    const forcedRole = import.meta.env.DEV ? forcedSpinRoleRef.current : null
    const forcedStock = import.meta.env.DEV ? forcedStockModeRef.current : 'auto'
    const forcedBarAim = import.meta.env.DEV ? forcedBarAimModeRef.current : 'auto'

    // デバッグパネルの強制指定 → 抽選オプション変換: src/game/debugOptions.ts
    const { roleId: actualForcedRole, options: spinOptions } = import.meta.env.DEV
      ? resolveDebugSpinRequest(forcedRole, forcedStock, forcedBarAim)
      : { roleId: null, options: undefined }

    const outcome = drawSpin(rateIndex, Math.random, actualForcedRole, spinOptions)
    if (forcedRole !== null) {
      forcedSpinRoleRef.current = null
      setForcedSpinRole(null)
    }
    if (forcedStock !== 'auto') {
      forcedStockModeRef.current = 'auto'
      setForcedStockMode('auto')
    }
    if (forcedBarAim !== 'auto') {
      forcedBarAimModeRef.current = 'auto'
      setForcedBarAimMode('auto')
    }
    spinResultRef.current = outcome
    setSpin(outcome)
    setCurrentNavi(outcome.naviNumbers)
    setCurrentNaviOrder(outcome.naviOrder)
    setNaviStep(0)
    stoppedRef.current = [false, false, false]
    setStopped([false, false, false])
    setBouncing([false, false, false])
    sceneRef.current = 'spinning'
    setScene('spinning')

    // 1回目の告知（レバーON時）：
    // - 「BARを狙え！」演出当選時はカットインを優先表示（停止までどの役か判別しない）
    // - 通常チェリー成立時はキランSE＋派手な液晶エフェクト（種類・ストック有無で変えない）
    // - 通常スイカ成立時は爽快SE＋エメラルド液晶エフェクト（ストック有無で変えない）
    if (outcome.barAim) {
      soundBarAim()
      triggerBarAimEffect()
    } else if (outcome.symbol === 'cherry') {
      soundCherry()
      triggerCherryEffect()
    } else if (outcome.symbol === 'melon') {
      soundMelon()
      triggerMelonEffect()
    }

    // BATTLE MODE中の押し順ナビボイス再生 & 各ゲーム演出ボイス再生
    if (isBattleModeRef.current) {
      const hasNaviVoice = outcome.symbol === 'bell' && !outcome.isReplay
      if (hasNaviVoice) {
        soundBattleNaviVoice(outcome.naviOrder[0])
      }

      const curG = battleGameRef.current
      // このGで初回のレバーONのみ演出SE・エフェクトを再生する（リプレイ等で同じGを再回転した場合は鳴らさない）
      const isFirstSpinOfGame = !playedBattleFxGamesRef.current.has(curG)
      playedBattleFxGamesRef.current.add(curG)
      setBattleLeverFxArmed(isFirstSpinOfGame)
      // G別の SE/VOICE 決定表: src/battle/battleCues.ts
      const { seKey: battleSeKey, seOptions: battleSeOptions, voiceKey: battleVoiceKey } =
        resolveBattleLeverCue(curG, battleRef.current)

      if (battleSeKey && isFirstSpinOfGame) {
        soundBattleSe(battleSeKey, battleSeOptions)
      }

      if (battleVoiceKey && !playedBattleVoicesRef.current.has(battleVoiceKey)) {
        const keyToPlay = battleVoiceKey
        playedBattleVoicesRef.current.add(keyToPlay)
        const delayMs = hasNaviVoice ? 260 : 0
        if (delayMs > 0) {
          window.setTimeout(() => {
            if (isBattleModeRef.current && battlePhaseRef.current === 'fighting') {
              soundBattleVoice(keyToPlay)
            }
          }, delayMs)
        } else {
          soundBattleVoice(keyToPlay)
        }
      }
    }
  }, [rateIndex, soundLever, soundCherry, triggerCherryEffect, soundMelon, triggerMelonEffect, soundBarAim, triggerBarAimEffect, soundBattleNaviVoice, soundBattleVoice, soundBattleSe])

  const finishToNextRound = useCallback(() => {
    setRound((r) => r + 1)
    setBellCount(0)
    setBattleGame(1)
    battleGameRef.current = 1
    setBattlePhase('fighting')
    battlePhaseRef.current = 'fighting'
    setIsBattleMode(false)
    isBattleModeRef.current = false
    setBattle(null)
    battleRef.current = null
    isForcedBattleDefeatRef.current = false
    isSpecialEnemyDefeatRef.current = false
    setIsSpecialEnemyDefeat(false)
    // BATTLE MODE最終ゲームの小役(ベル等)が残っていると雑魚戦復帰時に撃破状態が一瞬表示されるためクリアする
    spinResultRef.current = null
    setSpin(null)
    stoppedRef.current = [false, false, false]
    setStopped([false, false, false])
    isNaviFailedRef.current = false
    falseDefeatActionDoneRef.current = false
    setFalseDefeatWhiteout(false)
    sceneRef.current = 'ready'
    setScene('ready')
    battleClimaxTimersRef.current = []
  }, [])

  const finishToGameOver = useCallback(() => {
    setIsBattleMode(false)
    isBattleModeRef.current = false
    setBattleGame(1)
    battleGameRef.current = 1
    setBattlePhase('fighting')
    battlePhaseRef.current = 'fighting'
    falseDefeatActionDoneRef.current = false
    setFalseDefeatWhiteout(false)
    isSpecialEnemyDefeatRef.current = false
    setIsSpecialEnemyDefeat(false)
    setWinLamp(false)
    setAutoPlay(false)
    sceneRef.current = 'finished'
    setScene('finished')
    battleClimaxTimersRef.current = []
  }, [])

  // 主人公敗退ピンチ(false_defeat)時にCHANCEボタン/画面タップ/オート押下でホワイトアウト→復活 or 敗北へ分岐
  const resolveFalseDefeatChance = useCallback(() => {
    if (!isBattleModeRef.current || battlePhaseRef.current !== 'false_defeat' || falseDefeatActionDoneRef.current) {
      return
    }
    falseDefeatActionDoneRef.current = true
    triggerVisual('chance')
    soundBattleSe('chance_press')
    setFalseDefeatWhiteout(true)

    battleClimaxTimersRef.current.forEach((id) => clearTimeout(id))
    battleClimaxTimersRef.current = []

    const curPattern = battleRef.current
    const tWhiteoutEnd = window.setTimeout(() => {
      setFalseDefeatWhiteout(false)
    }, 920)

    if (curPattern === 'girl_revive') {
      const t1 = window.setTimeout(() => {
        setBattlePhase('revive_cutin')
        battlePhaseRef.current = 'revive_cutin'
        soundBattleSe('revive_fanfare')
        if (!playedBattleVoicesRef.current.has('voice_support')) {
          playedBattleVoicesRef.current.add('voice_support')
          soundBattleVoice('voice_support')
        }
        setScreenFlash(true)
        window.setTimeout(() => setScreenFlash(false), 350)
      }, 320)

      const t2 = window.setTimeout(() => {
        setBattlePhase('victory_reveal')
        battlePhaseRef.current = 'victory_reveal'
        soundBattleSe('emblem_slam')
      }, 1720)

      const t3 = window.setTimeout(finishToNextRound, 3120)
      battleClimaxTimersRef.current = [tWhiteoutEnd, t1, t2, t3]
    } else {
      const t1 = window.setTimeout(() => {
        setBattlePhase('defeat_reveal')
        battlePhaseRef.current = 'defeat_reveal'
        soundBattleSe('defeat_toll')
      }, 320)

      const t2 = window.setTimeout(finishToGameOver, 2420)
      battleClimaxTimersRef.current = [tWhiteoutEnd, t1, t2]
    }
  }, [soundBattleVoice, soundBattleSe, finishToNextRound, finishToGameOver])

  const onStop = useCallback((index: number) => {
    if (startupPhaseRef.current !== 'ready') return
    if (menuOpenRef.current) {
      setMenuOpen(false)
      return
    }

    // --- ボーナス揃えスピン中 (bonusSpin) の停止処理 ---
    if (sceneRef.current === 'bonusSpin') {
      if (stoppedRef.current[index]) return

      const nextStopped = [...stoppedRef.current] as [boolean, boolean, boolean]
      nextStopped[index] = true
      stoppedRef.current = nextStopped
      setStopped(nextStopped)

      // Trigger realistic mechanical bounce animation
      setBouncing((prev) => {
        const next = [...prev] as [boolean, boolean, boolean]
        next[index] = true
        return next
      })
      setTimeout(() => {
        setBouncing((prev) => {
          const next = [...prev] as [boolean, boolean, boolean]
          next[index] = false
          return next
        })
      }, 200)

      // 停止したリールを赤７に固定
      setReels((cur) =>
        cur.map((sym, i) => (i === index ? 'seven' : sym)) as [SymbolId, SymbolId, SymbolId]
      )

      // どのリール停止時でも停止ボタン押下SE (se_reel_stop_punch.wav) を鳴らす
      soundStop(index)

      const stoppedCount = nextStopped.filter(Boolean).length
      if (stoppedCount === 2) {
        soundSevenTenpai()
      } else if (stoppedCount === 3) {
        // 全リール停止 = 777揃い！
        if (spinRef.current) {
          clearInterval(spinRef.current)
          spinRef.current = null
        }
        soundWin()
        soundBonusFanfare()
        setWinLamp(true)
        setScreenFlash(true)
        setTimeout(() => setScreenFlash(false), 350)
        setTimeout(() => {
          sceneRef.current = 'bonusGet'
          setScene('bonusGet')
        }, 320)
      }
      return
    }

    if (sceneRef.current !== 'spinning' || stoppedRef.current[index]) return
    const target = spinResultRef.current
    if (!target) return
    soundStop(index)

    // 押し順判定:
    // - リプレイ時はゲーム内共通で押し順不問 (どの順番でも獲得可能)
    // - BATTLE MODE中のベル時は1つ目(第1停止)のみ正解すれば、残り2つは順不同で獲得可能
    // - 通常時(雑魚戦)のベル時は1〜3つ目すべて押し順通りの停止が必要
    // （判定本体: src/game/navi.ts isNaviMissOnStop）
    if (
      isNaviMissOnStop({
        target,
        isBattleMode: isBattleModeRef.current,
        stopCount: naviStopCountRef.current,
        reelIndex: index,
        naviOrder: currentNaviOrderRef.current,
      })
    ) {
      isNaviFailedRef.current = true
    }

    // 小役パート（通常時）でベル成立かつ押し順正解時、1体ずつ撃破するごとに打撃ヒットSEと敵撃破ボイスを再生
    if (!isBattleModeRef.current && target.symbol === 'bell' && !target.isReplay && !isNaviFailedRef.current) {
      soundZakoHit(naviStopCountRef.current)
      soundVoiceEnemyDefeat(index)
    }

    naviStopCountRef.current += 1
    setNaviStep(naviStopCountRef.current)

    const nextStopped = [...stoppedRef.current] as [boolean, boolean, boolean]
    nextStopped[index] = true
    stoppedRef.current = nextStopped
    setStopped(nextStopped)

    // Trigger realistic mechanical bounce animation
    setBouncing((prev) => {
      const next = [...prev] as [boolean, boolean, boolean]
      next[index] = true
      return next
    })
    setTimeout(() => {
      setBouncing((prev) => {
        const next = [...prev] as [boolean, boolean, boolean]
        next[index] = false
        return next
      })
    }, 200)

    // 押し順失敗時は役が揃わない出目を適用 (取りこぼし制御)
    const finalReels = isNaviFailedRef.current
      ? getMissReels(target.symbol)
      : target.reels

    setReels((cur) =>
      cur.map((sym, i) => (i === index ? finalReels[index] : sym)) as [SymbolId, SymbolId, SymbolId]
    )

    const stoppedCount = nextStopped.filter(Boolean).length
    if (stoppedCount === 2 && target.symbol === 'bar' && !isNaviFailedRef.current) {
      soundSevenTenpai()
    }

    if (nextStopped.every(Boolean)) {
      setShowCherryEffect(false)
      setShowMelonEffect(false)
      setShowBarAimEffect(false)
      if (spinRef.current) {
        clearInterval(spinRef.current)
        spinRef.current = null
      }
      const newGames = gamesRef.current + 1
      gamesRef.current = newGames
      setGames(newGames)

      if (isNaviFailedRef.current) {
        // 押し順を失敗した時は役を揃えない（コイン獲得0）
        soundMiss()
        setPayout(0)
        setIsReplayPending(false)
        setLitRole(null) // 役ランプは点灯させない
        setNaviAlert('押し順ミス！ 獲得0枚')
        setTimeout(() => setNaviAlert(null), 1400)
        sceneRef.current = 'ready'
        setScene('ready')
      } else {
        // 押し順成功！ 最後のリールが停止してから対応する方を点灯
        if (target.isReplay) {
          // リプレイ成立！ CREDIT消費なしで再度レバーONで次回転が始動
          setLitRole('replay')
          soundReplay()
          setPayout(0)
          setIsReplayPending(true)
          sceneRef.current = 'lever'
          setScene('lever')
        } else if (target.symbol === 'cherry') {
          // チェリー成立！ 8枚払い出し + メダル排出音 + 単チェリー時のみ筐体フラッシュ + 内部ストック抽選反映（ベルカウントには加算しない）
          setLitRole(null)
          soundPayout()
          applyMedalPayout(target.payout)
          if (target.cherryType === 'single') {
            soundWin()
            triggerCabinetCherryFlash()
          }
          applyStockGain(target.stockGain)
          sceneRef.current = 'ready'
          setScene('ready')
        } else if (target.symbol === 'melon') {
          // スイカ成立！ 8枚払い出し + メダル排出音 + 10%でストック1個加算＆獲得演出（ベルカウントには加算しない）
          setLitRole(null)
          soundPayout()
          applyMedalPayout(target.payout, { alwaysCoinSound: true })
          applyStockGain(target.stockGain)
          if (target.stockGain > 0) {
            soundWin()
            triggerMelonStockBanner()
            triggerCabinetMelonFlash()
          }
          sceneRef.current = 'ready'
          setScene('ready')
        } else if (target.symbol === 'bar') {
          // プレミアムBAR成立！ 15枚払い出し + 連続メダル排出音 + ストック20個加算 + プレミアム専用演出＆ファンファーレ（ベルカウントには加算しない）
          setLitRole(null)
          soundPayout()
          applyMedalPayout(target.payout, { alwaysCoinSound: true, cascade: true })
          applyStockGain(target.stockGain)
          soundPremiumBarSuccess()
          triggerPremiumBarEffect()
          triggerCabinetPremiumFlash()
          sceneRef.current = 'ready'
          setScene('ready')
        } else if (target.symbol === 'bell') {
          // ベル成立！ 12枚払い出し
          setLitRole('bell')
          soundPayout()
          applyMedalPayout(target.payout)

          if (!isBattleModeRef.current) {
            setBellCount((prev) => {
              const nextBells = prev + 1
              if (nextBells >= BELLS_TO_BATTLE) {
                // 8回ベルGETでBATTLE MODE突入アニメーションへ！
                setTimeout(() => {
                  lastBattleStepTimeRef.current = Date.now()
                  sceneRef.current = 'battleModeIntro'
                  setScene('battleModeIntro')
                  setScreenFlash(true)
                  soundWin()
                  setTimeout(() => setScreenFlash(false), 300)
                }, 350)
              } else {
                sceneRef.current = 'ready'
                setScene('ready')
              }
              return nextBells
            })
          } else {
            // --- バトルパート中 (全8Gで1つの攻防 & 毎ゲーム押し順ベルでコイン純増) ---
            const curG = battleGameRef.current
            if (curG >= 8) {
              // 8G目終了！バトル中にチェリー等でストックを獲得していた場合はここで敗北を救済（強制敗北指定時は除く）
              let curPattern = battleRef.current
              if (curPattern === 'defeat' && stockCountRef.current > 0 && !isForcedBattleDefeatRef.current) {
                const nextStock = stockCountRef.current - 1
                stockCountRef.current = nextStock
                setStockCount(nextStock)

                const nextUsed = totalStockUsedRef.current + 1
                totalStockUsedRef.current = nextUsed
                setTotalStockUsed(nextUsed)

                curPattern = 'girl_revive'
                battleRef.current = 'girl_revive'
                setBattle('girl_revive')
              }
              battleClimaxTimersRef.current.forEach((id) => clearTimeout(id))
              battleClimaxTimersRef.current = []

              if (curPattern === 'girl_revive' || curPattern === 'defeat') {
                // 敗北ピンチ: まず絶望の静止に入り、「CHANCEボタンを押せ！！」の入力（またはオート自動押下）を待つ
                falseDefeatActionDoneRef.current = false
                setFalseDefeatWhiteout(false)
                setBattlePhase('false_defeat')
                battlePhaseRef.current = 'false_defeat'
                soundBattleSe('false_defeat')
              } else if (curPattern === 'ally_save') {
                // 1. 8G終了後、まず肩叩きシーンを十分に見せつつカイ専用VOICE「次は仕留めろ」を1回だけ再生
                setBattlePhase('ally_shoulder_tap')
                battlePhaseRef.current = 'ally_shoulder_tap'
                if (!playedBattleVoicesRef.current.has('voice_fellow_continue')) {
                  playedBattleVoicesRef.current.add('voice_fellow_continue')
                  soundBattleVoice('voice_fellow_continue')
                }

                // 2. 肩叩きカットの後にCONTINUE表示＋継続SE
                const t1 = window.setTimeout(() => {
                  setBattlePhase('victory_reveal')
                  battlePhaseRef.current = 'victory_reveal'
                  soundBattleSe('continue_fanfare')
                  setScreenFlash(true)
                  window.setTimeout(() => setScreenFlash(false), 320)
                }, 1800)

                // 3. VOICE再生が途切れないよう余韻を確保して次ROUNDへ
                const t2 = window.setTimeout(finishToNextRound, 3600)
                battleClimaxTimersRef.current = [t1, t2]
              } else if (isSpecialEnemyDefeatRef.current) {
                // 20ROUND OVER かつ GAME OVER条件成立時の特別終了: 8G終了後、一拍の余韻を置いて敵撃破結果告知（BATTLE END）→ GAME OVERへ進む
                const t1 = window.setTimeout(() => {
                  setBattlePhase('defeat_reveal')
                  battlePhaseRef.current = 'defeat_reveal'
                  soundBattleSe('defeat_toll')
                }, 650)

                const t2 = window.setTimeout(finishToGameOver, 2750)
                battleClimaxTimersRef.current = [t1, t2]
              } else {
                // hero_attack: 8G（敵が耐える）終了後、一拍の余韻を置いて結果告知（敵が立ち上がる）→ CONTINUEへ進む
                const t1 = window.setTimeout(() => {
                  setBattlePhase('victory_reveal')
                  battlePhaseRef.current = 'victory_reveal'
                  // 結果画（敵が立ち上がる）→ 0.32s後のCONTINUE遅延スラムにSEのインパクトを同期
                  soundBattleSe('continue_fanfare', { slamDelaySec: 0.32 })
                  setScreenFlash(true)
                  window.setTimeout(() => setScreenFlash(false), 320)
                }, 650)

                const t2 = window.setTimeout(finishToNextRound, 2650)
                battleClimaxTimersRef.current = [t1, t2]
              }
            } else {
              // 1G〜7G目: 次のバトルゲームへ進み、通常通りBET待ちへ
              const nextG = curG + 1
              setBattleGame(nextG)
              battleGameRef.current = nextG
              sceneRef.current = 'ready'
              setScene('ready')
            }
          }
        }
      }
    }
  }, [soundStop, soundSevenTenpai, soundBonusFanfare, soundPayout, soundReplay, triggerCabinetCherryFlash, applyMedalPayout, applyStockGain, triggerMelonStockBanner, triggerCabinetMelonFlash, soundPremiumBarSuccess, triggerPremiumBarEffect, triggerCabinetPremiumFlash, soundWin, soundDefeat, soundMiss, soundVoiceEnemyDefeat, soundBattleVoice, soundBattleSe, finishToNextRound, finishToGameOver])

  const resolveNextBattle = useCallback(() => {
    const forcedSelection = import.meta.env.DEV ? forcedBattlePatternRef.current : null
    const { forcedPattern, isSpecialEnemyDefeat: specialEnemyDefeat } = resolveDebugBattleSelection(forcedSelection)
    const resolution = resolveBattleWithStock(currentRate, stockCountRef.current, Math.random, forcedPattern)
    if (forcedSelection !== null) {
      isForcedBattleDefeatRef.current = forcedPattern === 'defeat'
      isSpecialEnemyDefeatRef.current = specialEnemyDefeat
      setIsSpecialEnemyDefeat(specialEnemyDefeat)
      forcedBattlePatternRef.current = null
      setForcedBattlePattern(null)
    } else {
      isForcedBattleDefeatRef.current = false
      isSpecialEnemyDefeatRef.current = false
      setIsSpecialEnemyDefeat(false)
    }
    return resolution
  }, [currentRate])

  const onBattle = useCallback(() => {
    if (sceneRef.current !== 'battle') return
    soundChance()
    const resolution = resolveNextBattle()
    if (resolution.usedStock) {
      stockCountRef.current = resolution.nextStockCount
      setStockCount(resolution.nextStockCount)
      const nextUsed = totalStockUsedRef.current + 1
      totalStockUsedRef.current = nextUsed
      setTotalStockUsed(nextUsed)
    }
    const result = resolution.pattern
    playedBattleVoicesRef.current.clear()
    playedBattleFxGamesRef.current.clear()
    setBattle(result)
    setHistory((prev) => [...prev, { round, result }])
    sceneRef.current = 'battleResult'
    setScene('battleResult')
    setScreenFlash(true)
    setTimeout(() => setScreenFlash(false), 350)
    if (result !== 'defeat') {
      setWinLamp(true)
      soundWin()
    } else {
      setWinLamp(false)
      soundDefeat()
    }
  }, [resolveNextBattle, round, soundChance, soundWin, soundDefeat])

  const onNext = useCallback(() => {
    if (sceneRef.current !== 'battleResult' || !battle) return
    if (battle === 'defeat') {
      setIsBattleMode(false)
      isBattleModeRef.current = false
      setAutoPlay(false)
      sceneRef.current = 'finished'
      setScene('finished')
      setWinLamp(false)
    } else {
      setRound((r) => r + 1)
      setBellCount(0)
      setIsReplayPending(false)
      setIsBattleMode(false)
      setLitRole(null)
      setNaviAlert(null)
      gamesRef.current = 0
      setGames(0)
      setPayout(0)
      setBattle(null)
      setWinLamp(false)
      spinResultRef.current = null
      setSpin(null)
      stoppedRef.current = [false, false, false]
      setStopped([false, false, false])
      isNaviFailedRef.current = false
      sceneRef.current = 'ready'
      setScene('ready')
    }
  }, [battle])

  const resetGameState = useCallback(() => {
    stopVoiceSe()
    battleClimaxTimersRef.current.forEach((id) => clearTimeout(id))
    battleClimaxTimersRef.current = []
    playedBattleVoicesRef.current.clear()
    playedBattleFxGamesRef.current.clear()
    if (spinRef.current) clearInterval(spinRef.current)
    spinRef.current = null
    gamesRef.current = 0
    stoppedRef.current = [false, false, false]
    spinResultRef.current = null
    stockCountRef.current = 0
    setStockCount(0)
    totalStockEarnedRef.current = 0
    setTotalStockEarned(0)
    totalStockUsedRef.current = 0
    setTotalStockUsed(0)
    setShowCherryEffect(false)
    setShowMelonEffect(false)
    setShowMelonStockBanner(false)
    setCabinetMelonFlash(false)
    setShowBarAimEffect(false)
    setShowPremiumBarEffect(false)
    setCabinetPremiumFlash(false)
    setAutoPlay(false)
    setRound(1)
    setGames(0)
    setCredit(50)
    creditRef.current = 50
    setTotalMedals(0)
    setPayout(0)
    setBellCount(0)
    setIsBattleMode(false)
    isBattleModeRef.current = false
    setBattleGame(1)
    battleGameRef.current = 1
    setBattlePhase('fighting')
    battlePhaseRef.current = 'fighting'
    setIsReplayPending(false)
    setLitRole(null)
    setNaviAlert(null)
    isNaviFailedRef.current = false
    naviStopCountRef.current = 0
    setNaviStep(0)
    setReels(START_REELS)
    setStopped([false, false, false])
    setBouncing([false, false, false])
    setSpin(null)
    setBattle(null)
    battleRef.current = null
    isForcedBattleDefeatRef.current = false
    isSpecialEnemyDefeatRef.current = false
    setIsSpecialEnemyDefeat(false)
    setHistory([])
    setWinLamp(false)
    sceneRef.current = 'bonusSpin'
    setScene('bonusSpin')
  }, [])

  const onRetry = useCallback(() => {
    // 設定は同一セッション中固定のため再抽選しない
    resetGameState()
    soundBet()
  }, [resetGameState, soundBet])

  const resetForNewSession = useCallback(() => {
    setMuted(true)
    mutedRef.current = true
    setMenuOpen(false)
    setRateIndex(drawSettingIndex())
    resetGameState()
    setSessionExpiredNotice(true)
    lastActiveAtRef.current = Date.now()
  }, [resetGameState])

  // タブ切り替え時の自動音OFF/途中再開 & 長時間放置によるセッション切れ処理
  useEffect(() => {
    const checkSessionTimeout = (): boolean => {
      const elapsed = Date.now() - lastActiveAtRef.current
      if (elapsed >= SESSION_TIMEOUT_MS) {
        resetForNewSession()
        return true
      }
      return false
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsTabHidden(true)
        suspendSeAudio()
      } else {
        const timedOut = checkSessionTimeout()
        setIsTabHidden(false)
        if (!timedOut) {
          lastActiveAtRef.current = Date.now()
          if (!mutedRef.current) {
            resumeSeAudio()
          }
        }
      }
    }

    const handleUserActivity = () => {
      if (document.hidden) return
      if (!checkSessionTimeout()) {
        lastActiveAtRef.current = Date.now()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pointerdown', handleUserActivity, { passive: true })
    window.addEventListener('keydown', handleUserActivity, { passive: true })
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pointerdown', handleUserActivity)
      window.removeEventListener('keydown', handleUserActivity)
    }
  }, [resetForNewSession])

  // 右クリック・ドラッグ＆ドロップ・テキスト選択・マルチタッチズーム等の抑止（基本操作を左クリック／タップのみに制限）
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

    const preventDefault = (e: Event) => {
      e.preventDefault()
    }

    const preventDragOrDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const preventSelectStart = (e: Event) => {
      if (isEditableTarget(e.target)) return
      e.preventDefault()
    }

    const preventNonPrimaryPointer = (e: PointerEvent) => {
      // タッチ・ペン、またはマウスの左クリック(button === 0)のみ許可
      if (e.pointerType === 'mouse' && e.button !== 0) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const preventNonPrimaryMouse = (e: MouseEvent) => {
      if (e.button !== 0) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const preventAuxClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const preventMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }

    const preventPinchWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
      }
    }

    document.addEventListener('contextmenu', preventDefault, { capture: true })
    document.addEventListener('dragstart', preventDragOrDrop, { capture: true })
    document.addEventListener('drag', preventDragOrDrop, { capture: true })
    document.addEventListener('dragenter', preventDragOrDrop, { capture: true })
    document.addEventListener('dragover', preventDragOrDrop, { capture: true })
    document.addEventListener('drop', preventDragOrDrop, { capture: true })
    document.addEventListener('selectstart', preventSelectStart, { capture: true })
    document.addEventListener('pointerdown', preventNonPrimaryPointer, { capture: true })
    document.addEventListener('mousedown', preventNonPrimaryMouse, { capture: true })
    document.addEventListener('auxclick', preventAuxClick, { capture: true })
    document.addEventListener('click', preventNonPrimaryMouse, { capture: true })
    document.addEventListener('touchstart', preventMultiTouch, { capture: true, passive: false })
    document.addEventListener('touchmove', preventMultiTouch, { capture: true, passive: false })
    document.addEventListener('gesturestart', preventDefault, { capture: true })
    document.addEventListener('gesturechange', preventDefault, { capture: true })
    document.addEventListener('gestureend', preventDefault, { capture: true })
    window.addEventListener('wheel', preventPinchWheel, { passive: false })

    return () => {
      document.removeEventListener('contextmenu', preventDefault, { capture: true })
      document.removeEventListener('dragstart', preventDragOrDrop, { capture: true })
      document.removeEventListener('drag', preventDragOrDrop, { capture: true })
      document.removeEventListener('dragenter', preventDragOrDrop, { capture: true })
      document.removeEventListener('dragover', preventDragOrDrop, { capture: true })
      document.removeEventListener('drop', preventDragOrDrop, { capture: true })
      document.removeEventListener('selectstart', preventSelectStart, { capture: true })
      document.removeEventListener('pointerdown', preventNonPrimaryPointer, { capture: true })
      document.removeEventListener('mousedown', preventNonPrimaryMouse, { capture: true })
      document.removeEventListener('auxclick', preventAuxClick, { capture: true })
      document.removeEventListener('click', preventNonPrimaryMouse, { capture: true })
      document.removeEventListener('touchstart', preventMultiTouch, { capture: true })
      document.removeEventListener('touchmove', preventMultiTouch, { capture: true })
      document.removeEventListener('gesturestart', preventDefault, { capture: true })
      document.removeEventListener('gesturechange', preventDefault, { capture: true })
      document.removeEventListener('gestureend', preventDefault, { capture: true })
      window.removeEventListener('wheel', preventPinchWheel)
    }
  }, [])

  const onStartBattleAction = useCallback(() => {
    if (sceneRef.current !== 'battleModeIntro') return
    soundChance()
    triggerVisual('chance')
    setScreenFlash(true)
    setTimeout(() => setScreenFlash(false), 250)
    const resolution = resolveNextBattle()
    if (resolution.usedStock) {
      stockCountRef.current = resolution.nextStockCount
      setStockCount(resolution.nextStockCount)
      const nextUsed = totalStockUsedRef.current + 1
      totalStockUsedRef.current = nextUsed
      setTotalStockUsed(nextUsed)
    }
    const result = resolution.pattern
    playedBattleVoicesRef.current.clear()
    playedBattleFxGamesRef.current.clear()
    setBattle(result)
    battleRef.current = result
    setBattleGame(1)
    battleGameRef.current = 1
    setBattlePhase('fighting')
    battlePhaseRef.current = 'fighting'
    setIsBattleMode(true)
    isBattleModeRef.current = true
    setHistory((prev) => [...prev, { round, result }])
    sceneRef.current = 'ready'
    setScene('ready')
  }, [soundChance, resolveNextBattle, round])

  // 自動停止（オート・どこでもタップ・Space/Enter 共通）: ボーナス揃え中は左から順、通常は押し順ナビに従う
  // 停止リールの選択: src/game/navi.ts
  const stopNextReel = useCallback(() => {
    const targetReel =
      sceneRef.current === 'bonusSpin'
        ? pickBonusStopReel(stoppedRef.current)
        : pickNaviStopReel(currentNaviOrderRef.current, naviStepRef.current, stoppedRef.current)
    if (targetReel === -1) return
    triggerVisual(targetReel as ReelIndex)
    onStop(targetReel)
  }, [onStop])

  // AUTO PLAY Timer Logic (AUTO PLAY ON / 倍速ON)
  useEffect(() => {
    if (!autoPlay || startupPhase !== 'ready') return

    const intervalMs = fastSpeed ? 140 : 420
    const timer = setInterval(() => {
      if (startupPhaseRef.current !== 'ready') return
      if (menuOpen || isTabHidden || sessionExpiredNotice) return // 設定画面・別タブ・セッション切れ表示中は一時停止
      lastActiveAtRef.current = Date.now()

      if (sceneRef.current === 'ready') {
        triggerVisual('bet')
        onBet()
      } else if (sceneRef.current === 'lever') {
        triggerVisual('lever')
        onLever()
      } else if (sceneRef.current === 'bonusSpin' || sceneRef.current === 'spinning') {
        // ボーナス確定中は順押しで赤７を揃え、通常は押し順ナビに従ってリールを停止
        stopNextReel()
      } else if (sceneRef.current === 'battleModeIntro') {
        const now = Date.now()
        if (now - lastBattleStepTimeRef.current < 2500) return
        lastBattleStepTimeRef.current = now
        triggerVisual('chance')
        onStartBattleAction()
      } else if (sceneRef.current === 'battle') {
        const now = Date.now()
        if (now - lastBattleStepTimeRef.current < 1200) return
        lastBattleStepTimeRef.current = now
        triggerVisual('chance')
        onBattle()
      } else if (sceneRef.current === 'battleResult') {
        const now = Date.now()
        if (now - lastBattleStepTimeRef.current < 1600) return
        lastBattleStepTimeRef.current = now
        onNext()
      }
    }, intervalMs)

    return () => clearInterval(timer)
  }, [autoPlay, fastSpeed, startupPhase, menuOpen, isTabHidden, sessionExpiredNotice, onBet, onLever, stopNextReel, onBattle, onNext, onStartBattleAction])

  // オート / 倍速オート中も「CHANCEボタンを押せ!!」演出と押下後ホワイトアウトが失われないよう一定時間後に自動押下
  useEffect(() => {
    if (!autoPlay || !isBattleMode || battlePhase !== 'false_defeat') return
    if (menuOpen || isTabHidden || sessionExpiredNotice) return
    const delayMs = fastSpeed ? 850 : 1200
    const timer = window.setTimeout(() => {
      resolveFalseDefeatChance()
    }, delayMs)
    return () => clearTimeout(timer)
  }, [autoPlay, fastSpeed, isBattleMode, battlePhase, menuOpen, isTabHidden, sessionExpiredNotice, resolveFalseDefeatChance])

  // Explicit CHANCE button click handler
  const onChancePress = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation()
    if (startupPhaseRef.current !== 'ready') return
    if (menuOpenRef.current) {
      setMenuOpen(false)
      return
    }
    if (isBattleModeRef.current && battlePhaseRef.current === 'false_defeat') {
      resolveFalseDefeatChance()
      return
    }
    triggerVisual('chance')
    soundChance()
    if (sceneRef.current === 'battleModeIntro') {
      onStartBattleAction()
    } else if (sceneRef.current === 'battle') {
      onBattle()
    } else if (sceneRef.current === 'battleResult') {
      onNext()
    }
  }, [soundChance, onStartBattleAction, onBattle, onNext, resolveFalseDefeatChance])

  const onStartBonus = useCallback(() => {
    soundBonusFanfare()
    triggerVisual('lever')
    setScreenFlash(true)
    setTimeout(() => setScreenFlash(false), 350)
    setIsBattleMode(false)
    setBellCount(0)
    setRound(1)
    setGames(0)
    setWinLamp(false)
    setScene('ready')
    sceneRef.current = 'ready'
  }, [soundBonusFanfare])

  // 「次に進む」共通アクション（どこでもタップ・Space/Enter 共通）
  // オートプレイは突入演出などに待ち時間の制御があるため AUTO PLAY Timer Logic 側で個別に分岐している
  const performPrimaryAction = useCallback(() => {
    if (isBattleModeRef.current && battlePhaseRef.current === 'false_defeat') {
      resolveFalseDefeatChance()
      return
    }
    const currentScene = sceneRef.current
    if (currentScene === 'bonusSpin' || currentScene === 'spinning') {
      stopNextReel()
    } else if (currentScene === 'bonusGet') {
      onStartBonus()
    } else if (currentScene === 'battleModeIntro') {
      onStartBattleAction()
    } else if (currentScene === 'ready') {
      triggerVisual('bet')
      onBet()
    } else if (currentScene === 'lever') {
      triggerVisual('lever')
      onLever()
    } else if (currentScene === 'battle') {
      triggerVisual('chance')
      onBattle()
    } else if (currentScene === 'battleResult') {
      onNext()
    }
  }, [resolveFalseDefeatChance, stopNextReel, onStartBonus, onStartBattleAction, onBet, onLever, onBattle, onNext])

  // Anywhere Tap: Triggers the natural next action anywhere on the screen
  const handleAnywhereTap = (e: React.MouseEvent | React.TouchEvent) => {
    unlockAudio()
    void unlockSeAudio()
    if (startupPhaseRef.current !== 'ready') return
    if (sessionExpiredNoticeRef.current) return
    const target = e.target as HTMLElement
    const inDisplayArea = target.closest('.upper-lcd-display') || target.closest('.lcd-settings-view')

    // 設定画面が開いている時はディスプレイエリア以外のタップorクリックで設定画面解除（メインのゲームを進行させない）
    if (menuOpenRef.current) {
      if (!inDisplayArea) {
        setMenuOpen(false)
      }
      return
    }

    if (target.closest('.interactive-control')) return

    // 以降の「次に進む」分岐は Space/Enter と共通
    performPrimaryAction()
  }

  // Keyboard shortcut support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (startupPhaseRef.current !== 'ready') return
      if (e.key === 's' || e.key === 'S') { setMenuOpen((prev) => !prev); return }
      if (sessionExpiredNoticeRef.current) {
        if (e.code === 'Space' || e.code === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          setSessionExpiredNotice(false)
        }
        return
      }
      if (menuOpenRef.current) {
        if (e.code === 'Space' || e.code === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          setMenuOpen(false)
        }
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        performPrimaryAction()
      }
      if (e.key === '1') { triggerVisual(0); onStop(0) }
      if (e.key === '2') { triggerVisual(1); onStop(1) }
      if (e.key === '3') { triggerVisual(2); onStop(2) }
      if (e.key === 'c' || e.key === 'C') { onChancePress() }
      if (e.key === 'm' || e.key === 'M') { setMuted((prev) => !prev) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [performPrimaryAction, onStop, onChancePress])

  const isBattleScene = scene === 'battle' || scene === 'battleResult'
  const isBattleLampLit = isBattleMode || scene === 'battleModeIntro' || isBattleScene

  // Is CHANCE button illuminated? (押すべきタイミングのみ発光)
  const isChanceActive =
    (isBattleMode && battlePhase === 'false_defeat' && !falseDefeatWhiteout) ||
    scene === 'battleModeIntro' ||
    scene === 'battle' ||
    scene === 'battleResult'

  // 押し順ナビ表示（リール強調枠・STOPボタン強調・右側ナビランプ）: src/game/navi.ts resolveNaviReelDisplay
  const naviDisplay = ([0, 1, 2] as const).map((idx) =>
    resolveNaviReelDisplay(
      { scene, spin, stopped, isBattleMode, naviOrder: currentNaviOrder, naviNumbers: currentNavi, naviStep },
      idx
    )
  )
  const isReelNaviTarget = (idx: number): boolean => naviDisplay[idx]?.isTarget ?? false
  const getNaviSegmentClass = (idx: number): string => naviDisplay[idx]?.segment ?? 'idle'
  const getNaviSegmentNum = (idx: number): string | number => naviDisplay[idx]?.num ?? '-'

  // Top Lamp illumination mode determination (上下ランプ・拡張サイドフレーム共通)
  const topLampMode = resolveTopLampMode({
    scene,
    payout,
    spinSymbol: spin?.symbol ?? null,
    litRole,
    showPremiumBarEffect,
    winLamp,
    battle,
  })

  const isCherryDisplay =
    spin !== null &&
    spin.symbol === 'cherry' &&
    !isNaviFailedRef.current &&
    (scene === 'spinning' || scene === 'ready')

  const isMelonDisplay =
    spin !== null &&
    spin.symbol === 'melon' &&
    !isNaviFailedRef.current &&
    (scene === 'spinning' || scene === 'ready')

  const isBarDisplay =
    spin !== null &&
    spin.symbol === 'bar' &&
    !isNaviFailedRef.current &&
    (scene === 'spinning' || scene === 'ready')

  const {
    scale: cabinetScale,
    isLandscapeCompact,
    isMobilePortrait,
    isBottomCompact,
    needsScroll: cabinetNeedsScroll,
    sideSpace,
    stageWidth,
    stageHeight,
    cabinetHeight,
  } = cabinetLayout
  const showSideWings = isMobilePortrait && sideSpace > 0
  const showDebugPanels = import.meta.env.DEV && !isLandscapeCompact && !isMobilePortrait && sideSpace >= 276
  const debugPanelOffsetPx = Math.round(stageWidth / 2) + 20
  const progressStatusText = isBattleMode
    ? `バトル中（${battleGame}G / ${BATTLE_PART_GAMES}G）`
    : scene === 'battleModeIntro'
      ? '通常時（バトル突入演出）'
      : scene === 'finished'
        ? '通常時（GAME OVER）'
        : '通常時'
  const stageStyle = isLandscapeCompact
    ? undefined
    : {
        width: `${stageWidth}px`,
        height: `${stageHeight}px`,
      }
  const cabinetStyle = isLandscapeCompact
    ? undefined
    : {
        height: `${cabinetHeight}px`,
        transform: `scale(${cabinetScale})`,
      }
  const sideWingStyle = showSideWings ? { height: `${stageHeight}px` } : undefined

  return (
    <div
      ref={wrapperRef}
      className={`cabinet-wrapper ${isMobilePortrait ? 'mobile-portrait' : ''} ${cabinetNeedsScroll ? 'scroll-fallback' : ''}`}
      onClick={handleAnywhereTap}
    >
      {showDebugPanels && (
        <DebugSettingsPanel
          offsetPx={debugPanelOffsetPx}
          forcedSpinRole={forcedSpinRole}
          onForcedSpinRoleChange={(val) => {
            forcedSpinRoleRef.current = val
            setForcedSpinRole(val)
          }}
          forcedStockMode={forcedStockMode}
          onForcedStockModeChange={(val) => {
            forcedStockModeRef.current = val
            setForcedStockMode(val)
          }}
          forcedBarAimMode={forcedBarAimMode}
          onForcedBarAimModeChange={(val) => {
            forcedBarAimModeRef.current = val
            setForcedBarAimMode(val)
          }}
          forcedBattlePattern={forcedBattlePattern}
          onForcedBattlePatternChange={(val) => {
            forcedBattlePatternRef.current = val
            setForcedBattlePattern(val)
          }}
        />
      )}
      {showSideWings && <CabinetSideWing side="left" topLampMode={topLampMode} style={sideWingStyle} />}
      <div className="cabinet-scale-stage" style={stageStyle}>
        <div className={`pachislot-cabinet ${isBottomCompact ? 'bottom-compact' : ''} ${cabinetCherryFlash ? 'cabinet-cherry-flash' : ''} ${cabinetMelonFlash ? 'cabinet-melon-flash' : ''} ${cabinetPremiumFlash ? 'cabinet-premium-flash' : ''}`} style={cabinetStyle}>
        {/* --- 1. TOP ILLUMINATION CROWN (演出特化型・超ド派手トップランプユニット) --- */}
        <TopCrown topLampMode={topLampMode} />

        {/* --- 2. UPPER LCD SCREEN (巨大メイン演出液晶) --- */}
        <section className={`upper-lcd-frame ${screenFlash ? 'screen-flash' : ''}`}>
          <div className="lcd-corner-screw top-left" />
          <div className="lcd-corner-screw top-right" />
          <div className="lcd-corner-screw btm-left" />
          <div className="lcd-corner-screw btm-right" />
          <div className={`upper-lcd-display ${scene === 'bonusGet' || scene === 'bonusSpin' ? 'bonus-get-mode' : scene === 'battleModeIntro' ? 'battle-intro-mode' : isBattleMode ? 'battle-mode' : 'normal-mode'}`}>
            {startupPhase !== 'ready' ? (
              <div className="startup-lcd-overlay" role="status" aria-live="polite">
                <div className="startup-lcd-emblem">⚔️ HERO NEVER WINS ⚔️</div>
                <div className="startup-lcd-status">NOW LOADING...</div>
                <div className="startup-lcd-bar">
                  <div
                    className="startup-lcd-bar-fill"
                    style={{
                      width: `${loadProgress.total > 0 ? Math.min(100, Math.round((loadProgress.loaded / loadProgress.total) * 100)) : 0}%`,
                    }}
                  />
                </div>
                <div className="startup-lcd-percent">
                  {loadProgress.total > 0 ? Math.min(100, Math.round((loadProgress.loaded / loadProgress.total) * 100)) : 0}%
                </div>
              </div>
            ) : scene === 'bonusSpin' ? (
              <BonusKakuteiDisplay />
            ) : scene === 'bonusGet' ? (
              <BonusGetDisplay onPlayVoice={soundVoiceBonusGet} />
            ) : scene === 'battleModeIntro' ? (
              <BattleModeIntroDisplay
                round={round}
                onStartBattle={onStartBattleAction}
                onPlayVoice={soundVoiceRoundStart}
              />
            ) : scene === 'finished' ? (
              <GameOverResultDisplay
                rateIndex={rateIndex}
                totalStockEarned={totalStockEarned}
                round={round}
                totalMedals={totalMedals}
              />
            ) : isBattleMode ? (
              <BattleSceneDisplay
                round={round}
                totalMedals={totalMedals}
                pattern={battle ?? 'defeat'}
                battleGame={battleGame}
                battlePhase={battlePhase}
                scene={scene}
                symbol={spin?.symbol ?? null}
                payout={payout}
                autoPlay={autoPlay}
                fastSpeed={fastSpeed}
                isSpecialEnemyDefeat={isSpecialEnemyDefeat}
                falseDefeatWhiteout={falseDefeatWhiteout}
                leverFxArmed={battleLeverFxArmed}
              />
            ) : (
              /* 小役パート: 共通デザイン兵士3体・闘技場背景・個別撃破演出 / 8 GET */
              <ZakoNaviDisplay
                scene={scene}
                symbol={spin?.symbol ?? null}
                isReplay={spin?.isReplay ?? false}
                naviNumbers={currentNavi}
                naviOrder={currentNaviOrder}
                naviStep={naviStep}
                stopped={stopped}
                isNaviFailed={isNaviFailedRef.current}
                bellCount={bellCount}
                totalMedals={totalMedals}
                payout={payout}
                autoPlay={autoPlay}
                fastSpeed={fastSpeed}
              />
            )}

            {/* チェリー成立時専用エフェクト（第3リール停止まで継続・ストック成否や種類による差異なし） */}
            {showCherryEffect && <CherryEffectOverlay key={cherryEffectKey} />}

            {/* スイカ成立時専用エフェクト（第3リール停止まで継続・ストック成否による差異なし） */}
            {showMelonEffect && <MelonEffectOverlay key={melonEffectKey} />}

            {/* スイカ＋ストック当選時の獲得告知 */}
            {showMelonStockBanner && <MelonStockBanner key={melonStockKey} />}

            {/* 「BARを狙え！」カットイン演出（レバーON〜第3リール停止まで表示） */}
            {showBarAimEffect && <BarAimCutinOverlay key={barAimEffectKey} />}

            {/* プレミアムBAR揃い成功時究極演出（PixiJS 黄金雷撃＆衝撃波 + GSAP 多段スラム） */}
            {showPremiumBarEffect && <PremiumBarDisplay key={premiumBarEffectKey} />}

            {/* 長時間放置によるセッション切れ通知（音OFF・最初からやり直し） */}
            {sessionExpiredNotice && (
              <div className="session-expired-overlay interactive-control" onClick={(e) => e.stopPropagation()}>
                <div className="session-expired-card">
                  <div className="session-expired-title">セッションが切れました</div>
                  <p className="session-expired-desc">
                    長時間操作がなかったためセッションが終了しました。サウンドをOFFにして最初からやり直します。
                  </p>
                  <button
                    type="button"
                    className="session-expired-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSessionExpiredNotice(false)
                    }}
                  >
                    OK（最初からやり直す）
                  </button>
                </div>
              </div>
            )}

            {/* 設定画面 (銀色ボタン押下で液晶表示切り替え・ダイアログではなく液晶画面そのもの) */}
            {menuOpen && (
              <LcdSettingsView
                muted={muted}
                onMutedChange={setMuted}
                autoPlay={autoPlay}
                onAutoPlayChange={setAutoPlay}
                fastSpeed={fastSpeed}
                onFastSpeedChange={setFastSpeed}
              />
            )}

            {/* 特定シーン (ボーナス確定・GET・BATTLE MODE・死闘) のみ下部ナビストリップ表示。小役パート中は画面全体を魅せるため非表示 */}
            {startupPhase === 'ready' && (scene === 'bonusSpin' || scene === 'bonusGet' || scene === 'battleModeIntro' || isBattleScene) && (
              <div className="lcd-navi-strip">
                {naviAlert ? (
                  <span className="navi-text danger-pulse">{naviAlert}</span>
                ) : (
                  <>
                    {scene === 'bonusSpin' && <span className="navi-text blink gold">⚡ BONUS確定 ⚡ 赤７を狙え！</span>}
                    {scene === 'bonusGet' && <span className="navi-text blink gold">⚔️ BONUS GET ⚔️</span>}
                    {scene === 'battleModeIntro' && <span className="navi-text danger-pulse">⚡ BATTLE MODE 突入！ PUSH CHANCE ⚡</span>}
                    {scene === 'battle' && <span className="navi-text danger-pulse">PRESS CHANCE / PUSH ANYWHERE!</span>}
                    {scene === 'battleResult' && (
                      <span className="navi-text blink gold">
                        {battle === 'defeat' ? 'TAP ➔ 結果を見る' : 'TAP ➔ なぜか継続！ 次へ'}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {/* バトルシーン等の右下AUTO表示 (小役パート外用) */}
            {autoPlay && isBattleScene && (
              <div className="raw-lcd-auto-indicator">
                <span className={`auto-raw-text ${fastSpeed ? 'fast' : ''}`}>
                  AUTO{fastSpeed ? ' 2x' : ''}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* --- 3. REEL SECTION (3 Reels + BATTLE MODE Lamp + 押し順ナビランプ + MAX BET) --- */}
        <section className="reel-deck-housing">
          <div className="reel-deck-content">
            {/* Center: 3 Reels with Center Payline */}
            <div className="center-reel-unit">
              <div className={`reel-window-bezel ${scene === 'bonusGet' ? 'bonus-jackpot-active' : ''} ${isCherryDisplay ? 'cherry-focus-mode' : ''} ${isMelonDisplay ? 'melon-focus-mode' : ''} ${isBarDisplay ? 'bar-focus-mode' : ''}`}>
                <div className="reel-visor top-visor" />
                <div className="reel-glass-surface">
                  <div className="center-payline" />
                  <div className="reel-glass-streak" />
                  <div className="reels-trio">
                    {reels.map((symbol, idx) => {
                      const winSyms = getReelWindow(symbol, idx)
                      const isSpinning = startupPhase === 'ready' && (scene === 'spinning' || scene === 'bonusSpin') && !stopped[idx]
                      const isBounce = bouncing[idx]
                      const isNaviTarget = isReelNaviTarget(idx)
                      const isCherryLit = isCherryDisplay && stopped[idx] && symbol === 'cherry'
                      const isMelonLit = isMelonDisplay && stopped[idx] && symbol === 'melon'
                      const isBarLit = isBarDisplay && stopped[idx] && symbol === 'bar'

                      return (
                        <div
                          className={`reel-column ${isNaviTarget ? 'navi-target-column' : ''}`}
                          key={idx}
                        >
                          {/* 押すべきリールの強調枠 (イエローゴールド発光フレーム) */}
                          {isNaviTarget && <div className="target-glow-frame" />}

                          <div
                            className={`reel-drum ${isSpinning ? 'spinning' : ''} ${isBounce ? 'bounce-stop' : ''} ${isNaviTarget ? 'drum-target-lit' : isSpinning ? 'drum-wait-dim' : ''
                              }`}
                          >
                            <div className="drum-cell top">
                              <ReelSymbolSvg id={winSyms[0]} />
                            </div>
                            <div className={`drum-cell center ${isCherryLit ? 'cherry-symbol-lit' : ''} ${isMelonLit ? 'melon-symbol-lit' : ''} ${isBarLit ? 'bar-symbol-lit' : ''}`}>
                              <div className="symbol-backlight" />
                              <ReelSymbolSvg id={symbol} isCenter={true} />
                            </div>
                            <div className="drum-cell bottom">
                              <ReelSymbolSvg id={winSyms[2]} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="reel-visor btm-visor" />
              </div>

              {/* Reel Bottom Strip: Mini LED Segments */}
              <div className="reel-bottom-bar">
                <div className="mini-led-seg-box">
                  <div className="mini-seg">
                    <span className="lbl">BET</span>
                    <span className="val green">{scene === 'ready' ? '0' : '3'}</span>
                  </div>
                  <div className="mini-seg">
                    <span className="lbl">PAY</span>
                    <span className={`val red ${payout > 0 ? 'payout-flash' : ''}`}>{payout}</span>
                  </div>
                  <div className="mini-seg">
                    <span className="lbl">CREDIT</span>
                    <span className="val amber">{credit}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: BATTLE MODE Lamp & 押し順ナビランプ ユニット */}
            <aside className="right-status-deck">
              {/* 上部: 大型 BATTLE MODE ランプ (画像生成・点灯時は炎が揺らめき、消灯時はシックなアクリルゴールド) */}
              <div className={`battle-mode-emblem ${isBattleLampLit ? 'lit-flame' : 'dormant'}`}>
                <div className="bm-emblem-frame">
                  <img
                    src={isBattleLampLit ? 'battle_mode_lit.jpg' : 'battle_mode_off.jpg'}
                    alt="BATTLE MODE"
                    className="bm-panel-img"
                  />
                </div>
              </div>

              {/* 下部: ボタン押し順ナビランプ群 */}
              <div className="navi-lamp-console">
                {/* 役ランプ: BELL / REP (最後のリールが停止してから対応する方を点灯) */}
                <div className="role-lamp-row">
                  <span className={`role-lamp bell-lamp ${litRole === 'bell' ? 'lit' : ''}`}>
                    BELL
                  </span>
                  <span className={`role-lamp rep-lamp ${litRole === 'replay' ? 'lit' : ''}`}>
                    REP
                  </span>
                </div>

                {/* 3連押し順ナビセグメント (左・中・右) */}
                <div className="navi-order-segments">
                  <div className={`order-seg seg-l ${getNaviSegmentClass(0)}`}>
                    <span className="seg-label">左</span>
                    <span className="seg-num">{getNaviSegmentNum(0)}</span>
                  </div>
                  <div className={`order-seg seg-c ${getNaviSegmentClass(1)}`}>
                    <span className="seg-label">中</span>
                    <span className="seg-num">{getNaviSegmentNum(1)}</span>
                  </div>
                  <div className={`order-seg seg-r ${getNaviSegmentClass(2)}`}>
                    <span className="seg-label">右</span>
                    <span className="seg-num">{getNaviSegmentNum(2)}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* --- 4. MID CONTROL DECK (スラント操作卓: 角丸四角CHANCE + 銀色設定ボタン + MAX BET + 立体黒丸ノブレバー + 3 STOP) --- */}
        <section className="mid-control-deck">
          {/* Top Slant Controls (中央寄り: 角丸四角CHANCE / 右寄せ: 設定ボタン & MAX BET) */}
          <div className="mid-deck-upper-controls">
            {/* CHANCEボタン (レバーとリール停止ボタンの間の真ん中あたり) */}
            <div className="upper-ctrl-chance-slot">
              <button
                className={`physical-chance-btn compact interactive-control ${isChanceActive ? 'illuminated' : ''
                  } ${scene === 'battleModeIntro' || scene === 'battle' || (isBattleMode && battlePhase === 'false_defeat' && !falseDefeatWhiteout) ? 'pulse-red' : ''} ${activeControl === 'chance' ? 'chance-pressed' : ''
                  }`}
                onClick={onChancePress}
                disabled={startupPhase !== 'ready'}
                aria-label="CHANCE PUSH BUTTON"
              >
                <div className="chance-metallic-ring">
                  <div className="chance-inner-bezel">
                    <div className="chance-resin-cover">
                      <span className="chance-btn-text">CHANCE</span>
                      <div className="chance-light-core" />
                      <div className="chance-specular-lens" />
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <div className="upper-ctrl-cluster">
              {/* 光沢シルバーの丸い設定ボタン (MAX BETの左) */}
              <button
                className={`silver-menu-btn interactive-control ${menuOpen ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  if (startupPhaseRef.current !== 'ready') return
                  setMenuOpen((prev) => !prev)
                }}
                disabled={startupPhase !== 'ready'}
                aria-label="設定メニュー"
                title="台設定・AUTO・サウンドメニュー (Key: S)"
              >
                <div className="silver-btn-rim">
                  <div className="silver-btn-face">
                    <span className="silver-btn-icon">⚙️</span>
                  </div>
                </div>
              </button>

              {/* MAX BET ボタン */}
              <div className="max-bet-wrap">
                {scene === 'finished' && (
                  <div className="retry-speech-bubble" role="status">
                    <span className="retry-bubble-text">押してリトライ！</span>
                  </div>
                )}
                <button
                  className={`max-bet-btn interactive-control ${scene === 'ready' || scene === 'finished' ? 'pulse-glow' : ''} ${activeControl === 'bet' ? 'active-press' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (menuOpenRef.current) {
                      setMenuOpen(false)
                      return
                    }
                    triggerVisual('bet')
                    if (sceneRef.current === 'finished') {
                      onRetry()
                    } else {
                      onBet()
                    }
                  }}
                  disabled={startupPhase !== 'ready' || (scene !== 'ready' && scene !== 'finished')}
                  aria-label={scene === 'finished' ? 'MAX BET (リトライ)' : 'MAX BET'}
                >
                  <span className="bet-text">MAX<br />BET</span>
                </button>
              </div>
            </div>
          </div>

          {/* Slant Accent Trim */}
          <div className="mid-deck-slant-line" />

          {/* Bottom Row: Start Lever Knob (棒なし・立体黒丸ノブ) & 3 Stop Buttons */}
          <div className="mid-deck-lower-row">
            <div className="lever-dock">
              <div className="lever-socket-recess">
                <button
                  className={`arcade-lever-knob-btn interactive-control ${scene === 'lever' ? 'ready' : ''} ${activeControl === 'lever' ? 'pushed' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (menuOpenRef.current) {
                      setMenuOpen(false)
                      return
                    }
                    triggerVisual('lever')
                    onLever()
                  }}
                  disabled={startupPhase !== 'ready' || scene !== 'lever'}
                  aria-label="START LEVER"
                >
                  <div className="arcade-lever-knob" />
                </button>
              </div>
            </div>

            <div className="stop-buttons-dock">
              {[0, 1, 2].map((idx) => {
                const canStop = startupPhase === 'ready' && (scene === 'spinning' || scene === 'bonusSpin') && !stopped[idx]
                const isTargetBtn = isReelNaviTarget(idx)
                const isPressed = activeControl === idx || stopped[idx]
                return (
                  <div key={idx} className="stop-button-socket">
                    <button
                      className={`arcade-stop-btn interactive-control ${canStop ? 'lit-glow' : ''} ${isTargetBtn ? 'target-glow' : ''} ${isPressed ? 'pressed-down' : ''} ${stopped[idx] ? 'is-stopped' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (menuOpenRef.current) {
                          setMenuOpen(false)
                          return
                        }
                        triggerVisual(idx as 0 | 1 | 2)
                        onStop(idx)
                      }}
                      disabled={!canStop}
                      aria-label={`STOP ${idx + 1}`}
                    >
                      <span className="stop-led-ring" />
                      <span className="btn-chrome-ring">
                        <span className="btn-inner-light" />
                        <span className="btn-specular-reflection" />
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* --- 5. BELLY GLASS PANEL (下部アクリルパネルアート + スリット電飾バー) --- */}
        <BellyGlassPanel topLampMode={topLampMode} />

        {/* --- 6. BOTTOM CABINET DECK (左右縦型スピーカー & 中央固定受け皿ユニット & 前面リム) --- */}
        <BottomCabinetDeck />
        </div>
      </div>
      {showSideWings && <CabinetSideWing side="right" topLampMode={topLampMode} style={sideWingStyle} />}
      {showDebugPanels && (
        <DebugStatusPanel
          offsetPx={debugPanelOffsetPx}
          stockCount={stockCount}
          forcedSpinRole={forcedSpinRole}
          forcedStockMode={forcedStockMode}
          forcedBarAimMode={forcedBarAimMode}
          forcedBattlePattern={forcedBattlePattern}
          progressStatusText={progressStatusText}
        />
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
