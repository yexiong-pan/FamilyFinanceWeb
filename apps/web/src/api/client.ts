import type {
  Account,
  AccountSnapshotRecord,
  AccountTypeOption,
  AssetTrendPoint,
  Budget,
  DashboardSummary,
  FamilyMemberInfo,
  FinanceTransaction,
  ImportTransactionItem,
  InvestmentHolding,
  Liability,
  MonthlyReviewStatus,
  MonthlySnapshotData,
  YearlyReportData
} from "@family-finance/shared";
import type { TransactionSource } from "@family-finance/shared";

export type { AssetTrendPoint };

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export interface Category {
  id: string;
  name: string;
  kind: "expense" | "income" | "transfer" | "adjustment";
  note?: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface CategoryMapping {
  id: string;
  source: Exclude<TransactionSource, "manual">;
  kind: "expense" | "income";
  sourceCategory: string;
  targetCategoryId: string;
  targetCategoryName: string;
}

export interface AppData {
  summary: DashboardSummary;
  members: string[];
  familyMembers: FamilyMemberInfo[];
  accountTypes: AccountTypeOption[];
  categories: Category[];
  categoryMappings: CategoryMapping[];
  accounts: Account[];
  transactions: FinanceTransaction[];
  budgets: Budget[];
  investments: InvestmentHolding[];
  liabilities: Liability[];
  assetTrend: AssetTrendPoint[];
  monthlyReview: MonthlyReviewStatus;
}

export async function loadAppData(month: string): Promise<AppData> {
  const [summary, familyMembers, accountTypes, categories, categoryMappings, accounts, transactions, investments, liabilities, monthlyReview] =
    await Promise.all([
      getJson<DashboardSummary>(`/dashboard/summary?month=${month}`),
      getJson<FamilyMemberInfo[]>("/family-members"),
      getJson<AccountTypeOption[]>("/account-types"),
      getJson<Category[]>("/categories"),
      getJson<CategoryMapping[]>("/category-mappings"),
      getJson<Account[]>(`/accounts?month=${month}`),
      getJson<FinanceTransaction[]>(`/transactions?month=${month}`),
      getJson<InvestmentHolding[]>(`/investments?month=${month}`),
      getJson<Liability[]>(`/liabilities?month=${month}`),
      getJson<MonthlyReviewStatus>(`/monthly-review?month=${month}`)
    ]);

  return {
    summary,
    members: familyMembers.map((member) => member.name),
    familyMembers,
    accountTypes,
    categories,
    categoryMappings,
    accounts,
    transactions,
    budgets: [],
    investments,
    liabilities,
    assetTrend: [],
    monthlyReview
  };
}

export async function createMember(input: { name: string; icon?: string }): Promise<FamilyMemberInfo> {
  return postJson("/family-members", input);
}

export async function updateMember(
  id: string,
  input: { name: string; icon?: string }
): Promise<FamilyMemberInfo> {
  return patchJson(`/family-members/${id}`, input);
}

export async function deleteMember(id: string): Promise<void> {
  return del(`/family-members/${id}`);
}

export type AccountTypeInput = { name: string };

export async function createAccountType(input: AccountTypeInput): Promise<AccountTypeOption> {
  return postJson("/account-types", input);
}

export async function updateAccountType(id: string, input: AccountTypeInput): Promise<AccountTypeOption> {
  return patchJson(`/account-types/${id}`, input);
}

export async function deleteAccountType(id: string): Promise<void> {
  return del(`/account-types/${id}`);
}

export type LiabilityInput = Omit<Liability, "id" | "status"> & { status?: Liability["status"] };

export async function createTransaction(input: Omit<FinanceTransaction, "id">): Promise<FinanceTransaction> {
  return postJson("/transactions", input);
}

export async function updateTransaction(
  id: string,
  input: Omit<FinanceTransaction, "id">
): Promise<FinanceTransaction> {
  return patchJson(`/transactions/${id}`, input);
}

export async function confirmTransaction(id: string): Promise<FinanceTransaction> {
  return postJson(`/transactions/${id}/confirm`, {});
}

export async function deleteTransaction(id: string): Promise<void> {
  return del(`/transactions/${id}`);
}

export async function importTransactions(payload: {
  accountId?: string;
  memberName: string;
  source: Exclude<TransactionSource, "manual">;
  items: ImportTransactionItem[];
}): Promise<{ imported: number }> {
  return postJson("/transactions/import", payload);
}

export type UpdateAccountInput = Omit<Account, "id" | "createdAt" | "updatedAt">;

export async function createAccount(input: Omit<Account, "id">): Promise<Account> {
  return postJson("/accounts", input);
}

export async function updateAccount(id: string, input: UpdateAccountInput): Promise<Account> {
  return patchJson(`/accounts/${id}`, input);
}

export async function snapshotAllAccounts(month: string): Promise<{ date: string; count: number }> {
  return postJson("/accounts/snapshots", { month });
}

export async function snapshotAllLiabilities(month: string): Promise<{ month: string; count: number }> {
  return postJson("/liabilities/snapshots", { month });
}

export async function snapshotAllInvestments(month: string): Promise<{ month: string; count: number }> {
  return postJson("/investments/snapshots", { month });
}

export async function confirmMonthlySpending(month: string): Promise<MonthlyReviewStatus> {
  return postJson("/monthly-review/spending", { month });
}

export async function getMonthlySnapshot(month: string): Promise<MonthlySnapshotData> {
  return getJson(`/monthly-snapshots?month=${encodeURIComponent(month)}`);
}

export async function getYearlyReport(year: string): Promise<YearlyReportData> {
  return getJson(`/reports/yearly?year=${encodeURIComponent(year)}`);
}

export interface AccountSnapshotPoint {
  date: string;
  value: string;
}

export async function listAccountSnapshots(accountId: string): Promise<AccountSnapshotPoint[]> {
  return getJson(`/accounts/${accountId}/snapshots`);
}

export async function listAllSnapshots(
  filter?: { accountId?: string; from?: string; to?: string }
): Promise<AccountSnapshotRecord[]> {
  const params = new URLSearchParams();
  if (filter?.accountId) params.set("accountId", filter.accountId);
  if (filter?.from) params.set("from", filter.from);
  if (filter?.to) params.set("to", filter.to);
  const query = params.toString();
  return getJson(`/accounts/snapshots${query ? `?${query}` : ""}`);
}

export async function deleteSnapshot(id: string): Promise<void> {
  return del(`/accounts/snapshots/${id}`);
}

export async function deleteAccount(id: string): Promise<void> {
  return del(`/accounts/${id}`);
}

export async function createBudget(input: Omit<Budget, "id">): Promise<Budget> {
  return postJson("/budgets", input);
}

export async function updateBudget(id: string, input: Omit<Budget, "id">): Promise<Budget> {
  return patchJson(`/budgets/${id}`, input);
}

export async function deleteBudget(id: string): Promise<void> {
  return del(`/budgets/${id}`);
}

export async function createInvestment(input: Omit<InvestmentHolding, "id">): Promise<InvestmentHolding> {
  return postJson("/investments", input);
}

export async function updateInvestment(
  id: string,
  input: Omit<InvestmentHolding, "id">
): Promise<InvestmentHolding> {
  return patchJson(`/investments/${id}`, input);
}

export async function deleteInvestment(id: string): Promise<void> {
  return del(`/investments/${id}`);
}

export async function createLiability(input: LiabilityInput): Promise<Liability> {
  return postJson("/liabilities", input);
}

export async function updateLiability(id: string, input: LiabilityInput): Promise<Liability> {
  return patchJson(`/liabilities/${id}`, input);
}

export async function repayLiability(id: string, input: { amount: string }): Promise<Liability> {
  return postJson(`/liabilities/${id}/repay`, input);
}

export type CategoryInput = { name: string; kind: Category["kind"]; note?: string };

export type CategoryMappingInput = Omit<CategoryMapping, "id" | "targetCategoryName">;

export async function createCategory(input: CategoryInput): Promise<Category> {
  return postJson("/categories", input);
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  return patchJson(`/categories/${id}`, input);
}

export async function deleteCategory(id: string): Promise<void> {
  return del(`/categories/${id}`);
}

export async function createCategoryMapping(input: CategoryMappingInput): Promise<CategoryMapping> {
  return postJson("/category-mappings", input);
}

export async function updateCategoryMapping(id: string, input: CategoryMappingInput): Promise<CategoryMapping> {
  return patchJson(`/category-mappings/${id}`, input);
}

export async function deleteCategoryMapping(id: string): Promise<void> {
  return del(`/category-mappings/${id}`);
}

export async function deleteLiability(id: string): Promise<void> {
  return del(`/liabilities/${id}`);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return sendJson<T>("POST", path, body);
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  return sendJson<T>("PATCH", path, body);
}

async function sendJson<T>(method: "POST" | "PATCH", path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`DELETE ${path} failed with ${response.status}`);
  }
}
