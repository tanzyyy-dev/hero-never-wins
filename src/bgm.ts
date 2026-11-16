import { useEffect, useRef, useState, useCallback } from 'react'
import { BgmPlayerController, type BgmPathMap, type BgmTrack } from './game/bgmController'

export type { BgmTrack }

// BGMファイルパス定義 (プライマリパスとフォールバックパス)
const BGM_PATHS: BgmPathMap = {
  opening: ['audio/bgm_opening.mp3', 'bgm_opening.mp3'],
  pre_battle: ['audio/bgm_pre_battle.mp3', 'bgm_pre_battle.mp3'],
  battle: ['audio/bgm_battle.mp3', 'bgm_battle.mp3'],
  gameover: ['audio/bgm_gameover.mp3', 'bgm_gameover.mp3'],
}

/**
 * BGM再生制御フック
 * @param track 再生したいトラック ('opening' | 'pre_battle' | 'battle' | 'gameover' | null)
 * @param muted ミュート状態
 * @param isDimmed 設定画面等で音量を半分にするフラグ
 */
export function useBgm(track: BgmTrack, muted: boolean, isDimmed = false) {
  const [unlocked, setUnlocked] = useState(false)

  const normalVolume = 0.38
  const dimmedVolume = 0.19
  const currentVolume = isDimmed ? dimmedVolume : normalVolume

  const controllerRef = useRef<BgmPlayerController | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = new BgmPlayerController(
      () => new Audio(),
      {
        paths: BGM_PATHS,
        initialVolume: currentVolume,
        onError: (record) => {
          console.warn(`[BGM] ${record.name} (${record.track ?? 'none'}): ${record.message}`)
          if (typeof window !== 'undefined') {
            ;(window as unknown as { __bgmLastError?: typeof record }).__bgmLastError = record
          }
        },
      },
    )
  }

  // アンマウント時の完全クリーンアップ
  useEffect(() => {
    const controller = controllerRef.current
    return () => {
      controller?.dispose()
    }
  }, [])

  // 音量変更のみを同期（トラック切り替えや pause/play を発生させない）
  useEffect(() => {
    controllerRef.current?.setVolume(currentVolume)
  }, [currentVolume])

  // ミュート状態の同期
  useEffect(() => {
    controllerRef.current?.setMuted(muted)
  }, [muted])

  // ユーザーの操作イベント内で直接再生許可を確立・保留中の再生を再試行する
  const unlockAudio = useCallback(() => {
    const controller = controllerRef.current
    if (!controller) return
    const newlyUnlocked = controller.unlockFromUserGesture()
    if (newlyUnlocked) {
      setUnlocked(true)
    }
    if (typeof window !== 'undefined') {
      const audio = controller.getAudio()
      if (audio instanceof HTMLAudioElement) {
        ;(window as unknown as { __bgmAudio?: HTMLAudioElement }).__bgmAudio = audio
      }
    }
  }, [])

  // 未アンロック時または NotAllowedError 後の再試行待ち時に、次のユーザー操作で復旧
  useEffect(() => {
    const handleUserInteraction = () => {
      const controller = controllerRef.current
      if (!controller) return
      if (!controller.isUnlocked() || controller.hasPendingUserGestureRetry()) {
        unlockAudio()
      }
    }
    window.addEventListener('pointerdown', handleUserInteraction, { passive: true })
    window.addEventListener('keydown', handleUserInteraction, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', handleUserInteraction)
      window.removeEventListener('keydown', handleUserInteraction)
    }
  }, [unlockAudio])

  // トラック変更のみを同期（音量変更では再実行しない）
  useEffect(() => {
    const controller = controllerRef.current
    if (!controller) return

    if (typeof window !== 'undefined') {
      ;(window as unknown as { __bgmTrack?: BgmTrack }).__bgmTrack = track
    }

    controller.setTrack(track)

    if (typeof window !== 'undefined') {
      const audio = controller.getAudio()
      if (audio instanceof HTMLAudioElement) {
        ;(window as unknown as { __bgmAudio?: HTMLAudioElement }).__bgmAudio = audio
      }
    }
  }, [track, unlocked])

  return {
    unlocked,
    unlockAudio,
  }
}
