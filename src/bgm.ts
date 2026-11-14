import { useEffect, useRef, useState, useCallback } from 'react'

export type BgmTrack = 'opening' | 'pre_battle' | 'battle' | 'gameover' | null

// BGMファイルパス定義 (プライマリパスとフォールバックパス)
const BGM_PATHS: Record<'opening' | 'pre_battle' | 'battle' | 'gameover', string[]> = {
  opening: ['/audio/bgm_opening.mp3', '/bgm_opening.mp3'],
  pre_battle: ['/audio/bgm_pre_battle.mp3', '/bgm_pre_battle.mp3'],
  battle: ['/audio/bgm_battle.mp3', '/bgm_battle.mp3'],
  gameover: ['/audio/bgm_gameover.mp3', '/bgm_gameover.mp3'],
}

/**
 * BGM再生制御フック
 * @param track 再生したいトラック ('pre_battle' | 'battle' | null)
 * @param muted ミュート状態
 * @param isDimmed 設定画面等で音量を半分にするフラグ
 */
export function useBgm(track: BgmTrack, muted: boolean, isDimmed = false) {
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentTrackRef = useRef<BgmTrack>(null)
  const [unlocked, setUnlocked] = useState(false)

  const normalVolume = 0.38
  const dimmedVolume = 0.19
  const currentVolume = isDimmed ? dimmedVolume : normalVolume

  // 音量同期
  useEffect(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.volume = currentVolume
    }
  }, [currentVolume])

  // ユーザーの初操作でオーディオ再生をアンロック (ブラウザのAutoplay Policy対策)
  const unlockAudio = useCallback(() => {
    if (unlocked) return
    setUnlocked(true)
  }, [unlocked])

  // グローバルなタップ・クリック・キー入力でアンロック
  useEffect(() => {
    const handleFirstInteraction = () => {
      unlockAudio()
      window.removeEventListener('pointerdown', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
    window.addEventListener('pointerdown', handleFirstInteraction, { passive: true })
    window.addEventListener('keydown', handleFirstInteraction, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [unlockAudio])

  // トラック変更・ミュート連動
  useEffect(() => {
    currentTrackRef.current = track
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __bgmTrack?: BgmTrack }).__bgmTrack = track
    }

    // トラックが null または未アンロック時は停止
    if (!track || !unlocked) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
      }
      return
    }

    // 既に同じトラックを再生中ならミュートと再生状態・音量だけ同期
    if (currentAudioRef.current && currentAudioRef.current.dataset.trackId === track) {
      currentAudioRef.current.muted = muted
      currentAudioRef.current.volume = currentVolume
      if (!muted && currentAudioRef.current.paused) {
        currentAudioRef.current.play().catch(() => {
          // ファイル未配置または再生ブロック時はサイレントに無視
        })
      }
      return
    }

    // 前のトラックを停止
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
    }

    // 新しいトラックを準備
    const candidatePaths = BGM_PATHS[track]
    let pathIndex = 0

    const tryPlayAudio = () => {
      if (pathIndex >= candidatePaths.length) return
      const src = candidatePaths[pathIndex]

      const audio = new Audio(src)
      audio.dataset.trackId = track
      audio.loop = true
      audio.volume = currentVolume
      audio.muted = muted

      audio.onerror = () => {
        // パスが見つからない場合は次の候補パスを試す
        pathIndex++
        if (pathIndex < candidatePaths.length) {
          tryPlayAudio()
        }
      }

      const playPromise = audio.play()
      if (typeof window !== 'undefined') {
        ;(window as unknown as { __bgmAudio?: HTMLAudioElement }).__bgmAudio = audio
      }
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            currentAudioRef.current = audio
          })
          .catch(() => {
            // 自動再生ブロックやファイル未配置時はサイレントに無視
          })
      }
    }

    tryPlayAudio()

    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
      }
    }
  }, [track, muted, unlocked, currentVolume])

  return {
    unlocked,
    unlockAudio,
  }
}
