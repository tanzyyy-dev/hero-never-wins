/**
 * 筐体のレスポンシブスケーリング計算（純粋関数）。
 *
 * - 仕様: docs/cabinet-responsive-layout.md（スマホ縦画面の余白ゼロ表示・bottom-compact・サイドフレーム）
 * - 呼び出し元: src/main.tsx（resize / visualViewport / ResizeObserver で再計算）
 * - CSS: src/style.css「MOBILE PORTRAIT EXPANDED SIDE WINGS」「RESPONSIVE DESIGN」セクション
 * - テスト: src/layout/cabinetLayout.test.ts（npm run test:layout）
 */
export const CABINET_BASE_WIDTH = 440
export const CABINET_BASE_HEIGHT = 880
export const CABINET_COMPACT_MIN_HEIGHT = 680 // 下部トレー非表示 & 下パネル縮小時の最小論理高さ
export const CABINET_MAX_STRETCH_HEIGHT = 932 // 超縦長スマホで下パネルが最大(190px)まで伸びる上限論理高さ
export const MIN_CABINET_SCALE = 0.52
export const DESKTOP_MIN_CABINET_SCALE = 0.62
export const MOBILE_PORTRAIT_MAX_WIDTH = 767

export interface CabinetLayout {
  scale: number
  isLandscapeCompact: boolean
  isMobilePortrait: boolean
  isBottomCompact: boolean
  needsScroll: boolean
  sideSpace: number
  stageWidth: number
  stageHeight: number
  cabinetHeight: number
}

/**
 * 利用可能な表示領域から筐体レイアウトを求める。
 * 幅・高さを省略した場合のみ window / visualViewport を参照する（Node テストでは両方指定する）。
 */
export function computeCabinetLayout(viewportWidth?: number, viewportHeight?: number): CabinetLayout {
  if (viewportWidth !== undefined && viewportHeight !== undefined) {
    return computeCabinetLayoutForViewport(viewportWidth, viewportHeight)
  }
  if (typeof window === 'undefined') {
    return {
      scale: 1,
      isLandscapeCompact: false,
      isMobilePortrait: false,
      isBottomCompact: false,
      needsScroll: false,
      sideSpace: 0,
      stageWidth: CABINET_BASE_WIDTH,
      stageHeight: CABINET_BASE_HEIGHT,
      cabinetHeight: CABINET_BASE_HEIGHT,
    }
  }
  const vv = window.visualViewport
  const vw = viewportWidth ?? (vv ? vv.width : window.innerWidth)
  const vh = viewportHeight ?? (vv ? vv.height : window.innerHeight)
  return computeCabinetLayoutForViewport(vw, vh)
}

function computeCabinetLayoutForViewport(vw: number, vh: number): CabinetLayout {
  // スマホ横画面など高さが極端に低い場合: スケールせず CSS 側の横画面レイアウトに任せる
  if (vw > vh && vh <= 550) {
    return {
      scale: 1,
      isLandscapeCompact: true,
      isMobilePortrait: false,
      isBottomCompact: false,
      needsScroll: false,
      sideSpace: 0,
      stageWidth: CABINET_BASE_WIDTH,
      stageHeight: Math.round(vh),
      cabinetHeight: CABINET_BASE_HEIGHT,
    }
  }

  // スマホ・狭幅縦画面: 縦横スクロールを出さず1画面に収め、余白が出たらサイドフレームで埋める
  if (vw <= MOBILE_PORTRAIT_MAX_WIDTH) {
    const widthScale = Math.min(1, vw / CABINET_BASE_WIDTH)
    const availLogicalHeight = widthScale > 0 ? vh / widthScale : CABINET_BASE_HEIGHT
    const isBottomCompact = availLogicalHeight < 840

    let scale = widthScale
    let cabinetHeight = CABINET_BASE_HEIGHT

    if (!isBottomCompact) {
      cabinetHeight = Math.round(Math.min(CABINET_MAX_STRETCH_HEIGHT, availLogicalHeight))
      scale = Math.min(widthScale, vh / cabinetHeight)
    } else if (availLogicalHeight >= CABINET_COMPACT_MIN_HEIGHT) {
      cabinetHeight = Math.round(availLogicalHeight)
      scale = widthScale
    } else {
      cabinetHeight = CABINET_COMPACT_MIN_HEIGHT
      scale = Math.max(MIN_CABINET_SCALE, vh / cabinetHeight)
    }

    const stageWidth = Math.round(CABINET_BASE_WIDTH * scale)
    const stageHeight = Math.min(Math.round(vh), Math.round(cabinetHeight * scale))
    const sideSpace = Math.max(0, Math.floor((vw - stageWidth) / 2))

    return {
      scale,
      isLandscapeCompact: false,
      isMobilePortrait: true,
      isBottomCompact,
      needsScroll: false,
      sideSpace,
      stageWidth,
      stageHeight,
      cabinetHeight,
    }
  }

  // PC・タブレット: 従来通り中央配置＋スケール制限
  const rawScale = Math.min(1, vw / CABINET_BASE_WIDTH, vh / CABINET_BASE_HEIGHT)
  const scale = Math.max(DESKTOP_MIN_CABINET_SCALE, rawScale)
  const needsScroll = CABINET_BASE_HEIGHT * scale > vh + 1
  const stageWidth = Math.round(CABINET_BASE_WIDTH * scale)
  const stageHeight = Math.round(CABINET_BASE_HEIGHT * scale)
  const sideSpace = Math.floor((vw - stageWidth) / 2)
  return {
    scale,
    isLandscapeCompact: false,
    isMobilePortrait: false,
    isBottomCompact: false,
    needsScroll,
    sideSpace,
    stageWidth,
    stageHeight,
    cabinetHeight: CABINET_BASE_HEIGHT,
  }
}
