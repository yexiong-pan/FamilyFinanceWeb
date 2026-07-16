import { expect, it } from "vitest";
import { buildMobileTransactionCard, paginateMobileRecords } from "./mobile";

it("builds a compact mobile transaction card with source and confirmation state", () => {
  expect(buildMobileTransactionCard({
    id: "1",
    date: "2026-07-15",
    kind: "expense",
    categoryName: "餐饮",
    memberName: "雄哥",
    amount: "18.88",
    source: "wechat",
    note: "午餐"
  })).toEqual({
    date: "2026-07-15",
    categoryName: "餐饮",
    memberName: "雄哥",
    amount: "18.88",
    sourceLabel: "微信",
    pending: true,
    note: "午餐"
  });
});

it("renders only the requested mobile page and clamps pages after data shrinks", () => {
  const records = Array.from({ length: 45 }, (_, index) => index + 1);

  expect(paginateMobileRecords(records, 2, 20)).toEqual({
    items: records.slice(20, 40),
    page: 2,
    total: 45
  });
  expect(paginateMobileRecords(records.slice(0, 8), 3, 20)).toEqual({
    items: records.slice(0, 8),
    page: 1,
    total: 8
  });
});
