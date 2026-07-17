import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RatioProgress } from "./RatioProgress";

describe("RatioProgress", () => {
  it("renders the percentage in a fixed external column", () => {
    const markup = renderToStaticMarkup(<RatioProgress percent={32.4} />);

    expect(markup).toContain("ratio-progress");
    expect(markup).toContain("ratio-progress-value");
    expect(markup).toContain("32.4%");
    expect(markup).not.toContain("ant-progress-text");
  });

  it("uses the shared danger style for exceptional progress", () => {
    const markup = renderToStaticMarkup(<RatioProgress percent={100} tone="danger" />);

    expect(markup).toContain("is-danger");
  });
});
