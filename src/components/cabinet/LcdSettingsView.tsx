/**
 * 設定画面（銀色ボタン / S キーで液晶表示を切り替える。ダイアログではなく液晶画面そのもの）。
 *
 * - CSS: src/style.css「LCD SETTINGS VIEW」セクション
 * - 開閉状態・各設定値は src/main.tsx App が保持する
 * - 表示文言に絵文字は使わない（OFF / ON のみ）
 */

interface ToggleRowProps {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}

function SettingsToggleRow({ label, value, onChange }: ToggleRowProps) {
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <div className="settings-btn-group">
        <button
          type="button"
          className={`settings-opt-btn ${!value ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onChange(false)
          }}
        >
          OFF
        </button>
        <button
          type="button"
          className={`settings-opt-btn ${value ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onChange(true)
          }}
        >
          ON
        </button>
      </div>
    </div>
  )
}

export interface LcdSettingsViewProps {
  muted: boolean
  onMutedChange: (muted: boolean) => void
  autoPlay: boolean
  onAutoPlayChange: (autoPlay: boolean) => void
  fastSpeed: boolean
  onFastSpeedChange: (fastSpeed: boolean) => void
}

export function LcdSettingsView({
  muted,
  onMutedChange,
  autoPlay,
  onAutoPlayChange,
  fastSpeed,
  onFastSpeedChange,
}: LcdSettingsViewProps) {
  return (
    <div className="lcd-settings-view interactive-control" onClick={(e) => e.stopPropagation()}>
      <div className="settings-grid">
        {/* 1. 設定 (見出し「設定」、設定値は GAME OVER まで「？」のみ) */}
        <div className="settings-row">
          <span className="settings-label">設定</span>
          <div className="settings-val-badge">？</div>
        </div>

        {/* 2. SOUND（ON = ミュート解除） */}
        <SettingsToggleRow label="SOUND" value={!muted} onChange={(soundOn) => onMutedChange(!soundOn)} />

        {/* 3. AUTO PLAY */}
        <SettingsToggleRow label="AUTO PLAY" value={autoPlay} onChange={onAutoPlayChange} />

        {/* 4. 倍速 */}
        <SettingsToggleRow label="倍速" value={fastSpeed} onChange={onFastSpeedChange} />
      </div>
    </div>
  )
}
