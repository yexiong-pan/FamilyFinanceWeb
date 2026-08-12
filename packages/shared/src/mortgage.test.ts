import { describe, expect, it } from "vitest";
import { addMonthsClamped, buildFullMortgageInstallments, buildMortgageInstallments, isValidBusinessDate, monthlyOccurrenceDatesBetween, mortgageRateAt, previewMortgageRateAdjustment } from "./mortgage";

describe("mortgage calculations", () => {
  it("clears principal exactly on the final equal-payment installment", () => {
    const installments = buildMortgageInstallments({
      outstandingPrincipal: "100000.00",
      annualRate: "3.00",
      repaymentMethod: "equalPrincipalAndInterest",
      remainingPeriods: 12,
      firstRepaymentDate: "2026-01-20"
    });
    expect(installments).toHaveLength(12);
    expect(installments.reduce((total, item) => total + Number(item.principal), 0)).toBeCloseTo(100000, 2);
    expect(installments.at(-1)?.dueDate).toBe("2026-12-20");
  });

  it("reduces monthly payment and interest when a rate falls", () => {
    const preview = previewMortgageRateAdjustment({
      outstandingPrincipal: "1000000.00",
      currentAnnualRate: "3.90",
      adjustedAnnualRate: "3.20",
      repaymentMethod: "equalPrincipalAndInterest",
      remainingPeriods: 240
    });
    expect(Number(preview.adjustedMonthlyPayment)).toBeLessThan(Number(preview.currentMonthlyPayment));
    expect(Number(preview.adjustedRemainingInterest)).toBeLessThan(Number(preview.currentRemainingInterest));
  });

  it("uses actual statements for paid periods and rate history for plan periods", () => {
    const installments = buildFullMortgageInstallments({
      initialPrincipal: "100000.00",
      repaymentMethod: "equalPrincipalAndInterest",
      totalPeriods: 3,
      firstRepaymentDate: "2024-07-20",
      rateVersions: [
        { annualRate: "3.50", effectiveDate: "2024-06-25" },
        { annualRate: "3.05", effectiveDate: "2024-08-01" }
      ],
      actualRepayments: [{ id: "statement-1", sequence: 1, dueDate: "2024-07-20", principal: "2171.82", interest: "3354.17", source: "bankStatement" }],
      forecastOutstandingPrincipal: "95000.00"
    });

    expect(installments[0]).toMatchObject({ dueDate: "2024-07-20", principal: "2171.82", interest: "3354.17", status: "paid", annualRate: "3.50" });
    expect(installments[1]).toMatchObject({ dueDate: "2024-08-20", status: "planned", annualRate: "3.05" });
    expect(Number(installments[1]!.interest)).toBeCloseTo(95000 * 3.05 / 100 / 12, 2);
  });

  it("clamps month-end repayment dates instead of overflowing into another month", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2024-01-31", 1)).toBe("2024-02-29");
    expect(buildMortgageInstallments({
      outstandingPrincipal: "1000.00",
      annualRate: "3.00",
      repaymentMethod: "equalPrincipalAndInterest",
      remainingPeriods: 3,
      firstRepaymentDate: "2026-01-31"
    }).map((item) => item.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("rejects normalized invalid dates and does not apply a future rate early", () => {
    expect(isValidBusinessDate("2026-02-31")).toBe(false);
    expect(isValidBusinessDate("2026-02-28")).toBe(true);
    const rates = [
      { annualRate: "3.05", effectiveDate: "2024-06-25" },
      { annualRate: "2.95", effectiveDate: "2026-10-20" }
    ];
    expect(mortgageRateAt(rates, "2026-08-20")).toBe("3.05");
    expect(mortgageRateAt(rates, "2026-10-20")).toBe("2.95");
  });

  it("includes a contribution from the next month when it lands before repayment", () => {
    expect(monthlyOccurrenceDatesBetween("2026-07-31", "2026-08-20", 11)).toEqual(["2026-08-11"]);
    expect(monthlyOccurrenceDatesBetween("2026-08-11", "2026-08-20", 11)).toEqual([]);
    expect(monthlyOccurrenceDatesBetween("2026-01-31", "2026-02-28", 31)).toEqual(["2026-02-28"]);
  });
});
