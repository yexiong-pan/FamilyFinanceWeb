import { describe, expect, it } from "vitest";
import { quickRecordItems } from "./QuickRecordFloatButton";

describe("quickRecordItems", () => {
  it("keeps the global quick shortcuts in the intended order", () => {
    expect(quickRecordItems.map((item) => item.key)).toEqual([
      "schedule",
      "glucose",
      "body",
      "exercise",
      "strength",
      "medication",
      "more"
    ]);
  });
});
