/**
 * 開発サーバー（import.meta.env.DEV）専用デバッグパネルの選択肢と、選択値→抽選オプションへの変換。
 * 本番ビルドでは main.tsx 側で DEV 判定し、ここの結果は使われない。
 *
 * - UI: src/components/cabinet/DebugPanels.tsx
 * - 抽選本体: src/engine.ts drawSpin / resolveDebugBattleSelection
 * - テスト: src/game/game.test.ts（npm run test:game）
 *
 * デバッグ用の強制役を追加する場合は DEBUG_SPIN_ROLE_OPTIONS と resolveDebugSpinRequest の両方を確認する。
 */
import { SPIN_ROLES } from '../engine.ts'
import type { SpinOutcomeOptions } from '../engine.ts'

export type ForcedStockMode = 'auto' | 'win' | 'lose'
export type ForcedBarAimMode = 'auto' | 'on' | 'off'

export interface DebugOption<T extends string = string> {
  id: T
  label: string
}

/** 強制役指定の選択肢（スイカはストック有無を分けて提示する） */
export const DEBUG_SPIN_ROLE_OPTIONS: readonly DebugOption[] = [
  ...SPIN_ROLES.filter((r) => r.id !== 'melon' && r.id !== 'premium_bar').map((r) => ({ id: r.id, label: r.label })),
  { id: 'melon:no_stock', label: 'スイカ（ストックなし）' },
  { id: 'melon:stock', label: 'スイカ（ストックあり）' },
  ...SPIN_ROLES.filter((r) => r.id === 'premium_bar').map((r) => ({ id: r.id, label: r.label })),
]

export const DEBUG_STOCK_MODE_OPTIONS: readonly DebugOption<ForcedStockMode>[] = [
  { id: 'auto', label: '通常抽選' },
  { id: 'win', label: 'ストックあり' },
  { id: 'lose', label: 'ストックなし' },
]

export const DEBUG_BAR_AIM_MODE_OPTIONS: readonly DebugOption<ForcedBarAimMode>[] = [
  { id: 'auto', label: '通常抽選' },
  { id: 'on', label: '強制発生' },
  { id: 'off', label: '発生なし' },
]

/**
 * デバッグパネルの選択値を drawSpin へ渡す強制役IDとオプションへ変換する。
 * 'melon:stock' / 'melon:no_stock' はストック指定より優先する。
 */
export function resolveDebugSpinRequest(
  forcedRole: string | null,
  forcedStock: ForcedStockMode,
  forcedBarAim: ForcedBarAimMode
): { roleId: string | null; options: SpinOutcomeOptions | undefined } {
  let roleId: string | null = forcedRole
  let forcedStockWon: boolean | undefined
  if (forcedRole === 'melon:no_stock') {
    roleId = 'melon'
    forcedStockWon = false
  } else if (forcedRole === 'melon:stock') {
    roleId = 'melon'
    forcedStockWon = true
  } else if (forcedStock === 'win') {
    forcedStockWon = true
  } else if (forcedStock === 'lose') {
    forcedStockWon = false
  }

  const forcedBarAimBool = forcedBarAim === 'on' ? true : forcedBarAim === 'off' ? false : undefined

  if (forcedStockWon === undefined && forcedBarAimBool === undefined) {
    return { roleId, options: undefined }
  }
  return {
    roleId,
    options: {
      ...(forcedStockWon !== undefined ? { forcedStockWon } : {}),
      ...(forcedBarAimBool !== undefined ? { forcedBarAim: forcedBarAimBool } : {}),
    },
  }
}
