import { type CashflowFilters, writeCashflowFilters } from "./data/cashflow-route";

export type PageKey = "report" | "spending" | "income" | "checkup" | "mortgage" | "calendar" | "health" | "settings";
export type CashflowTabKey = "summary" | "details";
export type CheckupTabKey = "assets" | "safety" | "liabilities" | "investments" | "history";
export type ReportTabKey = "monthly" | "yearly";
export type CalendarTabKey = "month" | "year" | "events";
export type HealthTabKey = "overview" | "glucose" | "medication" | "body";
export type MortgageTabKey = "overview" | "plan" | "rates" | "provident";
export type MonthlyReviewItemKey = "income" | "spending" | "assets" | "liabilities" | "investments";

export type AppRoute =
  | { page: "report"; tab: ReportTabKey }
  | { page: "spending"; tab: CashflowTabKey }
  | { page: "income"; tab: CashflowTabKey }
  | { page: "checkup"; tab: CheckupTabKey }
  | { page: "mortgage"; tab: MortgageTabKey }
  | { page: "calendar"; tab: CalendarTabKey }
  | { page: "health"; tab: HealthTabKey }
  | { page: "settings" };

export const pageMenuItems: Array<{ key: PageKey; label: string }> = [
  { key: "report", label: "报表" },
  { key: "spending", label: "支出" },
  { key: "income", label: "收入" },
  { key: "checkup", label: "财务盘点" },
  { key: "mortgage", label: "房贷公积金" },
  { key: "calendar", label: "日历" },
  { key: "health", label: "健康" },
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
  ["/checkup/safety", { page: "checkup", tab: "safety" }],
  ["/checkup/liabilities", { page: "checkup", tab: "liabilities" }],
  ["/checkup/investments", { page: "checkup", tab: "investments" }],
  ["/checkup/history", { page: "checkup", tab: "history" }],
  ["/accounts", { page: "checkup", tab: "assets" }],
  ["/asset-history", { page: "checkup", tab: "history" }],
  ["/liabilities", { page: "checkup", tab: "liabilities" }],
  ["/investments", { page: "checkup", tab: "investments" }],
  ["/mortgage", { page: "mortgage", tab: "overview" }],
  ["/mortgage/overview", { page: "mortgage", tab: "overview" }],
  ["/mortgage/plan", { page: "mortgage", tab: "plan" }],
  ["/mortgage/rates", { page: "mortgage", tab: "rates" }],
  ["/mortgage/provident", { page: "mortgage", tab: "provident" }],
  ["/calendar", { page: "calendar", tab: "month" }],
  ["/calendar/month", { page: "calendar", tab: "month" }],
  ["/calendar/year", { page: "calendar", tab: "year" }],
  ["/calendar/events", { page: "calendar", tab: "events" }],
  ["/health", { page: "health", tab: "overview" }],
  ["/health/overview", { page: "health", tab: "overview" }],
  ["/health/glucose", { page: "health", tab: "glucose" }],
  ["/health/medication", { page: "health", tab: "medication" }],
  ["/health/body", { page: "health", tab: "body" }],
  ["/budgets", { page: "report", tab: "monthly" }],
  ["/settings", { page: "settings" }]
]);

export function defaultRouteForPage(page: PageKey): AppRoute {
  if (page === "report") return { page, tab: "monthly" };
  if (page === "spending" || page === "income") return { page, tab: "summary" };
  if (page === "checkup") return { page, tab: "assets" };
  if (page === "mortgage") return { page, tab: "overview" };
  if (page === "calendar") return { page, tab: "month" };
  if (page === "health") return { page, tab: "overview" };
  return { page };
}

export function pathForRoute(route: AppRoute): string {
  if (route.page !== "settings") {
    return `/${route.page}/${route.tab}`;
  }
  return `/${route.page}`;
}

export function pathForPage(page: PageKey): string {
  return pathForRoute(defaultRouteForPage(page));
}

export function routeForMonthlyReview(item: MonthlyReviewItemKey): AppRoute {
  if (item === "income") return { page: "income", tab: "details" };
  if (item === "spending") return { page: "spending", tab: "details" };
  return { page: "checkup", tab: item };
}

export function routeFromPath(pathname: string): AppRoute {
  return routePaths.get(normalizePath(pathname)) ?? { page: "report", tab: "monthly" };
}

export function shiftMonthKey(month: string, offset: number): string {
  const [yearPart, monthPart] = month.split("-");
  const date = new Date(Date.UTC(Number(yearPart), Number(monthPart) - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function urlForRoute(
  route: AppRoute,
  month: string,
  filters: CashflowFilters = {},
  calendarMember = "all",
  calendarDensity: "compact" | "detail" = "compact"
): string {
  const params = new URLSearchParams();
  if (
    (route.page === "report" && route.tab === "yearly")
    || (route.page === "calendar" && route.tab === "year")
  ) {
    params.set("year", month.slice(0, 4));
  } else {
    params.set("month", month);
  }
  if (route.page === "calendar" && calendarMember !== "all") {
    params.set("member", calendarMember);
  }
  if (route.page === "calendar" && route.tab === "month" && calendarDensity === "detail") {
    params.set("density", "detail");
  }

  const routeParams = route.page === "spending" || route.page === "income"
    ? writeCashflowFilters(params, filters)
    : params;
  return `${pathForRoute(route)}?${routeParams.toString()}`;
}

export function cashflowFiltersForTransition(
  currentRoute: AppRoute,
  nextRoute: AppRoute,
  currentFilters: CashflowFilters,
  suppliedFilters?: CashflowFilters
): CashflowFilters {
  if (nextRoute.page !== "spending" && nextRoute.page !== "income") return {};
  if (suppliedFilters) return suppliedFilters;
  return currentRoute.page === nextRoute.page ? currentFilters : {};
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
