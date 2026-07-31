import { describe, expect, it } from "vitest";
import { quickRecordItems } from "./QuickRecordFloatButton";

describe("quickRecordItems", () => {
  it("keeps the six global health shortcuts in the intended order", () => {
    expect(quickRecordItems.map((item) => item.key)).toEqual([
      "glucose",
      "body",
      "exercise",
      "strength",
      "medication",
      "more"
    ]);
  });
});
