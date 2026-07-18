import type { CashflowFilters } from "./cashflow-route";

export function buildTransactionPageQuery(input: {
  month: string;
  kind: "expense" | "income";
  page: number;
  pageSize: number;
  filters: CashflowFilters;
}): string {
  const params = new URLSearchParams({
    month: input.month,
    kind: input.kind,
    page: String(input.page),
    pageSize: String(input.pageSize)
  });
  const { category, member, status, min, max } = input.filters;
  if (category) params.set("category", category);
  if (member) params.set("member", member);
  if (status) params.set("status", status);
  if (min !== undefined) params.set("min", String(min));
  if (max !== undefined) params.set("max", String(max));
  return params.toString();
}

export function countActiveCashflowFilters(filters: CashflowFilters): number {
  return [filters.category, filters.member, filters.status, filters.min, filters.max]
    .filter((value) => value !== undefined && value !== "").length;
}
