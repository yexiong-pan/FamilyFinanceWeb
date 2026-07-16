import { describe, expect, it } from "vitest";
import {
  buildInvestmentAmountsFromProfit,
  investmentCostValue,
  investmentReturnRateValue
} from "./investment";

describe("buildInvestmentAmountsFromProfit", () => {
  it("derives investment cost and rate from current value and holding profit", () => {
    expect(buildInvestmentAmountsFromProfit("11250", "1250")).toEqual({
      investedAmount: "10000.00",
      marketValue: "11250.00",
      profit: "1250.00",
      profitRate: 0.125
    });
  });

  it("supports a negative holding profit", () => {
    expect(buildInvestmentAmountsFromProfit("9000", "-1000")).toEqual({
      investedAmount: "10000.00",
      marketValue: "9000.00",
      profit: "-1000.00",
      profitRate: -0.1
    });
  });

  it("handles a zero investment cost without an invalid rate", () => {
    expect(buildInvestmentAmountsFromProfit("0", "0").profitRate).toBe(0);
  });
});

describe("investment sorting values", () => {
  it("uses stored or derived cost and calculates a comparable return rate", () => {
    expect(investmentCostValue({ marketValue: "11250.00", profit: "1250.00", investedAmount: "10000.00" })).toBe(10000);
    expect(investmentCostValue({ marketValue: "9000.00", profit: "-1000.00" })).toBe(10000);
    expect(investmentReturnRateValue({ marketValue: "9000.00", profit: "-1000.00" })).toBe(-0.1);
    expect(investmentReturnRateValue({ marketValue: "0.00", profit: "0.00", investedAmount: "0.00" })).toBe(0);
  });
});
