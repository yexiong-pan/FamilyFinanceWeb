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
  cashflowMetrics: MetricViewModel[];
  supportingMetrics: MetricViewModel[];
  categoryChart: CategoryChartDatum[];
  topCategories: Array<{ name: string; amount: string; percent: number }>;
  memberCashflow: Array<{
    memberName: string;
    income: string;
    expense: string;
    balance: string;
  }>;
}

export function buildMonthlyReportViewModel(summary: DashboardSummary): DashboardViewModel {
  const monthlyExpense = toNumber(summary.monthlyExpense);
  return {
    cashflowMetrics: [
      {
        title: "本月收入",
        value: formatMoney(summary.monthlyIncome),
        tone: "income"
      },
      {
        title: "本月支出",
        value: formatMoney(summary.monthlyExpense),
        tone: "expense"
      },
      {
        title: "本月结余",
        value: formatMoney(summary.monthlyBalance),
        tone: toNumber(summary.monthlyBalance) >= 0 ? "income" : "expense"
      }
    ],
    supportingMetrics: [
      {
        title: "家庭净资产",
        value: formatMoney(summary.netAssets),
        tone: "asset"
      },
      {
        title: "总负债",
        value: formatMoney(summary.totalLiabilities),
        tone: "expense"
      },
      {
        title: "投资收益",
        value: formatMoney(summary.investmentProfit),
        trend: `收益率 ${(summary.investmentProfitRate * 100).toFixed(2)}%`,
        tone: toNumber(summary.investmentProfit) >= 0 ? "income" : "expense"
      }
    ],
    categoryChart: [...summary.categoryBreakdown]
      .sort((left, right) => toNumber(right.amount) - toNumber(left.amount))
      .slice(0, 5)
      .map((item) => ({
        type: item.categoryName,
        value: toNumber(item.amount)
      })),
    topCategories: summary.categoryBreakdown.slice(0, 5).map((item) => ({
      name: item.categoryName,
      amount: formatMoney(item.amount),
      percent: monthlyExpense === 0 ? 0 : Math.round((toNumber(item.amount) / monthlyExpense) * 1000) / 10
    })),
    memberCashflow: summary.memberBreakdown.map((item) => ({
      memberName: item.memberName,
      income: formatMoney(item.income),
      expense: formatMoney(item.expense),
      balance: formatMoney(fromCents(toCents(item.income) - toCents(item.expense)))
    }))
  };
}

function toNumber(value: string): number {
  return Number.parseFloat(value);
}

function toCents(value: string): number {
  return Math.round(toNumber(value) * 100);
}

function fromCents(value: number): string {
  return (value / 100).toFixed(2);
}
