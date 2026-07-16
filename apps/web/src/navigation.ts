export type PageKey = "report" | "spending" | "income" | "checkup" | "settings";
export type CashflowTabKey = "summary" | "details";
export type CheckupTabKey = "assets" | "liabilities" | "investments" | "history";
export type ReportTabKey = "monthly" | "yearly";
export type MonthlyReviewItemKey = "spending" | "assets" | "liabilities" | "investments";

export type AppRoute =
  | { page: "report"; tab: ReportTabKey }
  | { page: "spending"; tab: CashflowTabKey }
  | { page: "income"; tab: CashflowTabKey }
  | { page: "checkup"; tab: CheckupTabKey }
  | { page: "settings" };

export const pageMenuItems: Array<{ key: PageKey; label: string }> = [
  { key: "report", label: "报表" },
  { key: "spending", label: "支出" },
  { key: "income", label: "收入" },
  { key: "checkup", label: "财务盘点" },
  { key: "settings", label: "设置" }
];

const routePaths = new Map<string, AppRoute>([
  ["/", { page: "report", tab: "monthly" }],
  ["/report", { page: "report", tab: "monthly" }],
  ["/report/monthly", { page: "report", tab: "monthly" }],
  ["/report/yearly", { page: "report", tab: "yearly" }],
  ["/dashboard", { page: "report", tab: "monthly" }],
  ["/spending", { page: "spending", tab: "summary" }],
  ["/spending/summary", { page: "spending", tab: "summary" }],
  ["/spending/details", { page: "spending", tab: "details" }],
  ["/transactions", { page: "spending", tab: "summary" }],
  ["/income", { page: "income", tab: "summary" }],
  ["/income/summary", { page: "income", tab: "summary" }],
  ["/income/details", { page: "income", tab: "details" }],
  ["/checkup", { page: "checkup", tab: "assets" }],
  ["/checkup/assets", { page: "checkup", tab: "assets" }],
  ["/checkup/liabilities", { page: "checkup", tab: "liabilities" }],
  ["/checkup/investments", { page: "checkup", tab: "investments" }],
  ["/checkup/history", { page: "checkup", tab: "history" }],
  ["/accounts", { page: "checkup", tab: "assets" }],
  ["/asset-history", { page: "checkup", tab: "history" }],
  ["/liabilities", { page: "checkup", tab: "liabilities" }],
  ["/investments", { page: "checkup", tab: "investments" }],
  ["/budgets", { page: "report", tab: "monthly" }],
  ["/settings", { page: "settings" }]
]);

export function defaultRouteForPage(page: PageKey): AppRoute {
  if (page === "report") return { page, tab: "monthly" };
  if (page === "spending" || page === "income") return { page, tab: "summary" };
  if (page === "checkup") return { page, tab: "assets" };
  return { page };
}

export function pathForRoute(route: AppRoute): string {
  if (route.page === "report" || route.page === "spending" || route.page === "income" || route.page === "checkup") {
    return `/${route.page}/${route.tab}`;
  }
  return `/${route.page}`;
}

export function pathForPage(page: PageKey): string {
  return pathForRoute(defaultRouteForPage(page));
}

export function routeForMonthlyReview(item: MonthlyReviewItemKey): AppRoute {
  if (item === "spending") return { page: "spending", tab: "details" };
  return { page: "checkup", tab: item };
}

export function routeFromPath(pathname: string): AppRoute {
  return routePaths.get(normalizePath(pathname)) ?? { page: "report", tab: "monthly" };
}

export function shiftMonthKey(month: string, offset: -1 | 1): string {
  const [yearPart, monthPart] = month.split("-");
  const date = new Date(Date.UTC(Number(yearPart), Number(monthPart) - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function pageFromPath(pathname: string): PageKey {
  return routeFromPath(pathname).page;
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}
