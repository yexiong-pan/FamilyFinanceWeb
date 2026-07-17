export type CashflowConfirmationStatus = "pending" | "confirmed";

export interface CashflowFilters {
  category?: string;
  member?: string;
  status?: CashflowConfirmationStatus;
  min?: number;
  max?: number;
}

const filterKeys = ["category", "member", "status", "min", "max"] as const;

function parseText(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function parseAmount(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

export function parseCashflowFilters(params: URLSearchParams): CashflowFilters {
  const category = parseText(params.get("category"));
  const member = parseText(params.get("member"));
  const rawStatus = params.get("status");
  const status = rawStatus === "pending" || rawStatus === "confirmed" ? rawStatus : undefined;
  const min = parseAmount(params.get("min"));
  const max = parseAmount(params.get("max"));

  return {
    ...(category ? { category } : {}),
    ...(member ? { member } : {}),
    ...(status ? { status } : {}),
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {})
  };
}

export function writeCashflowFilters(
  params: URLSearchParams,
  filters: CashflowFilters
): URLSearchParams {
  const next = new URLSearchParams(params);
  filterKeys.forEach((key) => next.delete(key));

  if (filters.category?.trim()) next.set("category", filters.category.trim());
  if (filters.member?.trim()) next.set("member", filters.member.trim());
  if (filters.status === "pending" || filters.status === "confirmed") next.set("status", filters.status);
  if (filters.min !== undefined && Number.isFinite(filters.min) && filters.min >= 0) next.set("min", String(filters.min));
  if (filters.max !== undefined && Number.isFinite(filters.max) && filters.max >= 0) next.set("max", String(filters.max));

  return next;
}

export function updateCashflowFilterParams(
  params: URLSearchParams,
  updates: Partial<CashflowFilters>
): URLSearchParams {
  return writeCashflowFilters(params, { ...parseCashflowFilters(params), ...updates });
}
