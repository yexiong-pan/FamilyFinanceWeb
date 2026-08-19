import type { InvestmentRedemptionInput } from "@family-finance/shared";

export interface InvestmentAmounts {
  investedAmount: string;
  marketValue: string;
  profit: string;
  profitRate: number;
}

export interface InvestmentValueLike {
  marketValue: string;
  profit: string;
  investedAmount?: string;
}

export function buildInvestmentAmountsFromProfit(market: string | number, profit: string | number): InvestmentAmounts {
  const marketCents = toCents(market);
  const profitCents = toCents(profit);
  const investedCents = marketCents - profitCents;
  return {
    investedAmount: fromCents(investedCents),
    marketValue: fromCents(marketCents),
    profit: fromCents(profitCents),
    profitRate: investedCents === 0 ? 0 : profitCents / investedCents
  };
}

export function investmentCostValue(investment: InvestmentValueLike): number {
  return Number(investment.investedAmount ?? Number(investment.marketValue) - Number(investment.profit));
}

export function investmentReturnRateValue(investment: InvestmentValueLike): number {
  const cost = investmentCostValue(investment);
  return cost === 0 ? 0 : Number(investment.profit) / cost;
}

export interface InvestmentRedemptionFormValue {
  holdingId: string;
  redemptionAmount?: number;
  contributionAmount?: number;
}

export function buildInvestmentRedemptionInputs(
  values: InvestmentRedemptionFormValue[]
): InvestmentRedemptionInput[] {
  return values.flatMap((item) => {
    const amount = Number(item.redemptionAmount ?? 0);
    if (amount <= 0) return [];
    return [{
      holdingId: item.holdingId,
      redemptionAmount: amount.toFixed(2),
      contributionAmount: Number(item.contributionAmount).toFixed(2)
    }];
  });
}

function toCents(value: string | number): number {
  const normalized = String(value).replace(/,/g, "").trim();
  const sign = normalized.startsWith("-") ? -1 : 1;
  const [integer = "0", fraction = ""] = normalized.replace(/^[+-]/, "").split(".");
  return sign * (Number.parseInt(integer, 10) * 100 + Number.parseInt(`${fraction}00`.slice(0, 2), 10));
}

function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}
