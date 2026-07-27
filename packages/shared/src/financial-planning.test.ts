import { describe, expect, it } from "vitest";
import {
  calculateEmergencyCoverageMonths,
  calculateSafeToSpend
} from "./financial-planning";

describe("financial planning", () => {
  it("reserves obligations, savings and emergency funds before exposing safe spending", () => {
    expect(calculateSafeToSpend({
      liquidAmount: "80000.00",
      expectedIncome: "12000.00",
      requiredExpenses: "10000.00",
      debtPayments: "8000.00",
      plannedSavings: "5000.00",
      emergencyReserve: "50000.00"
    })).toEqual({
      safeToSpend: "19000.00",
      shortfall: "0.00"
    });
  });

  it("reports a shortfall instead of hiding a negative result", () => {
    expect(calculateSafeToSpend({
      liquidAmount: "10000.00",
      expectedIncome: "0.00",
      requiredExpenses: "9000.00",
      debtPayments: "4200.00",
      plannedSavings: "0.00",
      emergencyReserve: "0.00"
    })).toEqual({
      safeToSpend: "0.00",
      shortfall: "3200.00"
    });
  });

  it("calculates emergency coverage only when essential spending is known", () => {
    expect(calculateEmergencyCoverageMonths("50000.00", "10000.00")).toBe(5);
    expect(calculateEmergencyCoverageMonths("50000.00", "0.00")).toBeUndefined();
  });
});
