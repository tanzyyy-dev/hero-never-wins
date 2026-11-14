import { useEffect, useRef } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import gsap from 'gsap'
import './BattleModeIntroDisplay.css'

export interface BattleModeIntroDisplayProps {
  round: number
  onStartBattle?: () => void
  onPlayVoice?: () => void
}

export function BattleModeIntroDisplay({ round, onStartBattle, onPlayVoice }: BattleModeIntroDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const subTitleRef = useRef<HTMLDivElement>(null)
  const roundBadgeRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)

  useEffect(() => {
    let isCancelled = false
    const app = new Application()

    const safeDestroy = (instance: Application) => {
      try {
        if (!('_cancelResize' in instance) || typeof (instance as unknown as { _cancelResize: unknown })._cancelResize !== 'function') {
          ;(instance as unknown as { _cancelResize: () => void })._cancelResize = () => {}
        }
        instance.destroy(true, { children: true })
      } catch (err) {
        console.warn('PIXI Application cleanup notice:', err)
      }
    }

    const initPixi = async () => {
      if (!canvasContainerRef.current) return
      const width = canvasContainerRef.current.clientWidth || 380
      const height = canvasContainerRef.current.clientHeight || 230

      await app.init({
        width,
        height,
        backgroundAlpha: 0,
        antialias: true,
        powerPreference: 'high-performance',
      })

      if (isCancelled || !canvasContainerRef.current) {
        safeDestroy(app)
        return
      }

      appRef.current = app
      canvasContainerRef.current.appendChild(app.canvas)

      // --- 1. 激しく燃え盛る業火・マグマ火炎レイヤー ---
      const fireContainer = new Container()
      app.stage.addChild(fireContainer)

      interface FlameParticle {
        g: Graphics
        x: number
        y: number
        vx: number
        vy: number
        baseSize: number
        alpha: number
        color: number
      }

      const flameColors = [0xff2200, 0xff5500, 0xffaa00, 0xffea00, 0xff0044]
      const flames: FlameParticle[] = []
      const FLAME_COUNT = 65

      for (let i = 0; i < FLAME_COUNT; i++) {
        const g = new Graphics()
        fireContainer.addChild(g)
        flames.push({
          g,
          x: Math.random() * width,
          y: height + Math.random() * 40,
          vx: (Math.random() - 0.5) * 2.8,
          vy: -3.5 - Math.random() * 4.5,
          baseSize: 6 + Math.random() * 18,
          alpha: 0.6 + Math.random() * 0.4,
          color: flameColors[Math.floor(Math.random() * flameColors.length)]!,
        })
      }

      // --- 2. 稲妻・雷光ボルトレイヤー ---
      const boltGraphics = new Graphics()
      app.stage.addChild(boltGraphics)

      let boltTimer = 0

      // PixiJS アニメーションループ
      app.ticker.add((time) => {
        const delta = time.deltaTime

        // 炎パーティクルの上昇・揺らめき
        for (const f of flames) {
          f.y += f.vy * delta
          f.x += f.vx * delta + Math.sin(f.y * 0.05) * 1.5

          const progress = (height - f.y) / height
          const currentSize = Math.max(1, f.baseSize * (1 - progress * 0.7))
          const currentAlpha = Math.max(0, f.alpha * (1 - progress * 0.85))

          f.g.clear()
          f.g.circle(f.x, f.y, currentSize)
          f.g.fill({ color: f.color, alpha: currentAlpha })

          if (f.y < -20 || currentAlpha <= 0) {
            f.y = height + 10
            f.x = Math.random() * width
            f.alpha = 0.7 + Math.random() * 0.3
          }
        }

        // 激しい雷光フラッシュの描画
        boltTimer += delta
        boltGraphics.clear()
        if (boltTimer > 18) {
          boltTimer = 0
          // ランダム落雷
          const startX = width * 0.2 + Math.random() * (width * 0.6)
          let curX = startX
          let curY = 0

          boltGraphics.moveTo(curX, curY)
          while (curY < height) {
            curX += (Math.random() - 0.5) * 45
            curY += 20 + Math.random() * 25
            boltGraphics.lineTo(curX, curY)
          }
          boltGraphics.stroke({ width: 4.5, color: 0xffea00, alpha: 0.9 })
          boltGraphics.stroke({ width: 1.8, color: 0xffffff, alpha: 1 })
        }
      })
    }

    void initPixi()

    // --- GSAP タイポグラフィ・スラムインアニメーション ---
    const voiceTimer = setTimeout(() => {
      if (!isCancelled) {
        onPlayVoice?.()
      }
    }, 150)

    const ctx = gsap.context(() => {
      // 1. 強烈なホワイトフラッシュ
      if (flashRef.current) {
        gsap.fromTo(
          flashRef.current,
          { opacity: 1 },
          { opacity: 0, duration: 0.6, ease: 'power2.out' }
        )
      }

      // 2. 「ROUND 1」バッジの登場
      if (roundBadgeRef.current) {
        gsap.fromTo(
          roundBadgeRef.current,
          { scale: 0, opacity: 0, y: -20 },
          { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2)', delay: 0.1 }
        )
      }

      // 3. 「BATTLE MODE」巨大3Dロゴの超重量級スラムイン
      if (titleRef.current) {
        gsap.fromTo(
          titleRef.current,
          { scale: 4.2, opacity: 0, filter: 'blur(12px) brightness(3)' },
          {
            scale: 1,
            opacity: 1,
            filter: 'blur(0px) brightness(1)',
            duration: 0.55,
            ease: 'power4.in',
            delay: 0.2,
            onComplete: () => {
              // 着弾時の画面シェイク
              if (containerRef.current) {
                gsap.fromTo(
                  containerRef.current,
                  { x: -7, y: 6 },
                  { x: 0, y: 0, duration: 0.35, ease: 'elastic.out(1, 0.3)' }
                )
              }
            },
          }
        )

        // 着弾後の呼吸パルス・威圧グロー
        gsap.to(titleRef.current, {
          scale: 1.04,
          duration: 0.65,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: 0.8,
        })
      }

      // 4. サブタイトル「死闘突入・CHANCEを押せ！」
      if (subTitleRef.current) {
        gsap.fromTo(
          subTitleRef.current,
          { opacity: 0, scale: 0.8 },
          { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out', delay: 0.7 }
        )
        // 激しい点滅
        gsap.to(subTitleRef.current, {
          opacity: 0.45,
          duration: 0.28,
          repeat: -1,
          yoyo: true,
          ease: 'power1.inOut',
          delay: 1.1,
        })
      }
    }, containerRef)

    return () => {
      isCancelled = true
      clearTimeout(voiceTimer)
      ctx.revert()
      if (appRef.current) {
        safeDestroy(appRef.current)
        appRef.current = null
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="battle-mode-intro-container"
      onClick={(e) => {
        e.stopPropagation()
        onStartBattle?.()
      }}
    >
      {/* 炎＆放電 PixiJS Canvas */}
      <div ref={canvasContainerRef} className="intro-pixi-canvas" />

      {/* 激しい爆発閃光 */}
      <div ref={flashRef} className="intro-white-flash" />

      {/* 燃えるマグマ背景グラデーション */}
      <div className="intro-inferno-bg" />

      {/* メインタイポグラフィ */}
      <div className="intro-content-wrap">
        {/* 上部: ROUND バッジ */}
        <div ref={roundBadgeRef} className="intro-round-badge">
          <span className="badge-flame-icon">🔥</span>
          <span className="badge-round-text">ROUND {round}</span>
          <span className="badge-flame-icon">🔥</span>
        </div>

        {/* 中央: 巨大「BATTLE MODE」ロゴ */}
        <div ref={titleRef} className="intro-battle-mode-logo">
          <div className="logo-text-backlayer">BATTLE MODE</div>
          <div className="logo-text-core">BATTLE MODE</div>
          <div className="logo-sheen-shine" />
        </div>

        {/* 下部: 死闘突入指示 */}
        <div ref={subTitleRef} className="intro-prompt-strip">
          <span className="prompt-arrow">▶▶▶</span>
          <span className="prompt-label">死闘突入！ PUSH CHANCE</span>
          <span className="prompt-arrow">◀◀◀</span>
        </div>
      </div>
    </div>
  )
}

