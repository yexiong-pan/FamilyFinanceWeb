import { expect, test } from "@playwright/test";

test("monthly report and checkup routes render", async ({ page }) => {
  await page.goto("/report/monthly?month=2026-06");
  await expect(page.getByRole("heading", { name: "2026年6月家庭月报" })).toBeVisible();
  await page.goto("/checkup/history?month=2026-07");
  await expect(page.getByText("月度对比")).toBeVisible();
});

test("cashflow filters stay in the route and return paged totals", async ({ page }) => {
  await page.goto("/spending/details?month=2026-06&status=confirmed");
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.getByRole("button", { name: /^筛选/ }).click();
  }
  await expect(page.getByText(/当前筛选 \d+ 笔/)).toBeVisible();
  await expect(page).toHaveURL(/status=confirmed/);
});
