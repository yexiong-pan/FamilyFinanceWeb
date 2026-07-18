import type { ColumnConfig, LineConfig, PieConfig } from "@ant-design/charts";
import { lazy, Suspense } from "react";

const LazyPie = lazy(async () => ({ default: (await import("@ant-design/charts")).Pie }));
const LazyLine = lazy(async () => ({ default: (await import("@ant-design/charts")).Line }));
const LazyColumn = lazy(async () => ({ default: (await import("@ant-design/charts")).Column }));

function ChartFallback() {
  return <div className="chart-loading" role="status">图表加载中</div>;
}

export function Pie(props: PieConfig) {
  return <Suspense fallback={<ChartFallback />}><LazyPie {...props} /></Suspense>;
}

export function Line(props: LineConfig) {
  return <Suspense fallback={<ChartFallback />}><LazyLine {...props} /></Suspense>;
}

export function Column(props: ColumnConfig) {
  return <Suspense fallback={<ChartFallback />}><LazyColumn {...props} /></Suspense>;
}
