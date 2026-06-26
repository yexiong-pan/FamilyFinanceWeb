import { describe, expect, it } from "vitest";
import { illustrationThemeTokens } from "./illustrationTheme";

describe("illustration theme", () => {
  it("uses the requested illustration style tokens", () => {
    expect(illustrationThemeTokens).toMatchObject({
      colorText: "#2C2C2C",
      colorPrimary: "#52C41A",
      colorBorder: "#2C2C2C",
      colorBorderSecondary: "#2C2C2C",
      lineWidth: 3,
      lineWidthBold: 3,
      borderRadius: 12,
      borderRadiusLG: 16,
      borderRadiusSM: 8,
      colorBgBase: "#FFF9F0",
      colorBgContainer: "#FFFFFF"
    });
  });
});
