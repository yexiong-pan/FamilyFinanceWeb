import { formatMoney, type Liability } from "@family-finance/shared";

export function financialMetricValue(value: string, reviewed: boolean): string {
  return reviewed ? formatMoney(value) : "未盘点";
}

export function yearlySnapshotLabel(snapshotMonth: string | undefined, complete: boolean): string {
  if (!snapshotMonth) return "净资产";
  if (snapshotMonth.endsWith("-12") && complete) return "年末净资产";
  return `截至${Number(snapshotMonth.slice(5, 7))}月净资产${complete ? "" : "（盘点未完整）"}`;
}

export function buildLiabilityCoverage(
  liabilities: Array<Pick<Liability, "initialBalance" | "currentBalance">>
): { tracked: number; total: number; coveragePercent: number; repaymentPercent: number } {
  const trackedItems = liabilities.filter((item) => Number(item.initialBalance) > 0);
  const initial = trackedItems.reduce((sum, item) => sum + Number(item.initialBalance), 0);
  const current = trackedItems.reduce((sum, item) => sum + Number(item.currentBalance), 0);
  return {
    tracked: trackedItems.length,
    total: liabilities.length,
    coveragePercent: liabilities.length === 0 ? 0 : Math.round((trackedItems.length / liabilities.length) * 100),
    repaymentPercent: initial === 0 ? 0 : Math.round(Math.max(0, Math.min(100, (1 - current / initial) * 100)) * 10) / 10
  };
}

type ComparableSnapshotSummary = {
  totalAssets: string;
  totalLiabilities: string;
  netAssets: string;
  investmentMarketValue: string;
};

export function snapshotComparisonRows(current: ComparableSnapshotSummary, compared: ComparableSnapshotSummary) {
  return [
    ["总资产", "totalAssets"],
    ["总负债", "totalLiabilities"],
    ["净资产", "netAssets"],
    ["投资市值", "investmentMarketValue"]
  ].map(([label, key]) => {
    const currentValue = current[key as keyof ComparableSnapshotSummary];
    const comparedValue = compared[key as keyof ComparableSnapshotSummary];
    return {
      label,
      current: currentValue,
      compared: comparedValue,
      change: (Number(currentValue) - Number(comparedValue)).toFixed(2)
    };
  });
}
