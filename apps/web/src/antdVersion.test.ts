import antdPackage from "antd/package.json";
import { describe, expect, it } from "vitest";

describe("Ant Design dependency", () => {
  it("uses Ant Design 6", () => {
    expect(antdPackage.version.split(".")[0]).toBe("6");
  });
});
