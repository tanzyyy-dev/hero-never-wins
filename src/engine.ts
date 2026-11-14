/** 設定1〜6の確率テーブル */
export type SettingNumber = 1 | 2 | 3 | 4 | 5 | 6

export const PREMIUM_BAR_RATE = 1 / 65536
export const MELON_RATE = 0.01 - PREMIUM_BAR_RATE
export const MELON_PAYOUT = 8
export const MELON_STOCK_RATE = 0.10
export const PREMIUM_BAR_PAYOUT = 15
export const PREMIUM_BAR_STOCK_GAIN = 20

export interface SettingConfig {
  setting: SettingNumber
  selectionWeight: number // 初期選択率
  battleRate: number      // バトル継続率
  bellRate: number        // ベル確率 (全設定共通 65%)
  replayRate: number      // リプレイ確率
  cherryRate: number      // チェリー確率
  melonRate: number       // スイカ確率 (全設定共通 約1%)
  premiumBarRate: number  // プレミアムBAR確率 (全設定共通 1/65536)
}

export const SETTINGS: readonly SettingConfig[] = [
  { setting: 1, selectionWeight: 0.40, battleRate: 0.50, bellRate: 0.65, replayRate: 0.26, cherryRate: 0.08, melonRate: MELON_RATE, premiumBarRate: PREMIUM_BAR_RATE },
  { setting: 2, selectionWeight: 0.25, battleRate: 0.60, bellRate: 0.65, replayRate: 0.31, cherryRate: 0.03, melonRate: MELON_RATE, premiumBarRate: PREMIUM_BAR_RATE },
  { setting: 3, selectionWeight: 0.15, battleRate: 0.68, bellRate: 0.65, replayRate: 0.30, cherryRate: 0.04, melonRate: MELON_RATE, premiumBarRate: PREMIUM_BAR_RATE },
  { setting: 4, selectionWeight: 0.10, battleRate: 0.76, bellRate: 0.65, replayRate: 0.30, cherryRate: 0.04, melonRate: MELON_RATE, premiumBarRate: PREMIUM_BAR_RATE },
  { setting: 5, selectionWeight: 0.07, battleRate: 0.83, bellRate: 0.65, replayRate: 0.31, cherryRate: 0.03, melonRate: MELON_RATE, premiumBarRate: PREMIUM_BAR_RATE },
  { setting: 6, selectionWeight: 0.03, battleRate: 0.89, bellRate: 0.65, replayRate: 0.26, cherryRate: 0.08, melonRate: MELON_RATE, premiumBarRate: PREMIUM_BAR_RATE },
] as const

export const RATES = SETTINGS.map((s) => s.battleRate)
export const BELLS_TO_BATTLE = 8 // 8回ベルGETでBATTLE BONUSへ
export const BATTLE_PART_GAMES = 8 // バトルパートは全8ゲーム（8Gで1つの攻防）
export const BET_COST = 3
export const CREDIT_MAX = 50
export const BELL_PAYOUT = 12
export const CHERRY_PAYOUT = 8

export type CherryType = 'single' | 'double' | 'triple'

export const CHERRY_CONFIGS: Record<
  CherryType,
  {
    type: CherryType
    label: string
    weight: number
    stockRate: number
    payout: number
    reels: [SymbolId, SymbolId, SymbolId]
  }
> = {
  single: {
    type: 'single',
    label: '単チェリー',
    weight: 0.05,
    stockRate: 1.0,
    payout: CHERRY_PAYOUT,
    reels: ['cherry', 'bar', 'blank'],
  },
  double: {
    type: 'double',
    label: '2連チェリー',
    weight: 0.25,
    stockRate: 0.25,
    payout: CHERRY_PAYOUT,
    reels: ['cherry', 'cherry', 'blank'],
  },
  triple: {
    type: 'triple',
    label: '3連チェリー',
    weight: 0.70,
    stockRate: 0.05,
    payout: CHERRY_PAYOUT,
    reels: ['cherry', 'cherry', 'cherry'],
  },
}

export type SymbolId = 'seven' | 'bar' | 'bell' | 'replay' | 'melon' | 'cherry' | 'blank'

// 押し順ナビ: [最初に押すリール(0..2), 2番目に押すリール(0..2), 3番目に押すリール(0..2)]
export type NaviOrder = [number, number, number]
// 各リール(左:0, 中:1, 右:2)に表示するナビ番号(1, 2, 3)
export type NaviNumbers = [number, number, number]

export type SpinOutcome = {
  symbol: SymbolId
  reels: [SymbolId, SymbolId, SymbolId]
  payout: number
  isReplay: boolean
  naviOrder: NaviOrder
  naviNumbers: NaviNumbers
  cherryType?: CherryType
  stockGain: number
  barAim: boolean
}

export type BattlePattern =
  | 'defeat'       // 1. 本当に負ける
  | 'hero_attack'  // 2. 普通に主人公が攻撃をヒットさせる (低確率自力勝利)
  | 'ally_save'    // 3. 主人公劣勢に仲間の応援で危機を逃れる (仲間カットイン)
  | 'girl_revive'  // 4. 敵の攻撃をまともに貰い、一度は負けたように見せて可愛い女の子の応援で復活

export type BattlePhase =
  | 'fighting'          // バトル進行中 (1G..8G)
  | 'false_defeat'      // 敗北に見せかけた絶望の暗転・静止時間
  | 'revive_cutin'      // ヒロイン復活カットイン (逆転劇!)
  | 'ally_shoulder_tap' // カイ援軍・肩叩き（8G終了後の継続告知導入）
  | 'victory_reveal'    // 継続確定演出
  | 'defeat_reveal'     // 本当の敗北確定演出

// 後方互換性のため BattleResult は BattlePattern のエイリアス
export type BattleResult = BattlePattern
export type Scene = 'bonusSpin' | 'bonusGet' | 'ready' | 'lever' | 'spinning' | 'battleModeIntro' | 'battle' | 'battleResult' | 'finished'

export const SYMBOLS: Record<SymbolId, { label: string; color: string; name: string }> = {
  seven: { label: '7', color: 'ruby', name: '赤７' },
  bar: { label: 'BAR', color: 'dark', name: 'BAR' },
  bell: { label: 'BELL', color: 'gold', name: 'ベル' },
  replay: { label: 'REPLAY', color: 'cyan', name: 'リプレイ' },
  melon: { label: 'MELON', color: 'green', name: 'スイカ' },
  cherry: { label: 'CHERRY', color: 'ruby', name: 'チェリー' },
  blank: { label: '★', color: 'blue', name: 'スター' },
}

// 押し順パターン全6通り (0:左, 1:中, 2:右)
export const NAVI_PATTERNS: NaviOrder[] = [
  [0, 1, 2], // 1-2-3 (左 ➔ 中 ➔ 右)
  [0, 2, 1], // 1-3-2 (左 ➔ 右 ➔ 中)
  [1, 0, 2], // 2-1-3 (中 ➔ 左 ➔ 右)
  [1, 2, 0], // 2-3-1 (中 ➔ 右 ➔ 左)
  [2, 0, 1], // 3-1-2 (右 ➔ 左 ➔ 中)
  [2, 1, 0], // 3-2-1 (右 ➔ 中 ➔ 左)
]

/** 押し順から各リール上に表示するナビ番号(1, 2, 3)を算出 */
export function getNaviNumbers(order: NaviOrder): NaviNumbers {
  const nums: [number, number, number] = [0, 0, 0]
  order.forEach((reelIdx, step) => {
    nums[reelIdx] = step + 1
  })
  return nums
}

// 本格21コマリール帯 (ベル・リプ・赤7・BAR・チェリー・スイカ・スター)
export const REEL_STRIP: SymbolId[] = [
  'seven', 'bar', 'bell', 'replay', 'cherry', 'bell', 'melon',
  'bar', 'seven', 'replay', 'bell', 'cherry', 'melon', 'bar',
  'bell', 'replay', 'seven', 'cherry', 'melon', 'bell', 'blank',
]

/** Get 3 visible symbols for a reel (top, center, bottom) given the center symbol */
export function getReelWindow(centerSymbol: SymbolId, offset = 0): [SymbolId, SymbolId, SymbolId] {
  const indices: number[] = []
  REEL_STRIP.forEach((s, idx) => {
    if (s === centerSymbol) indices.push(idx)
  })
  const baseIdx = indices[offset % indices.length] ?? 0
  const topIdx = (baseIdx - 1 + REEL_STRIP.length) % REEL_STRIP.length
  const btmIdx = (baseIdx + 1) % REEL_STRIP.length
  return [REEL_STRIP[topIdx]!, REEL_STRIP[baseIdx]!, REEL_STRIP[btmIdx]!]
}

export type RngFn = () => number

function randomItem<T>(items: readonly T[], rng: RngFn = Math.random): T {
  const idx = Math.min(items.length - 1, Math.floor(rng() * items.length))
  return items[idx]!
}

/**
 * 設定1〜6を初期選択率の重み付き抽選で決定する (戻り値: 0..5)
 */
export function drawSettingIndex(rng: RngFn = Math.random): number {
  const r = rng()
  let acc = 0
  for (let i = 0; i < SETTINGS.length; i++) {
    acc += SETTINGS[i]!.selectionWeight
    if (r < acc) return i
  }
  return SETTINGS.length - 1
}

/**
 * チェリーの種類を重み付き(単5% / 2連25% / 3連70%)で抽選する
 */
export function drawCherryType(rng: RngFn = Math.random): CherryType {
  const r = rng()
  if (r < CHERRY_CONFIGS.single.weight) return 'single'
  if (r < CHERRY_CONFIGS.single.weight + CHERRY_CONFIGS.double.weight) return 'double'
  return 'triple'
}

/**
 * チェリーの種類に応じたストック獲得抽選
 */
export function drawCherryStock(cherryType: CherryType, rng: RngFn = Math.random): boolean {
  const rate = CHERRY_CONFIGS[cherryType].stockRate
  return rng() < rate
}

/**
 * スイカ成立時のストック獲得抽選 (10%)
 */
export function drawMelonStock(rng: RngFn = Math.random): boolean {
  return rng() < MELON_STOCK_RATE
}

/**
 * 内部成立役ごとの「BARを狙え！」演出発生率
 */
export const BAR_AIM_RATES: Record<'bell' | 'replay' | 'cherry' | 'melon' | 'bar', number> = {
  bell: 0,
  replay: 0,
  cherry: 0.01,
  melon: 0.10,
  bar: 1.0,
}

/**
 * 「BARを狙え！」演出発生抽選（内部成立役とは独立した演出責務）
 */
export function drawBarAimCutin(symbol: SymbolId, rng: RngFn = Math.random): boolean {
  const rate =
    symbol === 'cherry'
      ? BAR_AIM_RATES.cherry
      : symbol === 'melon'
        ? BAR_AIM_RATES.melon
        : symbol === 'bar'
          ? BAR_AIM_RATES.bar
          : 0
  if (rate <= 0) return false
  if (rate >= 1) return true
  return rng() < rate
}

export interface MedalPayoutResult {
  nextCredit: number
  toCredit: number
  toTray: number
}

/**
 * クレジット(上限50枚)と下皿払い出しの振り分け計算
 */
export function calculateMedalPayout(
  currentCredit: number,
  payoutAmount: number,
  creditMax = CREDIT_MAX
): MedalPayoutResult {
  const space = Math.max(0, creditMax - currentCredit)
  const toCredit = Math.min(payoutAmount, space)
  const toTray = payoutAmount - toCredit
  return {
    nextCredit: currentCredit + toCredit,
    toCredit,
    toTray,
  }
}

export interface SpinOutcomeOptions {
  forcedStockWon?: boolean
  forcedBarAim?: boolean
}

export interface SpinRoleDefinition {
  id: string
  label: string
  symbol: SymbolId
  buildOutcome: (
    naviOrder: NaviOrder,
    naviNumbers: NaviNumbers,
    rng: RngFn,
    options?: SpinOutcomeOptions
  ) => SpinOutcome
}

const BASE_SPIN_ROLES: readonly SpinRoleDefinition[] = [
  {
    id: 'bell',
    label: SYMBOLS.bell.name,
    symbol: 'bell',
    buildOutcome: (naviOrder, naviNumbers, rng, options) => ({
      symbol: 'bell',
      reels: ['bell', 'bell', 'bell'],
      payout: BELL_PAYOUT,
      isReplay: false,
      naviOrder,
      naviNumbers,
      stockGain: 0,
      barAim: options?.forcedBarAim ?? drawBarAimCutin('bell', rng),
    }),
  },
  {
    id: 'replay',
    label: SYMBOLS.replay.name,
    symbol: 'replay',
    buildOutcome: (naviOrder, naviNumbers, rng, options) => ({
      symbol: 'replay',
      reels: ['replay', 'replay', 'replay'],
      payout: 0,
      isReplay: true,
      naviOrder,
      naviNumbers,
      stockGain: 0,
      barAim: options?.forcedBarAim ?? drawBarAimCutin('replay', rng),
    }),
  },
]

function buildCherrySpinRoles(): SpinRoleDefinition[] {
  return (Object.values(CHERRY_CONFIGS) as Array<(typeof CHERRY_CONFIGS)[CherryType]>).map((cherryCfg) => ({
    id: `cherry:${cherryCfg.type}`,
    label: cherryCfg.label,
    symbol: 'cherry' as const,
    buildOutcome: (naviOrder, naviNumbers, rng, options) => {
      const stockWon =
        options?.forcedStockWon !== undefined
          ? options.forcedStockWon
          : drawCherryStock(cherryCfg.type, rng)
      return {
        symbol: 'cherry',
        reels: cherryCfg.reels,
        payout: cherryCfg.payout,
        isReplay: false,
        naviOrder,
        naviNumbers,
        cherryType: cherryCfg.type,
        stockGain: stockWon ? 1 : 0,
        barAim: options?.forcedBarAim ?? drawBarAimCutin('cherry', rng),
      }
    },
  }))
}

const SPECIAL_SPIN_ROLES: readonly SpinRoleDefinition[] = [
  {
    id: 'melon',
    label: SYMBOLS.melon.name,
    symbol: 'melon',
    buildOutcome: (naviOrder, naviNumbers, rng, options) => {
      const stockWon =
        options?.forcedStockWon !== undefined ? options.forcedStockWon : drawMelonStock(rng)
      return {
        symbol: 'melon',
        reels: ['melon', 'melon', 'melon'],
        payout: MELON_PAYOUT,
        isReplay: false,
        naviOrder,
        naviNumbers,
        stockGain: stockWon ? 1 : 0,
        barAim: options?.forcedBarAim ?? drawBarAimCutin('melon', rng),
      }
    },
  },
  {
    id: 'premium_bar',
    label: `プレミアムBAR (${PREMIUM_BAR_STOCK_GAIN}ストック)`,
    symbol: 'bar',
    buildOutcome: (naviOrder, naviNumbers, rng, options) => ({
      symbol: 'bar',
      reels: ['bar', 'bar', 'bar'],
      payout: PREMIUM_BAR_PAYOUT,
      isReplay: false,
      naviOrder,
      naviNumbers,
      stockGain: PREMIUM_BAR_STOCK_GAIN,
      barAim: options?.forcedBarAim ?? drawBarAimCutin('bar', rng),
    }),
  },
]

/** 実際に抽選可能な成立役一覧（通常役 + チェリー種別 + スイカ + プレミアムBAR） */
export const SPIN_ROLES: readonly SpinRoleDefinition[] = [
  ...BASE_SPIN_ROLES,
  ...buildCherrySpinRoles(),
  ...SPECIAL_SPIN_ROLES,
]

/**
 * 指定した成立役IDからスピン結果を生成する
 */
export function createSpinOutcome(
  roleId: string,
  rng: RngFn = Math.random,
  presetNavi?: { naviOrder: NaviOrder; naviNumbers: NaviNumbers },
  options?: SpinOutcomeOptions
): SpinOutcome {
  const role = SPIN_ROLES.find((r) => r.id === roleId)
  if (!role) {
    throw new Error(`Unknown spin role: ${roleId}`)
  }
  const naviOrder = presetNavi?.naviOrder ?? randomItem(NAVI_PATTERNS, rng)
  const naviNumbers = presetNavi?.naviNumbers ?? getNaviNumbers(naviOrder)
  return role.buildOutcome(naviOrder, naviNumbers, rng, options)
}

/**
 * スピン抽選
 * - 押し順ナビはランダム (全6パターン)
 * - 設定ごとの確率テーブルに従い「ベル」(12枚) /「リプレイ」(再遊技) /「チェリー」(8枚) /「スイカ」(8枚) /「プレミアムBAR」(15枚) を抽選
 * - forcedRoleId 指定時はその役を強制成立させる
 */
export function drawSpin(
  settingIndex = 0,
  rng: RngFn = Math.random,
  forcedRoleId: string | null = null,
  options?: SpinOutcomeOptions
): SpinOutcome {
  const naviOrder = randomItem(NAVI_PATTERNS, rng)
  const naviNumbers = getNaviNumbers(naviOrder)

  if (forcedRoleId !== null) {
    return createSpinOutcome(forcedRoleId, rng, { naviOrder, naviNumbers }, options)
  }

  const cfg = SETTINGS[settingIndex] ?? SETTINGS[0]!
  const r = rng()

  if (r < cfg.bellRate) {
    return createSpinOutcome('bell', rng, { naviOrder, naviNumbers }, options)
  }

  if (r < cfg.bellRate + cfg.replayRate) {
    return createSpinOutcome('replay', rng, { naviOrder, naviNumbers }, options)
  }

  if (r < cfg.bellRate + cfg.replayRate + cfg.cherryRate) {
    const cherryType = drawCherryType(rng)
    return createSpinOutcome(`cherry:${cherryType}`, rng, { naviOrder, naviNumbers }, options)
  }

  if (r < cfg.bellRate + cfg.replayRate + cfg.cherryRate + cfg.melonRate) {
    return createSpinOutcome('melon', rng, { naviOrder, naviNumbers }, options)
  }

  return createSpinOutcome('premium_bar', rng, { naviOrder, naviNumbers }, options)
}

/**
 * 押し順ミス時の出目（中段に役が揃わないバラケ目）
 */
export function getMissReels(targetRole: SymbolId): [SymbolId, SymbolId, SymbolId] {
  if (targetRole === 'bell') {
    return ['bell', 'bar', 'seven']
  }
  if (targetRole === 'cherry') {
    return ['bar', 'melon', 'blank']
  }
  return ['replay', 'seven', 'blank']
}

/**
 * 継続時のバトル演出パターン抽選（自力勝利10%, 仲間応援45%, ヒロイン復活45%）
 */
export function drawWinPattern(rng: RngFn = Math.random): Exclude<BattlePattern, 'defeat'> {
  const rand = rng()
  if (rand < 0.10) {
    return 'hero_attack'
  }
  if (rand < 0.55) {
    return 'ally_save'
  }
  return 'girl_revive'
}

export interface BattleResolution {
  pattern: BattleResult
  usedStock: boolean
  nextStockCount: number
}

/**
 * ストックを考慮したバトル継続抽選
 * - forcedPattern 指定時はそのシナリオを強制し、ストックは消費しない
 * - 継続当選時: ストックは消費しない
 * - 敗北当選時: ストックが1以上あれば1個消費して既存の継続演出で救済継続、0個なら敗北確定
 */
export function resolveBattleWithStock(
  rate: number,
  stockCount: number,
  rng: RngFn = Math.random,
  forcedPattern: BattlePattern | null = null
): BattleResolution {
  if (forcedPattern !== null) {
    return {
      pattern: forcedPattern,
      usedStock: false,
      nextStockCount: stockCount,
    }
  }

  if (rng() < rate) {
    return {
      pattern: drawWinPattern(rng),
      usedStock: false,
      nextStockCount: stockCount,
    }
  }

  if (stockCount > 0) {
    return {
      pattern: drawWinPattern(rng),
      usedStock: true,
      nextStockCount: stockCount - 1,
    }
  }

  return {
    pattern: 'defeat',
    usedStock: false,
    nextStockCount: 0,
  }
}

export const BATTLE_MESSAGES: Record<BattleResult, { helper: string; icon: string }> = {
  hero_attack: {
    helper: '主人公先制（継続）',
    icon: '👊',
  },
  ally_save: {
    helper: 'カイ援軍（継続）',
    icon: '🔥',
  },
  girl_revive: {
    helper: 'セリーヌ復活（継続）',
    icon: '✨',
  },
  defeat: {
    helper: '敗北（GAME OVER）',
    icon: '💀',
  },
}

export interface BattleScenarioOption {
  id: BattlePattern
  label: string
}

/** 実際に抽選可能なバトルシナリオ一覧（BATTLE_MESSAGES から自動生成） */
export const BATTLE_SCENARIOS: readonly BattleScenarioOption[] = (
  Object.entries(BATTLE_MESSAGES) as Array<[BattlePattern, (typeof BATTLE_MESSAGES)[BattlePattern]]>
).map(([id, msg]) => ({
  id,
  label: `${msg.icon} ${msg.helper}`,
}))

export type DebugBattleScenarioId = BattlePattern | 'victory_gameover'

export interface DebugBattleScenarioOption {
  id: DebugBattleScenarioId
  label: string
}

/** デバッグ指定用のバトルシナリオ一覧（20ROUND以上のGAME OVERを含む） */
export const DEBUG_BATTLE_SCENARIOS: readonly DebugBattleScenarioOption[] = [
  ...BATTLE_SCENARIOS,
  {
    id: 'victory_gameover',
    label: '🏆 勝利（20ROUND以上のGAME OVER）',
  },
]

/** デバッグのバトル演出指定を、実際のバトルパターンと特別終了フラグへ変換する */
export function resolveDebugBattleSelection(selection: DebugBattleScenarioId | null): {
  forcedPattern: BattlePattern | null
  isSpecialEnemyDefeat: boolean
} {
  if (selection === null) {
    return { forcedPattern: null, isSpecialEnemyDefeat: false }
  }
  if (selection === 'victory_gameover') {
    return { forcedPattern: 'hero_attack', isSpecialEnemyDefeat: true }
  }
  return { forcedPattern: selection, isSpecialEnemyDefeat: false }
}

export type TopLampMode =
  | 'rainbow'
  | 'battle'
  | 'payout'
  | 'payout-replay'
  | 'payout-cherry'
  | 'payout-melon'
  | 'spin'
  | 'lever'
  | 'ready'

export interface TopLampStateInput {
  scene: string
  payout: number
  spinSymbol: SymbolId | null
  litRole: 'bell' | 'replay' | null
  showPremiumBarEffect: boolean
  winLamp: boolean
  battle: BattleResult | null
}

/**
 * 筐体上下ランプ（トップランプ・下部サイドLED・拡張サイドフレームLED）の点灯モードを決定する。
 * - 通常時（ready / lever / spin）は小役の色（黄・青・赤・緑）と被らない紫・白銀系を使用する。
 * - 小役獲得時は役ごとに固有色（ベル=黄 / リプレイ=青 / チェリー=赤 / スイカ=緑 / BAR揃い=虹）で発光する。
 */
export function resolveTopLampMode(input: TopLampStateInput): TopLampMode {
  const { scene, payout, spinSymbol, litRole, showPremiumBarEffect, winLamp, battle } = input
  if (
    scene === 'bonusGet' ||
    scene === 'bonusSpin' ||
    showPremiumBarEffect ||
    winLamp ||
    (scene === 'battleResult' && battle !== null && battle !== 'defeat') ||
    (payout > 0 && spinSymbol === 'bar')
  ) {
    return 'rainbow'
  }
  if (scene === 'battle' || scene === 'battleModeIntro') {
    return 'battle'
  }
  if (payout > 0) {
    if (spinSymbol === 'cherry') return 'payout-cherry'
    if (spinSymbol === 'melon') return 'payout-melon'
    return 'payout'
  }
  if (litRole === 'replay') {
    return 'payout-replay'
  }
  if (scene === 'spinning') {
    return 'spin'
  }
  if (scene === 'lever') {
    return 'lever'
  }
  return 'ready'
}
