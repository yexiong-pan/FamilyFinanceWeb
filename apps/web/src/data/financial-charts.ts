import type { Account, Liability, YearlyReportMonth } from "@family-finance/shared";

export interface AssetAllocationPoint {
  type: string;
  value: number;
  percent: number;
}

export interface LiabilityProgressPoint {
  id: string;
  name: string;
  initialBalance: number | null;
  currentBalance: number;
  repaidAmount: number | null;
  percent: number | null;
  estimated: boolean;
}

export interface NetWorthTrendPoint {
  month: string;
  type: "总资产" | "总负债" | "净资产";
  amount: number | null;
}

export interface CashflowTrendPoint {
  month: string;
  position: number;
  type: "收入" | "支出" | "结余";
  amount: number;
}

export function buildAssetAllocation(accounts: Account[]): AssetAllocationPoint[] {
  const amountsByType = new Map<string, number>();
  for (const account of accounts) {
    amountsByType.set(account.type, (amountsByType.get(account.type) ?? 0) + Number(account.currentValue));
  }
  const total = [...amountsByType.values()].reduce((sum, amount) => sum + amount, 0);
  const sorted = [...amountsByType.entries()]
    .map(([type, value]) => ({ type, value }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value);
  const visible = sorted.slice(0, 5);
  const otherValue = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
  if (otherValue > 0) visible.push({ type: "其他", value: otherValue });
  return visible.map((item) => ({
    ...item,
    percent: total === 0 ? 0 : Math.round((item.value / total) * 10000) / 100
  }));
}

export function buildLiabilityProgress(liabilities: Liability[]): LiabilityProgressPoint[] {
  return liabilities
    .filter((liability) => liability.status !== "closed")
    .map((liability) => {
      const currentBalance = Math.max(0, Number(liability.currentBalance));
      const hasInitialBalance = liability.initialBalance !== undefined && Number(liability.initialBalance) > 0;
      if (!hasInitialBalance) {
        return {
          id: liability.id,
          name: liability.name,
          initialBalance: null,
          currentBalance,
          repaidAmount: null,
          percent: null,
          estimated: true
        };
      }
      const initialBalance = Math.max(currentBalance, Number(liability.initialBalance));
      const repaidAmount = Math.max(0, initialBalance - currentBalance);
      const percent = initialBalance === 0 ? 100 : Math.round((repaidAmount / initialBalance) * 1000) / 10;
      return {
        id: liability.id,
        name: liability.name,
        initialBalance,
        currentBalance,
        repaidAmount,
        percent,
        estimated: false
      };
    });
}

export function buildNetWorthTrend(months: YearlyReportMonth[]): NetWorthTrendPoint[] {
  return months.flatMap((item) => {
    const month = formatMonth(item.month);
    return [
      { month, type: "总资产" as const, amount: optionalNumber(item.totalAssets) },
      { month, type: "总负债" as const, amount: optionalNumber(item.totalLiabilities) },
      { month, type: "净资产" as const, amount: optionalNumber(item.netAssets) }
    ];
  });
}

export function buildAnnualCashflowTrend(months: YearlyReportMonth[]): {
  columns: CashflowTrendPoint[];
  balance: CashflowTrendPoint[];
} {
  return {
    columns: months.flatMap((item) => {
      const position = monthNumber(item.month);
      return [
        { month: formatMonth(item.month), position: position - 0.18, type: "收入" as const, amount: Number(item.income) },
        { month: formatMonth(item.month), position: position + 0.18, type: "支出" as const, amount: Number(item.expense) }
      ];
    }).map((item) => ({ ...item, position: Math.round(item.position * 100) / 100 })),
    balance: months.map((item) => ({
      month: formatMonth(item.month),
      position: monthNumber(item.month),
      type: "结余" as const,
      amount: Number(item.balance)
    }))
  };
}

function optionalNumber(value?: string): number | null {
  return value === undefined ? null : Number(value);
}

function formatMonth(month: string): string {
  return `${monthNumber(month)}月`;
}

function monthNumber(month: string): number {
  return Number(month.slice(5, 7));
}
