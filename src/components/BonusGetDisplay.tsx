import { useEffect, useRef } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import gsap from 'gsap'
import './BonusGetDisplay.css'

export interface BonusGetDisplayProps {
  onPlayVoice?: () => void
}

export function BonusGetDisplay({ onPlayVoice }: BonusGetDisplayProps = {}) {
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const contentWrapRef = useRef<HTMLDivElement>(null)
  const sevenTrioRef = useRef<HTMLDivElement>(null)
  const bonusLettersRef = useRef<HTMLDivElement>(null)
  const flashOverlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isCancelled = false
    const container = canvasContainerRef.current
    if (!container) return

    const app = new Application()
    appRef.current = app

    const safeDestroy = (appInstance: Application | null) => {
      if (!appInstance) return
      try {
        if (typeof (appInstance as any)._cancelResize !== 'function') {
          ;(appInstance as any)._cancelResize = () => {}
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

      if (typeof (app as any)._cancelResize !== 'function') {
        ;(app as any)._cancelResize = () => {}
      }

      canvasContainerRef.current.appendChild(app.canvas)

      const centerX = width / 2
      const centerY = height / 2

      // --- 1. 背景レイヤー: 暗黒の戦闘前夜 渦巻く闘気オーラ (Dark Battle Aura) ---
      const auraContainer = new Container()
      app.stage.addChild(auraContainer)

      // --- 2. 稲妻・雷撃レイヤー (Violent Lightning Strikes) ---
      const lightningGraphics = new Graphics()
      const lightningFlashG = new Graphics()
      app.stage.addChild(lightningFlashG)
      app.stage.addChild(lightningGraphics)

      // ジグザグのリアルな雷撃パスを生成する関数
      const drawLightningBolt = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        branches: number,
        alpha: number
      ) => {
        lightningGraphics.moveTo(x1, y1)
        const steps = 14
        const dx = (x2 - x1) / steps
        const dy = (y2 - y1) / steps

        for (let i = 1; i <= steps; i++) {
          const nextX = x1 + dx * i + (Math.random() - 0.5) * 26
          const nextY = y1 + dy * i + (Math.random() - 0.5) * 10
          lightningGraphics.lineTo(nextX, nextY)

          // 枝分かれの小雷撃
          if (branches > 0 && Math.random() < 0.35) {
            const bX = nextX + (Math.random() - 0.5) * 55
            const bY = nextY + Math.random() * 40
            lightningGraphics.moveTo(nextX, nextY)
            lightningGraphics.lineTo(bX, bY)
            lightningGraphics.moveTo(nextX, nextY)
          }
        }
        lightningGraphics.lineTo(x2, y2)
        // 外周の強力な紫電オーラ
        lightningGraphics.stroke({ width: 5.0, color: 0x9933ff, alpha: alpha * 0.85 })
        // 中心の白熱コア
        lightningGraphics.stroke({ width: 2.2, color: 0xffffff, alpha: alpha })
      }

      // --- 3. 鋭い戦闘衝撃波リング (Shockwave Rings) ---
      const shockwaveContainer = new Container()
      shockwaveContainer.x = centerX
      shockwaveContainer.y = centerY + 10
      app.stage.addChild(shockwaveContainer)

      const rings: Array<{ g: Graphics; radius: number; maxRadius: number; speed: number; alpha: number }> = []
      for (let i = 0; i < 2; i++) {
        const rG = new Graphics()
        shockwaveContainer.addChild(rG)
        rings.push({
          g: rG,
          radius: i * 60,
          maxRadius: Math.max(width, height) * 0.95,
          speed: 2.4 + i * 0.6,
          alpha: 1,
        })
      }

      // --- 4. 激しく吹き上がる真紅・紫の闘気火の粉 (Battle Sparks & Rising Embers) ---
      const particlesContainer = new Container()
      app.stage.addChild(particlesContainer)

      interface Ember {
        g: Graphics
        x: number
        y: number
        vx: number
        vy: number
        size: number
        alpha: number
        fadeSpeed: number
        color: number
      }

      const emberColors = [0xffffff, 0x00f0ff, 0xaa22ff, 0xff1e38, 0xff5500]
      const embers: Ember[] = []
      const EMBER_COUNT = 55

      for (let i = 0; i < EMBER_COUNT; i++) {
        const eG = new Graphics()
        particlesContainer.addChild(eG)
        const size = 1.2 + Math.random() * 3.2
        const color = emberColors[Math.floor(Math.random() * emberColors.length)]
        embers.push({
          g: eG,
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 2.2,
          vy: -1.6 - Math.random() * 3.5, // 猛烈に上昇
          size,
          alpha: 0.3 + Math.random() * 0.7,
          fadeSpeed: 0.015 + Math.random() * 0.025,
          color,
        })
      }

      // --- 5. アニメーション Ticker (稲妻発火 & 闘気更新) ---
      let lightningTimer = 0
      let lightningActive = false
      let lightningAlpha = 0
      let lightningX1 = centerX
      let lightningX2 = centerX

      app.ticker.add((ticker) => {
        const delta = ticker.deltaTime

        // 稲妻のランダム落雷シミュレーション (戦闘開始の緊迫感)
        lightningTimer += delta
        if (lightningTimer > 28 + Math.random() * 45) {
          lightningTimer = 0
          lightningActive = true
          lightningAlpha = 1
          lightningX1 = width * 0.15 + Math.random() * (width * 0.7)
          lightningX2 = lightningX1 + (Math.random() - 0.5) * 90
        }

        lightningGraphics.clear()
        lightningFlashG.clear()
        if (lightningActive) {
          // 落雷時の画面全体フラッシュ
          lightningFlashG.rect(0, 0, width, height)
          lightningFlashG.fill({ color: 0x6611aa, alpha: lightningAlpha * 0.28 })

          drawLightningBolt(lightningX1, -5, lightningX2, height + 10, 2, lightningAlpha)
          lightningAlpha -= 0.10 * delta
          if (lightningAlpha <= 0) {
            lightningActive = false
          }
        }

        // 衝撃波リング
        for (const ring of rings) {
          ring.radius += ring.speed * delta
          if (ring.radius > ring.maxRadius) {
            ring.radius = 8
            ring.alpha = 1
          }
          ring.alpha = Math.max(0, 1 - ring.radius / ring.maxRadius)
          ring.g.clear()
          ring.g.circle(0, 0, ring.radius)
          ring.g.stroke({
            width: 3 * (1 - ring.radius / ring.maxRadius) + 1,
            color: 0x9944ff,
            alpha: ring.alpha * 0.65,
          })
        }

        // 闘気の火の粉
        for (const em of embers) {
          em.x += em.vx * delta
          em.y += em.vy * delta
          em.alpha -= em.fadeSpeed * delta

          if (em.y < -15 || em.alpha <= 0) {
            em.x = centerX + (Math.random() - 0.5) * (width * 0.85)
            em.y = height + 15
            em.alpha = 0.8 + Math.random() * 0.2
            em.vy = -1.8 - Math.random() * 3.8
          }

          em.g.clear()
          em.g.circle(em.x, em.y, em.size)
          em.g.fill({ color: em.color, alpha: em.alpha })
        }
      })
    }

    initPixi()

    // --- 6. GSAP Motion Timeline (一文字ずつの大迫力スラムイン ＆ シリアスバトル突入) ---
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      // 1. 衝撃のホワイトアウト閃光
      if (flashOverlayRef.current) {
        tl.fromTo(
          flashOverlayRef.current,
          { opacity: 1 },
          { opacity: 0, duration: 0.35, ease: 'power2.out' },
          0
        )
      }

      // 2. 「777」の重厚な出現（暗黒から燃え盛る闘気とともに急降下）
      if (sevenTrioRef.current) {
        tl.fromTo(
          sevenTrioRef.current,
          { scale: 0.2, opacity: 0, y: -40 },
          {
            scale: 1,
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: 'back.out(2)',
          },
          0.05
        )
      }

      // 3. 「BONUS GET」一文字ずつの巨大サイズからの連続スラムイン (B-O-N-U-S-G-E-T)
      const letters = bonusLettersRef.current?.querySelectorAll('.slam-letter')
      if (letters && letters.length > 0) {
        tl.call(
          () => {
            onPlayVoice?.()
          },
          [],
          0.2
        )

        tl.fromTo(
          letters,
          {
            scale: 4.8,
            opacity: 0,
            y: -60,
            z: 200,
            rotation: () => (Math.random() - 0.5) * 20,
          },
          {
            scale: 1,
            opacity: 1,
            y: 0,
            z: 0,
            rotation: 0,
            duration: 0.28,
            ease: 'power4.inOut',
            stagger: 0.065, // 一文字ずつドスン！ドスン！と超高速着弾
          },
          0.2
        )

        // 全文字着弾直後の全体衝撃インパクト＆画面シェイク
        tl.to(
          contentWrapRef.current,
          {
            x: '+=6',
            yoyo: true,
            repeat: 5,
            duration: 0.04,
            ease: 'rough',
          },
          0.75
        )
      }

      // 4. 定常ループ: 闘気の鼓動（Heavy Battle Pulse）
      if (bonusLettersRef.current) {
        gsap.to(bonusLettersRef.current, {
          scale: 1.04,
          duration: 0.6,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: 0.9,
        })
      }

      if (sevenTrioRef.current) {
        gsap.to(sevenTrioRef.current, {
          filter: 'drop-shadow(0 0 16px rgba(255, 30, 60, 1)) drop-shadow(0 0 28px rgba(160, 30, 255, 0.9))',
          duration: 0.5,
          repeat: -1,
          yoyo: true,
          ease: 'power1.inOut',
          delay: 0.9,
        })
      }
    }, contentWrapRef)

    return () => {
      isCancelled = true
      ctx.revert()
      if (appRef.current) {
        safeDestroy(appRef.current)
        appRef.current = null
      }
    }
  }, [])

  // BONUS GET の各文字を配列化
  const word = ['B', 'O', 'N', 'U', 'S', ' ', 'G', 'E', 'T']

  return (
    <div className="bonus-get-display-container">
      {/* PixiJS WebGL Canvas 闇夜の稲妻＆闘気オーラ背景 */}
      <div ref={canvasContainerRef} className="pixi-canvas-wrap" />

      {/* 閃光ホワイトフラッシュ */}
      <div ref={flashOverlayRef} className="bonus-white-flash" />

      {/* GSAP 動的タイポグラフィレイヤー */}
      <div ref={contentWrapRef} className="bonus-get-content">
        {/* 上段: シリアスなバトル仕様「777」エンブレム */}
        <div ref={sevenTrioRef} className="seven-trio-emblem">
          <span className="seven-num num-1">7</span>
          <span className="seven-num num-2">7</span>
          <span className="seven-num num-3">7</span>
        </div>

        {/* メイン: 一文字ずつ巨大から着弾する「BONUS GET」ロゴ (説明文・帯は完全撤去) */}
        <div ref={bonusLettersRef} className="bonus-letters-row">
          {word.map((char, idx) => {
            if (char === ' ') {
              return <span key={idx} className="letter-space" />
            }
            return (
              <span key={idx} className={`slam-letter letter-${idx}`}>
                {char}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
