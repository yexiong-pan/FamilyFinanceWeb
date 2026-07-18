import type { InvestmentHoldingType } from "@family-finance/shared";

const holdingTypeLabels: Record<InvestmentHoldingType, string> = {
  fund: "基金",
  stock: "股票",
  etf: "ETF"
};

const liquidAccountTypes = new Set(["银行卡", "现金", "支付宝", "微信", "活期", "货币基金"]);

export function buildAssetInsights(
  accounts: Array<{ type: string; currentValue: string; updatedAt?: string }>
): { liquidAmount: number; liquidPercent: number; latestUpdatedAt?: string } {
  const total = accounts.reduce((sum, item) => sum + Number(item.currentValue), 0);
  const liquidAmount = accounts
    .filter((item) => liquidAccountTypes.has(item.type))
    .reduce((sum, item) => sum + Number(item.currentValue), 0);
  const latestUpdatedAt = accounts
    .map((item) => item.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  return {
    liquidAmount,
    liquidPercent: total === 0 ? 0 : Math.round((liquidAmount / total) * 1000) / 10,
    ...(latestUpdatedAt ? { latestUpdatedAt } : {})
  };
}

export function buildInvestmentInsights(
  holdings: Array<{ type: InvestmentHoldingType; marketValue: string }>
): {
  allocation: Array<{ type: string; value: number; percent: number }>;
  topHoldingPercent: number;
} {
  const total = holdings.reduce((sum, item) => sum + Number(item.marketValue), 0);
  const byType = new Map<InvestmentHoldingType, number>();
  for (const holding of holdings) {
    byType.set(holding.type, (byType.get(holding.type) ?? 0) + Number(holding.marketValue));
  }
  const allocation = [...byType.entries()]
    .map(([type, value]) => ({
      type: holdingTypeLabels[type],
      value,
      percent: total === 0 ? 0 : Math.round((value / total) * 1000) / 10
    }))
    .sort((left, right) => right.value - left.value);
  const top = Math.max(0, ...holdings.map((item) => Number(item.marketValue)));
  return {
    allocation,
    topHoldingPercent: total === 0 ? 0 : Math.round((top / total) * 1000) / 10
  };
}

export function buildLiabilityRisk(
  liabilities: Array<{ name: string; currentBalance: string; monthlyPayment?: string }>,
  monthlyIncome: string
): { monthlyPayment: number; debtServiceRate: number; trackable: number; payoffMonths: number | null } {
  const monthlyPayment = liabilities.reduce((sum, item) => sum + Number(item.monthlyPayment ?? 0), 0);
  const trackableItems = liabilities.filter((item) => Number(item.monthlyPayment) > 0);
  const trackable = trackableItems.length;
  const currentBalance = trackableItems.reduce((sum, item) => sum + Number(item.currentBalance), 0);
  return {
    monthlyPayment,
    debtServiceRate: Number(monthlyIncome) <= 0 ? 0 : Math.round((monthlyPayment / Number(monthlyIncome)) * 1000) / 10,
    trackable,
    payoffMonths: monthlyPayment <= 0 ? null : Math.ceil(currentBalance / monthlyPayment)
  };
}
