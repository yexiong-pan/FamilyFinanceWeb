import type { DashboardSummary } from "@family-finance/shared";
import { formatMoney } from "@family-finance/shared";

export type MetricTone = "asset" | "income" | "expense";

export interface MetricViewModel {
  title: string;
  value: string;
  trend?: string;
  tone: MetricTone;
}

export interface CategoryChartDatum {
  type: string;
  value: number;
}

export interface BudgetHighlight {
  id: string;
  categoryName: string;
  percent: number;
  status: "normal" | "warning" | "over";
}

export interface DashboardViewModel {
  metrics: MetricViewModel[];
  categoryChart: CategoryChartDatum[];
  budgetHighlights: BudgetHighlight[];
}

export function buildDashboardViewModel(summary: DashboardSummary): DashboardViewModel {
  return {
    metrics: [
      {
        title: "当前总资产",
        value: formatMoney(summary.totalAssets),
        tone: "asset"
      },
      {
        title: "净资产",
        value: formatMoney(summary.netAssets),
        trend: `总负债 ${formatMoney(summary.totalLiabilities)}`,
        tone: "asset"
      },
      {
        title: "本月应还",
        value: formatMoney(summary.monthlyDebtPayment),
        trend: "负债月供合计",
        tone: "expense"
      },
      {
        title: "本月收入",
        value: formatMoney(summary.monthlyIncome),
        trend: "Owner 可见",
        tone: "income"
      },
      {
        title: "本月支出",
        value: formatMoney(summary.monthlyExpense),
        trend: "按分类追踪",
        tone: "expense"
      },
      {
        title: "本月结余",
        value: formatMoney(summary.monthlyBalance),
        trend: toNumber(summary.monthlyBalance) >= 0 ? "收支健康" : "需要关注",
        tone: toNumber(summary.monthlyBalance) >= 0 ? "income" : "expense"
      },
      {
        title: "投资收益",
        value: formatMoney(summary.investmentProfit),
        trend: `收益率 ${(summary.investmentProfitRate * 100).toFixed(2)}%`,
        tone: toNumber(summary.investmentProfit) >= 0 ? "income" : "expense"
      }
    ],
    categoryChart: summary.categoryBreakdown.map((item) => ({
      type: item.categoryName,
      value: toNumber(item.amount)
    })),
    budgetHighlights: summary.budgetUsages.map((budget) => ({
      id: budget.id,
      categoryName: budget.categoryName,
      percent: Math.min(100, Math.round(budget.usageRate * 100)),
      status: budget.status
    }))
  };
}

function toNumber(value: string): number {
  return Number.parseFloat(value);
}
