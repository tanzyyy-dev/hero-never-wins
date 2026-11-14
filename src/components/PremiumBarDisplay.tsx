import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import gsap from 'gsap'
import './PremiumBarDisplay.css'

export function PremiumBarDisplay() {
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const contentWrapRef = useRef<HTMLDivElement>(null)
  const flashOverlayRef = useRef<HTMLDivElement>(null)
  const trioRef = useRef<HTMLDivElement>(null)
  const subheadRef = useRef<HTMLDivElement>(null)
  const stockSlamRef = useRef<HTMLDivElement>(null)
  const payoutStripRef = useRef<HTMLDivElement>(null)
  const [displayCount, setDisplayCount] = useState(1)

  useEffect(() => {
    let isCancelled = false
    const container = canvasContainerRef.current
    if (!container) return

    const app = new Application()
    appRef.current = app

    const safeDestroy = (appInstance: Application | null) => {
      if (!appInstance) return
      try {
        if (typeof (appInstance as { _cancelResize?: () => void })._cancelResize !== 'function') {
          ;(appInstance as { _cancelResize?: () => void })._cancelResize = () => {}
        }
        appInstance.destroy(true, { children: true })
      } catch {
        // Safe fallback in React StrictMode
      }
    }

    const initPixi = async () => {
      const width = container.clientWidth || 380
      const height = container.clientHeight || 240

      try {
        await app.init({
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
        })
      } catch {
        return
      }

      if (isCancelled || !canvasContainerRef.current) {
        safeDestroy(app)
        return
      }

      if (typeof (app as { _cancelResize?: () => void })._cancelResize !== 'function') {
        ;(app as { _cancelResize?: () => void })._cancelResize = () => {}
      }

      canvasContainerRef.current.appendChild(app.canvas)

      const centerX = width / 2
      const centerY = height / 2

      // 1. 黄金・白銀の稲妻レイヤー
      const lightningFlashG = new Graphics()
      const lightningGraphics = new Graphics()
      app.stage.addChild(lightningFlashG)
      app.stage.addChild(lightningGraphics)

      const drawBolt = (x1: number, y1: number, x2: number, y2: number, alpha: number, color: number) => {
        lightningGraphics.moveTo(x1, y1)
        const steps = 14
        const dx = (x2 - x1) / steps
        const dy = (y2 - y1) / steps
        for (let i = 1; i <= steps; i++) {
          const nx = x1 + dx * i + (Math.random() - 0.5) * 30
          const ny = y1 + dy * i + (Math.random() - 0.5) * 10
          lightningGraphics.lineTo(nx, ny)
          if (Math.random() < 0.35) {
            lightningGraphics.moveTo(nx, ny)
            lightningGraphics.lineTo(nx + (Math.random() - 0.5) * 58, ny + (Math.random() - 0.2) * 38)
            lightningGraphics.moveTo(nx, ny)
          }
        }
        lightningGraphics.lineTo(x2, y2)
        lightningGraphics.stroke({ width: 5.5, color, alpha: alpha * 0.85 })
        lightningGraphics.stroke({ width: 2.2, color: 0xffffff, alpha })
      }

      // 2. 衝撃波リング
      const shockwaveContainer = new Container()
      shockwaveContainer.x = centerX
      shockwaveContainer.y = centerY
      app.stage.addChild(shockwaveContainer)

      const rings = [0, 1, 2].map((i) => {
        const g = new Graphics()
        shockwaveContainer.addChild(g)
        return {
          g,
          radius: i * 48,
          maxRadius: Math.max(width, height) * 0.95,
          speed: 3.4 + i * 0.8,
          color: i % 2 === 0 ? 0xfacc15 : 0xffffff,
        }
      })

      // 3. 放射状＆上昇スパーク粒子 (110個)
      const particlesContainer = new Container()
      app.stage.addChild(particlesContainer)
      const sparkColors = [0xffffff, 0xfef08a, 0xfacc15, 0xf97316, 0x38bdf8]
      const sparks = Array.from({ length: 110 }, () => {
        const g = new Graphics()
        particlesContainer.addChild(g)
        const angle = Math.random() * Math.PI * 2
        const speed = 2.6 + Math.random() * 7.8
        return {
          g,
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          size: 1.5 + Math.random() * 3.1,
          alpha: 0.75 + Math.random() * 0.25,
          color: sparkColors[Math.floor(Math.random() * sparkColors.length)]!,
        }
      })

      let elapsedFrames = 0
      let boltTimer = 18 // 初回は即発火
      let boltAlpha = 1
      let boltX1 = centerX - 40
      let boltX2 = centerX + 50
      let boltColor = 0xfacc15

      app.ticker.add((ticker) => {
        const delta = ticker.deltaTime
        elapsedFrames += delta

        // 最初の約1.2秒は超高速連打、その後も高頻度で落雷
        const boltInterval = elapsedFrames < 75 ? 4 + Math.random() * 6 : 12 + Math.random() * 16
        boltTimer += delta
        if (boltTimer > boltInterval) {
          boltTimer = 0
          boltAlpha = 1
          boltX1 = width * 0.1 + Math.random() * (width * 0.8)
          boltX2 = boltX1 + (Math.random() - 0.5) * 120
          boltColor = Math.random() < 0.65 ? 0xfacc15 : 0x38bdf8
        }

        lightningGraphics.clear()
        lightningFlashG.clear()
        if (boltAlpha > 0) {
          lightningFlashG.rect(0, 0, width, height)
          lightningFlashG.fill({ color: boltColor, alpha: boltAlpha * 0.24 })
          drawBolt(boltX1, -6, boltX2, height + 8, boltAlpha, boltColor)
          boltAlpha = Math.max(0, boltAlpha - 0.14 * delta)
        }

        for (const ring of rings) {
          ring.radius += ring.speed * delta
          if (ring.radius > ring.maxRadius) {
            ring.radius = 6
          }
          const progress = ring.radius / ring.maxRadius
          const alpha = Math.max(0, 1 - progress)
          ring.g.clear()
          ring.g.circle(0, 0, ring.radius)
          ring.g.stroke({
            width: 3.5 * alpha + 1,
            color: ring.color,
            alpha: alpha * 0.72,
          })
        }

        for (const sp of sparks) {
          sp.x += sp.vx * delta
          sp.y += sp.vy * delta
          sp.alpha -= 0.018 * delta
          if (sp.alpha <= 0 || sp.x < -10 || sp.x > width + 10 || sp.y < -10 || sp.y > height + 10) {
            const angle = Math.random() * Math.PI * 2
            const speed = 1.8 + Math.random() * 5.2
            sp.x = centerX + (Math.random() - 0.5) * 40
            sp.y = centerY + (Math.random() - 0.5) * 20
            sp.vx = Math.cos(angle) * speed
            sp.vy = Math.sin(angle) * speed - 0.8
            sp.alpha = 0.85 + Math.random() * 0.15
          }
          sp.g.clear()
          sp.g.circle(sp.x, sp.y, sp.size)
          sp.g.fill({ color: sp.color, alpha: sp.alpha })
        }
      })
    }

    initPixi()

    // GSAP 多段スラム＆画面シェイク演出
    const counterObj = { val: 1 }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      // 1. 0.00s: 第1閃光ホワイトアウト
      if (flashOverlayRef.current) {
        tl.fromTo(
          flashOverlayRef.current,
          { opacity: 1 },
          { opacity: 0, duration: 0.24, ease: 'power2.out' },
          0
        )
      }

      // 2. 0.02s: BAR×3 メタリックプレート順番着弾
      if (trioRef.current) {
        const plates = trioRef.current.querySelectorAll('.premium-bar-plate')
        tl.fromTo(
          plates,
          { scale: 2.6, opacity: 0, y: -24 },
          { scale: 1, opacity: 1, y: 0, duration: 0.16, stagger: 0.055, ease: 'power4.out' },
          0.02
        )
      }

      if (subheadRef.current) {
        tl.fromTo(
          subheadRef.current,
          { opacity: 0, letterSpacing: '0.7em' },
          { opacity: 1, letterSpacing: '0.42em', duration: 0.22, ease: 'power2.out' },
          0.12
        )
      }

      // 3. 0.18s: 主役「STOCK +20」特大スラムイン + 多段ストロボフラッシュ + 画面シェイク
      if (stockSlamRef.current) {
        tl.fromTo(
          stockSlamRef.current,
          { scale: 3.6, opacity: 0, filter: 'brightness(3.5)' },
          { scale: 1, opacity: 1, filter: 'brightness(1)', duration: 0.24, ease: 'back.out(1.6)' },
          0.18
        )
      }

      if (flashOverlayRef.current) {
        ;[0.22, 0.44, 0.68].forEach((beat, idx) => {
          tl.fromTo(
            flashOverlayRef.current!,
            { opacity: idx === 1 ? 0.95 : 0.72 },
            { opacity: 0, duration: 0.2, ease: 'power2.out' },
            beat
          )
        })
      }

      if (contentWrapRef.current) {
        tl.fromTo(
          contentWrapRef.current,
          { x: -8, y: 6 },
          { x: 0, y: 0, duration: 0.26, ease: 'elastic.out(2.0, 0.22)' },
          0.2
        )
        tl.fromTo(
          contentWrapRef.current,
          { x: 6, y: -5 },
          { x: 0, y: 0, duration: 0.24, ease: 'elastic.out(1.8, 0.25)' },
          0.56
        )
      }

      // 4. カウントアップ (+1 -> +20)
      tl.to(
        counterObj,
        {
          val: 20,
          duration: 0.36,
          ease: 'power2.out',
          onUpdate: () => {
            setDisplayCount(Math.round(counterObj.val))
          },
        },
        0.22
      )

      // 5. +15 MEDALS 帯
      if (payoutStripRef.current) {
        tl.fromTo(
          payoutStripRef.current,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' },
          0.38
        )
      }
    })

    return () => {
      isCancelled = true
      ctx.revert()
      safeDestroy(appRef.current)
      appRef.current = null
    }
  }, [])

  return (
    <div className="premium-bar-display-container" aria-hidden="true">
      <div ref={canvasContainerRef} className="premium-bar-pixi-wrap" />
      <div className="premium-bar-scanlines" />
      <div ref={flashOverlayRef} className="premium-bar-white-flash" />

      <div ref={contentWrapRef} className="premium-bar-content">
        <div ref={trioRef} className="premium-bar-trio-row">
          <span className="premium-bar-plate plate-1">BAR</span>
          <span className="premium-bar-plate plate-2">BAR</span>
          <span className="premium-bar-plate plate-3">BAR</span>
        </div>

        <div ref={subheadRef} className="premium-bar-subhead">
          PREMIUM OVERDRIVE
        </div>

        <div ref={stockSlamRef} className="premium-bar-stock-slam">
          <span className="premium-bar-stock-label">STOCK</span>
          <span className="premium-bar-stock-num">+{displayCount}</span>
        </div>

        <div ref={payoutStripRef} className="premium-bar-payout-strip">
          PAYOUT +15 MEDALS
        </div>
      </div>
    </div>
  )
}
