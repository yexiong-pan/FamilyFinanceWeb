import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Pie } from "./LazyCharts";

describe("LazyCharts", () => {
  it("renders an accessible loading fallback before the chart bundle loads", () => {
    const markup = renderToStaticMarkup(<Pie data={[]} angleField="value" colorField="type" />);
    expect(markup).toContain("图表加载中");
    expect(markup).toContain("role=\"status\"");
  });
});
