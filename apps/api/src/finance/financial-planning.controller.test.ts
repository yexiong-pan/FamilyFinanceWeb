import { describe, expect, it, vi } from "vitest";
import { FinancialPlanningController } from "./financial-planning.controller";

describe("FinancialPlanningController", () => {
  it("delegates financial safety and monthly review commands", async () => {
    const service = {
      getFinancialSafety: vi.fn(async (month: string) => ({ summary: { month } })),
      updateMonthlyReviewContent: vi.fn(async (month: string, content: unknown) => ({ month, content })),
      createMonthlyReviewAction: vi.fn(async (month: string, action: unknown) => ({ month, ...action as object }))
    };
    const controller = new FinancialPlanningController(service as never);

    await expect(controller.getFinancialSafety("2026-07")).resolves.toEqual({
      summary: { month: "2026-07" }
    });
    await expect(controller.updateMonthlyReviewContent({
      month: "2026-07",
      summary: "本月结余改善"
    })).resolves.toEqual({
      month: "2026-07",
      content: { summary: "本月结余改善" }
    });
    await expect(controller.createMonthlyReviewAction({
      month: "2026-07",
      title: "降低弹性支出"
    })).resolves.toEqual({
      month: "2026-07",
      title: "降低弹性支出"
    });

    expect(service.updateMonthlyReviewContent).toHaveBeenCalledWith(
      "2026-07",
      { summary: "本月结余改善" }
    );
    expect(service.createMonthlyReviewAction).toHaveBeenCalledWith(
      "2026-07",
      { title: "降低弹性支出" }
    );
  });
});
