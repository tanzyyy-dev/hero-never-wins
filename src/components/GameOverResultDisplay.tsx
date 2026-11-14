import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { RATES } from '../engine'
import './GameOverResultDisplay.css'

type GameOverResultDisplayProps = {
  rateIndex: number
  totalStockEarned?: number
  round: number
  totalMedals: number
}

const ARENA_BG_SRC = '/battle_intro_arena.jpg'

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number
) {
  const scale = Math.max(width / img.width, height / img.height)
  const drawW = img.width * scale
  const drawH = img.height * scale
  const dx = (width - drawW) / 2
  const dy = (height - drawH) / 2
  ctx.drawImage(img, dx, dy, drawW, drawH)
}

function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fillStyle: string | CanvasGradient,
  strokeWidth = 6,
  shadowColor = 'rgba(0, 0, 0, 0.9)',
  shadowBlur = 10
) {
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.shadowColor = shadowColor
  ctx.shadowBlur = shadowBlur
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 4
  ctx.strokeStyle = '#070506'
  ctx.lineWidth = strokeWidth
  ctx.strokeText(text, x, y)
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.fillStyle = fillStyle
  ctx.fillText(text, x, y)
  ctx.restore()
}

async function generateResultImageBlob(
  rateIndex: number,
  totalStockEarned: number,
  round: number,
  totalMedals: number
): Promise<Blob | null> {
  const width = 1200
  const height = 675
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const ratePercent = Math.round((RATES[rateIndex] ?? RATES[0]) * 100)
  const settingNumber = rateIndex + 1
  const settingLabel = `設定${settingNumber} (${ratePercent}%)`

  // 1. 背景: 雑魚戦闘技場画像（失敗時は暗色グラデーションへフォールバック）
  const bgImg = await loadImage(ARENA_BG_SRC)
  if (bgImg) {
    ctx.save()
    ctx.filter = 'brightness(0.66) contrast(1.12) saturate(0.75)'
    drawCoverImage(ctx, bgImg, width, height)
    ctx.restore()
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height)
    bgGrad.addColorStop(0, '#140c14')
    bgGrad.addColorStop(0.5, '#121824')
    bgGrad.addColorStop(1, '#08090f')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)
  }

  // 2. 暗いビネットと半透明グラデーション（廃墟の余韻と視認性確保）
  const verticalGrad = ctx.createLinearGradient(0, 0, 0, height)
  verticalGrad.addColorStop(0, 'rgba(4, 6, 12, 0.56)')
  verticalGrad.addColorStop(0.45, 'rgba(8, 6, 10, 0.28)')
  verticalGrad.addColorStop(1, 'rgba(4, 5, 10, 0.72)')
  ctx.fillStyle = verticalGrad
  ctx.fillRect(0, 0, width, height)

  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.46,
    140,
    width * 0.5,
    height * 0.5,
    width * 0.68
  )
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(2, 3, 8, 0.72)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)

  const emberGlow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.36,
    20,
    width * 0.5,
    height * 0.36,
    380
  )
  emberGlow.addColorStop(0, 'rgba(185, 28, 28, 0.22)')
  emberGlow.addColorStop(1, 'rgba(185, 28, 28, 0)')
  ctx.fillStyle = emberGlow
  ctx.fillRect(0, 0, width, height)

  // 微細な走査線
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)'
  for (let y = 0; y < height; y += 3) {
    ctx.fillRect(0, y, width, 1)
  }

  // 3. 右上: 設定表示（フレームレス）
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '800 24px "Hiragino Sans", "Noto Sans JP", sans-serif'
  let settingFill: string | CanvasGradient = '#cbd5e1'
  if (settingNumber === 6) {
    const rainbow = ctx.createLinearGradient(width - 240, 0, width - 48, 0)
    rainbow.addColorStop(0, '#f472b6')
    rainbow.addColorStop(0.5, '#fde047')
    rainbow.addColorStop(1, '#38bdf8')
    settingFill = rainbow
  } else if (settingNumber >= 4) {
    settingFill = '#fde68a'
  }
  drawOutlinedText(ctx, settingLabel, width - 48, 56, settingFill, 5)

  // 4. 中央: DEFEAT CONFIRMED & GAME OVER（主役）
  ctx.textAlign = 'center'
  ctx.font = '900 20px "Impact", "Arial Black", "Hiragino Sans", sans-serif'
  drawOutlinedText(ctx, 'DEFEAT CONFIRMED', width / 2, 162, '#fca5a5', 4, 'rgba(220, 38, 38, 0.6)', 12)

  const titleGrad = ctx.createLinearGradient(0, 175, 0, 290)
  titleGrad.addColorStop(0, '#ffffff')
  titleGrad.addColorStop(0.4, '#e2e8f0')
  titleGrad.addColorStop(0.72, '#fca5a5')
  titleGrad.addColorStop(1, '#991b1b')
  ctx.font = 'italic 900 118px "Impact", "Arial Black", "Hiragino Kaku Gothic ProN", sans-serif'
  drawOutlinedText(
    ctx,
    'GAME OVER',
    width / 2,
    274,
    titleGrad,
    12,
    'rgba(220, 38, 38, 0.65)',
    22
  )

  // 5. 次点: ROUND・STOCK（横並び・フレームレス）
  ctx.textAlign = 'center'
  const subY = 358
  const leftAnchor = width / 2 - 140
  const rightAnchor = width / 2 + 140

  // ROUND: 数字をラベルより大きく
  ctx.font = '900 44px "Impact", "Arial Black", sans-serif'
  const roundNumStr = `${round}`
  const roundNumW = ctx.measureText(roundNumStr).width
  ctx.font = '800 22px "Impact", "Arial Black", sans-serif'
  const roundLblStr = ' ROUND'
  const roundLblW = ctx.measureText(roundLblStr).width
  const roundStartX = leftAnchor - (roundNumW + roundLblW) / 2

  ctx.textAlign = 'left'
  ctx.font = '900 44px "Impact", "Arial Black", sans-serif'
  drawOutlinedText(ctx, roundNumStr, roundStartX, subY, '#f8fafc', 6)
  ctx.font = '800 22px "Impact", "Arial Black", sans-serif'
  drawOutlinedText(ctx, roundLblStr, roundStartX + roundNumW, subY - 2, '#cbd5e1', 5)

  // STOCK: ラベル + 数字
  ctx.font = '800 22px "Impact", "Arial Black", sans-serif'
  const stockLblStr = 'STOCK '
  const stockLblW = ctx.measureText(stockLblStr).width
  ctx.font = '900 44px "Impact", "Arial Black", sans-serif'
  const stockNumStr = `${totalStockEarned}`
  const stockNumW = ctx.measureText(stockNumStr).width
  const stockStartX = rightAnchor - (stockLblW + stockNumW) / 2

  ctx.font = '800 22px "Impact", "Arial Black", sans-serif'
  drawOutlinedText(ctx, stockLblStr, stockStartX, subY - 2, '#cbd5e1', 5)
  ctx.font = '900 44px "Impact", "Arial Black", sans-serif'
  drawOutlinedText(ctx, stockNumStr, stockStartX + stockLblW, subY, '#fde68a', 6)

  // 6. 最優先: TOTAL獲得枚数（下部中央・ゴールドメタリック）
  ctx.textAlign = 'center'
  ctx.font = '900 22px "Impact", "Arial Black", sans-serif'
  drawOutlinedText(ctx, 'TOTAL GET', width / 2, 446, '#fde68a', 5, 'rgba(245, 158, 11, 0.5)', 10)

  const totalNumStr = `${totalMedals}`
  const totalUnitStr = ' 枚'
  ctx.font = '900 72px "Impact", "Arial Black", "Hiragino Kaku Gothic ProN", sans-serif'
  const numW = ctx.measureText(totalNumStr).width
  ctx.font = '900 52px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif'
  const unitW = ctx.measureText(totalUnitStr).width

  const totalStartX = width / 2 - (numW + unitW) / 2
  const goldGrad = ctx.createLinearGradient(0, 466, 0, 540)
  goldGrad.addColorStop(0, '#ffffff')
  goldGrad.addColorStop(0.38, '#ffe666')
  goldGrad.addColorStop(0.75, '#ff9900')
  goldGrad.addColorStop(1, '#b85000')

  ctx.textAlign = 'left'
  ctx.font = '900 72px "Impact", "Arial Black", "Hiragino Kaku Gothic ProN", sans-serif'
  drawOutlinedText(
    ctx,
    totalNumStr,
    totalStartX,
    534,
    goldGrad,
    9,
    'rgba(255, 190, 0, 0.55)',
    16
  )
  ctx.font = '900 52px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif'
  drawOutlinedText(ctx, totalUnitStr, totalStartX + numW, 532, goldGrad, 7, 'rgba(255, 190, 0, 0.45)', 12)

  // 7. フッター: 左下に日時、右下に装飾されたゲームタイトルロゴ
  const now = new Date()
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  ctx.textAlign = 'left'
  ctx.font = '700 18px monospace'
  drawOutlinedText(ctx, dateStr, 48, height - 34, 'rgba(203, 213, 225, 0.85)', 4)

  // 右下ゲームタイトル: メタリックグラデーション＋英語サブタイトル＋装飾ライン
  ctx.save()
  ctx.textAlign = 'right'
  const titleX = width - 48
  const titleY = height - 32

  // 英語サブタイトル
  ctx.font = '900 12px "Impact", "Arial Black", sans-serif'
  drawOutlinedText(
    ctx,
    'PACHISLOT  //  HERO NEVER WINS',
    titleX,
    titleY - 34,
    '#fca5a5',
    3,
    'rgba(220, 38, 38, 0.55)',
    8
  )

  // 装飾ゴールドライン
  const lineGrad = ctx.createLinearGradient(titleX - 310, 0, titleX, 0)
  lineGrad.addColorStop(0, 'rgba(251, 191, 36, 0)')
  lineGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.85)')
  lineGrad.addColorStop(1, 'rgba(255, 255, 255, 0.95)')
  ctx.strokeStyle = lineGrad
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(titleX - 310, titleY - 26)
  ctx.lineTo(titleX, titleY - 26)
  ctx.stroke()

  // メインタイトル文字（2段グラデーション＋金縁グロー）
  const logoGrad = ctx.createLinearGradient(0, titleY - 24, 0, titleY + 4)
  logoGrad.addColorStop(0, '#ffffff')
  logoGrad.addColorStop(0.42, '#fde68a')
  logoGrad.addColorStop(0.78, '#f59e0b')
  logoGrad.addColorStop(1, '#b45309')
  ctx.font = 'italic 900 26px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif'
  drawOutlinedText(
    ctx,
    '主人公なのにやけに勝てない',
    titleX,
    titleY,
    logoGrad,
    6,
    'rgba(245, 158, 11, 0.55)',
    14
  )
  ctx.restore()

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob)
    }, 'image/png')
  })
}

export function GameOverResultDisplay({
  rateIndex,
  totalStockEarned = 0,
  round,
  totalMedals,
}: GameOverResultDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const [displayMedals, setDisplayMedals] = useState(() =>
    prefersReducedMotion ? totalMedals : 0
  )

  const ratePercent = Math.round((RATES[rateIndex] ?? RATES[0]) * 100)
  const settingNumber = rateIndex + 1

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayMedals(totalMedals)
      return
    }

    setDisplayMedals(0)
    const counter = { val: 0 }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      // 0.0〜0.4秒: 暗転から闘技場背景が浮かび上がる
      tl.fromTo(
        '.gameover-intro-blackout',
        { opacity: 1 },
        { opacity: 0, duration: 0.4, ease: 'power2.out' },
        0
      )
      tl.fromTo(
        '.gameover-arena-bg',
        { scale: 1.07, filter: 'brightness(0.32) contrast(1.1) saturate(0.6)' },
        { scale: 1.01, filter: 'brightness(0.68) contrast(1.1) saturate(0.75)', duration: 0.45, ease: 'power2.out' },
        0
      )

      // 0.3〜0.8秒: GAME OVER タイトルが拡大から収束し、一瞬強く発光して落ち着く
      tl.fromTo(
        '.gameover-kicker',
        { opacity: 0, y: -6 },
        { opacity: 0.9, y: 0, duration: 0.35, ease: 'power2.out' },
        0.3
      )
      tl.fromTo(
        '.gameover-main-title',
        {
          scale: 1.48,
          opacity: 0,
          filter:
            'brightness(2.4) drop-shadow(0 3px 0 #140404) drop-shadow(0 0 24px rgba(255, 90, 90, 0.95))',
        },
        {
          scale: 1,
          opacity: 1,
          filter:
            'brightness(1.35) drop-shadow(0 3px 0 #140404) drop-shadow(0 0 18px rgba(239, 68, 68, 0.85))',
          duration: 0.32,
          ease: 'power3.out',
        },
        0.3
      )
      tl.to(
        '.gameover-main-title',
        {
          filter:
            'brightness(1) drop-shadow(0 3px 0 #140404) drop-shadow(0 0 10px rgba(220, 38, 38, 0.55))',
          duration: 0.22,
          ease: 'power2.out',
        },
        0.62
      )

      // 0.8〜1.2秒: ROUND・STOCK と設定表示
      tl.fromTo(
        '.gameover-substats-row',
        { opacity: 0, y: 10, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power2.out' },
        0.8
      )
      tl.fromTo(
        '.gameover-setting-hud',
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'power2.out' },
        0.85
      )

      // 1.2〜2.0秒: TOTAL獲得枚数フェードイン＆0からカウントアップ
      tl.fromTo(
        '.gameover-total-group',
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' },
        1.2
      )
      tl.to(
        counter,
        {
          val: totalMedals,
          duration: 0.78,
          ease: 'power2.out',
          onUpdate: () => {
            setDisplayMedals(Math.round(counter.val))
          },
          onComplete: () => {
            setDisplayMedals(totalMedals)
          },
        },
        1.2
      )
      // カウントアップ終了時に金色のグローを一瞬強めて静止状態へ
      tl.to(
        '.gameover-total-value',
        {
          filter:
            'brightness(1.45) drop-shadow(0 3px 0 #2a0a00) drop-shadow(0 0 18px rgba(255, 208, 40, 0.95))',
          duration: 0.14,
          ease: 'power2.out',
        },
        1.96
      )
      tl.to(
        '.gameover-total-value',
        {
          filter:
            'brightness(1) drop-shadow(0 3px 0 #2a0a00) drop-shadow(0 0 10px rgba(255, 190, 0, 0.55))',
          duration: 0.25,
          ease: 'power2.out',
        },
        2.1
      )

      // SNAP DL操作表示
      tl.fromTo(
        '.gameover-snap-btn',
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: 'power2.out' },
        1.45
      )
    }, containerRef)

    return () => ctx.revert()
  }, [totalMedals, prefersReducedMotion])

  const handleDownloadSnap = async (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    if (isCapturing) return
    setIsCapturing(true)

    try {
      const blob = await generateResultImageBlob(rateIndex, totalStockEarned, round, totalMedals)
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `hero-never-wins-r${round}-${totalMedals}medals.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        setHasSaved(true)
      }
    } finally {
      setTimeout(() => setIsCapturing(false), 360)
    }
  }

  return (
    <div ref={containerRef} className="gameover-display-container">
      <img
        src={ARENA_BG_SRC}
        alt=""
        className="gameover-arena-bg"
        aria-hidden="true"
      />
      <div className="gameover-arena-vignette" aria-hidden="true" />
      <div className="gameover-arena-dust" aria-hidden="true" />
      <div className="gameover-intro-blackout" aria-hidden="true" />

      <div className="zako-scanlines" aria-hidden="true" />
      <div className="zako-glass-glare" aria-hidden="true" />

      {isCapturing && <div className="snap-shutter-flash" />}

      <div className="gameover-content-layer">
        {/* 補助情報: 設定（右上・フレームレス） */}
        <div className={`gameover-setting-hud setting-lv-${settingNumber}`}>
          設定{settingNumber} <span className="gameover-setting-rate">({ratePercent}%)</span>
        </div>

        {/* 主役: GAME OVERタイトル */}
        <div className="gameover-hero-block">
          <span className="gameover-kicker">DEFEAT CONFIRMED</span>
          <h2 className="gameover-main-title">GAME OVER</h2>
        </div>

        {/* 次点: ROUND・STOCK（横並び・フレームレス） */}
        <div className="gameover-substats-row">
          <div className="gameover-substat-item">
            <span className="substat-num">{round}</span>
            <span className="substat-lbl">ROUND</span>
          </div>
          <div className="gameover-substat-item">
            <span className="substat-lbl">STOCK</span>
            <span className="substat-num stock">{totalStockEarned}</span>
          </div>
        </div>

        {/* 最優先: TOTAL獲得枚数（下部中央・ゴールドメタリック） */}
        <div className="gameover-total-group">
          <span className="gameover-total-label">TOTAL GET</span>
          <div className="gameover-total-value">
            <span className="total-num">{displayMedals}</span>
            <span className="total-unit">枚</span>
          </div>
        </div>

        {/* わかりやすくクリックできる戦績画像ダウンロード（ディスプレイ下部中央・フレームレス演出） */}
        <button
          type="button"
          className={`gameover-snap-btn interactive-control ${isCapturing ? 'capturing' : ''} ${hasSaved ? 'saved' : ''}`}
          onClick={handleDownloadSnap}
          aria-label="Play Result Image Download"
        >
          <span className="snap-chevron" aria-hidden="true">▸</span>
          <span className="snap-icon" aria-hidden="true">
            {hasSaved ? '✓' : '⬇'}
          </span>
          <span className="snap-text">
            {hasSaved ? 'RESULT IMAGE SAVED!' : 'PLAY RESULT IMAGE DOWNLOAD'}
          </span>
          <span className="snap-chevron" aria-hidden="true">◂</span>
        </button>
      </div>
    </div>
  )
}
