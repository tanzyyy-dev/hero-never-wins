/**
 * 開発サーバー専用デバッグパネル（PC の広い画面で筐体の左右余白に表示）。
 * 表示条件（import.meta.env.DEV・左右余白幅）は src/main.tsx showDebugPanels で判定する。
 *
 * - 選択肢と抽選オプション変換: src/game/debugOptions.ts
 * - バトル演出指定の選択肢: src/engine.ts DEBUG_BATTLE_SCENARIOS / resolveDebugBattleSelection
 * - CSS: src/style.css「DEV DEBUG PANELS」セクション
 *
 * 指定値は「次回1回のみ」有効で、消費後に main.tsx 側で通常抽選へ戻す。
 */
import { DEBUG_BATTLE_SCENARIOS } from '../../engine'
import type { DebugBattleScenarioId } from '../../engine'
import {
  DEBUG_BAR_AIM_MODE_OPTIONS,
  DEBUG_SPIN_ROLE_OPTIONS,
  DEBUG_STOCK_MODE_OPTIONS,
  type ForcedBarAimMode,
  type ForcedStockMode,
} from '../../game/debugOptions'

const AUTO_LABEL = '通常抽選'

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation()

export interface DebugSettingsPanelProps {
  offsetPx: number
  forcedSpinRole: string | null
  onForcedSpinRoleChange: (roleId: string | null) => void
  forcedStockMode: ForcedStockMode
  onForcedStockModeChange: (mode: ForcedStockMode) => void
  forcedBarAimMode: ForcedBarAimMode
  onForcedBarAimModeChange: (mode: ForcedBarAimMode) => void
  forcedBattlePattern: DebugBattleScenarioId | null
  onForcedBattlePatternChange: (id: DebugBattleScenarioId | null) => void
}

/** 左パネル: 次回の強制役・ストック・BARを狙え・バトル演出の指定 */
export function DebugSettingsPanel({
  offsetPx,
  forcedSpinRole,
  onForcedSpinRoleChange,
  forcedStockMode,
  onForcedStockModeChange,
  forcedBarAimMode,
  onForcedBarAimModeChange,
  forcedBattlePattern,
  onForcedBattlePatternChange,
}: DebugSettingsPanelProps) {
  return (
    <aside
      className="debug-panel debug-panel-left interactive-control"
      style={{ right: `calc(50% + ${offsetPx}px)` }}
      onClick={stopPropagation}
      onTouchStart={stopPropagation}
    >
      <div className="debug-panel-title">DEBUG 設定</div>
      <label className="debug-field">
        <span className="debug-field-label">強制役指定</span>
        <select
          className="debug-select"
          value={forcedSpinRole ?? ''}
          onChange={(e) => onForcedSpinRoleChange(e.target.value || null)}
        >
          <option value="">{AUTO_LABEL}</option>
          {DEBUG_SPIN_ROLE_OPTIONS.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
      </label>
      <label className="debug-field">
        <span className="debug-field-label">ストック抽選指定</span>
        <select
          className="debug-select"
          value={forcedStockMode}
          onChange={(e) => onForcedStockModeChange(e.target.value as ForcedStockMode)}
        >
          {DEBUG_STOCK_MODE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="debug-field">
        <span className="debug-field-label">BARを狙え演出</span>
        <select
          className="debug-select"
          value={forcedBarAimMode}
          onChange={(e) => onForcedBarAimModeChange(e.target.value as ForcedBarAimMode)}
        >
          {DEBUG_BAR_AIM_MODE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="debug-field">
        <span className="debug-field-label">バトル演出指定</span>
        <select
          className="debug-select"
          value={forcedBattlePattern ?? ''}
          onChange={(e) => onForcedBattlePatternChange((e.target.value || null) as DebugBattleScenarioId | null)}
        >
          <option value="">{AUTO_LABEL}</option>
          {DEBUG_BATTLE_SCENARIOS.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.label}
            </option>
          ))}
        </select>
      </label>
    </aside>
  )
}

export interface DebugStatusPanelProps {
  offsetPx: number
  stockCount: number
  forcedSpinRole: string | null
  forcedStockMode: ForcedStockMode
  forcedBarAimMode: ForcedBarAimMode
  forcedBattlePattern: DebugBattleScenarioId | null
  progressStatusText: string
}

/** 右パネル: 保有ストック・次回指定内容・進行状態の表示 */
export function DebugStatusPanel({
  offsetPx,
  stockCount,
  forcedSpinRole,
  forcedStockMode,
  forcedBarAimMode,
  forcedBattlePattern,
  progressStatusText,
}: DebugStatusPanelProps) {
  const forcedSpinRoleLabel =
    forcedSpinRole !== null
      ? (DEBUG_SPIN_ROLE_OPTIONS.find((r) => r.id === forcedSpinRole)?.label ?? forcedSpinRole)
      : AUTO_LABEL
  const forcedStockLabel = DEBUG_STOCK_MODE_OPTIONS.find((o) => o.id === forcedStockMode)?.label ?? AUTO_LABEL
  const forcedBarAimLabel = DEBUG_BAR_AIM_MODE_OPTIONS.find((o) => o.id === forcedBarAimMode)?.label ?? AUTO_LABEL
  const forcedBattleLabel =
    forcedBattlePattern !== null
      ? (DEBUG_BATTLE_SCENARIOS.find((s) => s.id === forcedBattlePattern)?.label ?? forcedBattlePattern)
      : AUTO_LABEL

  const rows: Array<[string, string | number]> = [
    ['保有ストック数', stockCount],
    ['次回成立役', forcedSpinRoleLabel],
    ['次回ストック', forcedStockLabel],
    ['次回BAR演出', forcedBarAimLabel],
    ['次回バトル演出', forcedBattleLabel],
    ['現在の進行状態', progressStatusText],
  ]

  return (
    <aside
      className="debug-panel debug-panel-right interactive-control"
      style={{ left: `calc(50% + ${offsetPx}px)` }}
      onClick={stopPropagation}
      onTouchStart={stopPropagation}
    >
      <div className="debug-panel-title">DEBUG 状態</div>
      <dl className="debug-status-list">
        {rows.map(([label, value]) => (
          <div key={label} className="debug-status-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
