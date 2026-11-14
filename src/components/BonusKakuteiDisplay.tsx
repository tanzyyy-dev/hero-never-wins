import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ReelSymbolSvg } from './ReelSymbolSvg'
import './BonusKakuteiDisplay.css'

export function BonusKakuteiDisplay() {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const aimPromptRef = useRef<HTMLDivElement>(null)
  const sevenIconRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. 登場アニメーション
      if (titleRef.current) {
        gsap.fromTo(
          titleRef.current,
          { scale: 0.6, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.8)' }
        )
      }

      if (sevenIconRef.current) {
        gsap.fromTo(
          sevenIconRef.current,
          { scale: 0.2, opacity: 0, rotation: -15 },
          { scale: 1, opacity: 1, rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)', delay: 0.15 }
        )
        // 激しい呼吸パルス
        gsap.to(sevenIconRef.current, {
          scale: 1.08,
          duration: 0.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: 0.7,
        })
      }

      if (aimPromptRef.current) {
        gsap.fromTo(
          aimPromptRef.current,
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', delay: 0.3 }
        )
        // 激しい点滅（緊急告知）
        gsap.to(aimPromptRef.current, {
          opacity: 0.5,
          duration: 0.35,
          repeat: -1,
          yoyo: true,
          ease: 'power1.inOut',
          delay: 0.7,
        })
      }
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} className="bonus-kakutei-display-container">
      {/* 背景の闘気・紫電オーバーレイ */}
      <div className="kakutei-aura-bg" />
      <div className="kakutei-lightning-lines" />

      {/* メインコンテンツ */}
      <div className="kakutei-content">
        {/* 上段: BONUS 確定 */}
        <div ref={titleRef} className="kakutei-title-wrap">
          <div className="kakutei-main-text">BONUS 確定</div>
        </div>

        {/* 中段: 巨大赤７シンボル */}
        <div ref={sevenIconRef} className="kakutei-seven-symbol">
          <ReelSymbolSvg id="seven" className="kakutei-seven-svg" isCenter={true} />
        </div>

        {/* 下段: 赤７を狙え！ 指示 */}
        <div ref={aimPromptRef} className="kakutei-aim-strip">
          <span className="aim-arrow-left">▶▶▶</span>
          <span className="aim-main-label">赤７を狙え！</span>
          <span className="aim-arrow-right">◀◀◀</span>
        </div>
      </div>
    </div>
  )
}

