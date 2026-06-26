import type { DashboardSummary } from "@family-finance/shared";
import { formatMoney } from "@family-finance/shared";

export interface MetricViewModel {
  title: string;
  value: string;
  trend?: string;
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
        value: formatMoney(summary.totalAssets)
      },
      {
        title: "本月收入",
        value: formatMoney(summary.monthlyIncome),
        trend: "Owner 可见"
      },
      {
        title: "本月支出",
        value: formatMoney(summary.monthlyExpense),
        trend: "按分类追踪"
      },
      {
        title: "本月结余",
        value: formatMoney(summary.monthlyBalance),
        trend: toNumber(summary.monthlyBalance) >= 0 ? "收支健康" : "需要关注"
      },
      {
        title: "投资收益",
        value: formatMoney(summary.investmentProfit),
        trend: `收益率 ${(summary.investmentProfitRate * 100).toFixed(2)}%`
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
