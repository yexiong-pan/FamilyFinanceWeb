import { describe, expect, it } from "vitest";
import type { AccountTypeOption } from "@family-finance/shared";
import { accountTypeOptionsFromSettings, getAccountTypeMeta } from "./accountTypes";

describe("account type helpers", () => {
  it("builds account form options from active settings entries", () => {
    const accountTypes: AccountTypeOption[] = [
      { id: "type-1", name: "银行卡", isDefault: true, isActive: true },
      { id: "type-2", name: "券商理财", isDefault: false, isActive: true },
      { id: "type-3", name: "停用类型", isDefault: false, isActive: false }
    ];

    expect(accountTypeOptionsFromSettings(accountTypes)).toEqual([
      { label: "银行卡", value: "银行卡" },
      { label: "券商理财", value: "券商理财" }
    ]);
  });

  it("renders unknown account types with the original value", () => {
    expect(getAccountTypeMeta("bankCard")).toEqual({ label: "银行卡", color: "blue" });
    expect(getAccountTypeMeta("银行卡")).toEqual({ label: "银行卡", color: "blue" });
    expect(getAccountTypeMeta("券商理财")).toEqual({ label: "券商理财", color: "default" });
  });
});
