import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MortgageService } from "./mortgage.service";

function serviceWith(prisma: Record<string, unknown> = {}) {
  const financeRepository = { ensureBaseData: vi.fn().mockResolvedValue(undefined) };
  return new MortgageService(prisma as never, financeRepository as never);
}

describe("MortgageService safeguards", () => {
  it("rejects excessive or non-integer periods before writing data", async () => {
    const transaction = vi.fn();
    const service = serviceWith({ $transaction: transaction });
    await expect(service.createMortgage({
      name: "住房组合贷",
      ownerName: "测试成员",
      repaymentDay: 20,
      parts: [{
        kind: "commercial",
        name: "商业贷",
        initialPrincipal: "100000.00",
        outstandingPrincipal: "100000.00",
        annualRate: "3.05",
        rateType: "lprFloating",
        repaymentMethod: "equalPrincipalAndInterest",
        firstRepaymentDate: "2026-08-20",
        totalPeriods: 100_000
      }]
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("does not use a future rate as the current rate in adjustment previews", async () => {
    const service = serviceWith({
      mortgageLoanPart: {
        findFirst: vi.fn().mockResolvedValue({
          id: "part-1",
          kind: "commercial",
          name: "商业贷",
          initialPrincipal: "1380000.00",
          outstandingPrincipal: "1321515.30",
          rateType: "lprFloating",
          occupancyType: "first",
          lprSpread: "-0.45",
          repricingCycleMonths: 6,
          repricingDate: new Date("2026-12-25T00:00:00.000Z"),
          repaymentMethod: "equalPrincipalAndInterest",
          firstRepaymentDate: new Date("2024-07-20T00:00:00.000Z"),
          totalPeriods: 360,
          remainingPeriods: 334,
          rateVersions: [
            { id: "future", annualRate: "2.95", effectiveDate: new Date("2026-10-20T00:00:00.000Z"), source: "bankNotice", lprValue: null, lprPublishedMonth: null, policyVersion: null, evidenceNote: null },
            { id: "current", annualRate: "3.05", effectiveDate: new Date("2024-06-25T00:00:00.000Z"), source: "contract", lprValue: null, lprPublishedMonth: null, policyVersion: null, evidenceNote: null }
          ],
          actualRepayments: []
        })
      }
    });
    const preview = await service.previewRateAdjustment("mortgage-1", {
      loanPartId: "part-1",
      annualRate: "2.85",
      effectiveDate: "2026-08-20",
      source: "bankNotice"
    });
    expect(preview.oldAnnualRate).toBe("3.05");
  });
});
