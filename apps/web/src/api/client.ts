import type {
  Account,
  AccountTypeOption,
  DashboardSummary,
  FamilyMemberInfo,
  FinanceTransaction,
  FinancialSafetyData,
  FinancialSafetySettings,
  ImportTransactionsResult,
  TransactionPage,
  ImportTransactionItem,
  InvestmentHolding,
  Liability,
  MonthlyReviewStatus,
  MonthlyReviewAction,
  MonthlyReviewContent,
  MonthlyReviewDetail,
  MonthlySnapshotData,
  RecurringCashflow,
  YearlyReportData
} from "@family-finance/shared";
import type { TransactionSource } from "@family-finance/shared";
import type {
  ExpenseNature,
  MonthlyActionStatus,
  RecurringCashflowKind
} from "@family-finance/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export interface Category {
  id: string;
  name: string;
  kind: "expense" | "income" | "transfer" | "adjustment";
  note?: string;
  expenseNature?: ExpenseNature;
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
  investments: InvestmentHolding[];
  liabilities: Liability[];
  monthlyReview: MonthlyReviewStatus;
  monthlyReviewDetail: MonthlyReviewDetail;
  financialSafety: FinancialSafetyData;
}

export async function loadAppData(
  month: string,
  options: {
    includeTransactions?: boolean;
    includeMonthlyReviewDetail?: boolean;
    includeFinancialSafety?: boolean;
  } = {}
): Promise<AppData> {
  const [summary, familyMembers, accountTypes, categories, categoryMappings, accounts, transactions, investments, liabilities, monthlyReview, monthlyReviewDetail, financialSafety] =
    await Promise.all([
      getJson<DashboardSummary>(`/dashboard/summary?month=${month}`),
      getJson<FamilyMemberInfo[]>("/family-members"),
      getJson<AccountTypeOption[]>("/account-types"),
      getJson<Category[]>("/categories"),
      getJson<CategoryMapping[]>("/category-mappings"),
      getJson<Account[]>(`/accounts?month=${month}`),
      options.includeTransactions === false
        ? Promise.resolve([] as FinanceTransaction[])
        : getJson<FinanceTransaction[]>(`/transactions?month=${month}`),
      getJson<InvestmentHolding[]>(`/investments?month=${month}`),
      getJson<Liability[]>(`/liabilities?month=${month}`),
      getJson<MonthlyReviewStatus>(`/monthly-review?month=${month}`),
      options.includeMonthlyReviewDetail
        ? getJson<MonthlyReviewDetail>(`/monthly-review/detail?month=${month}`)
        : Promise.resolve(emptyMonthlyReviewDetail(month)),
      options.includeFinancialSafety
        ? getJson<FinancialSafetyData>(`/financial-safety?month=${month}`)
        : Promise.resolve(emptyFinancialSafety(month))
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
    investments,
    liabilities,
    monthlyReview,
    monthlyReviewDetail,
    financialSafety
  };
}

function emptyMonthlyReviewDetail(month: string): MonthlyReviewDetail {
  return {
    month,
    state: "draft",
    status: {
      income: false,
      spending: false,
      assets: false,
      liabilities: false,
      investments: false,
      review: false
    },
    content: {},
    checks: [],
    changes: [],
    actions: []
  };
}

function emptyFinancialSafety(month: string): FinancialSafetyData {
  return {
    settings: {
      emergencyReserve: "0.00",
      plannedMonthlySavings: "0.00",
      liquidAccountIds: []
    },
    recurringCashflows: [],
    summary: {
      month,
      asOfDate: `${month}-01`,
      liquidAmount: "0.00",
      expectedIncome: "0.00",
      requiredExpenses: "0.00",
      debtPayments: "0.00",
      plannedSavings: "0.00",
      emergencyReserve: "0.00",
      safeToSpend: "0.00",
      shortfall: "0.00",
      confidence: "insufficient",
      confidenceIssues: [],
      upcomingObligations: []
    }
  };
}

export async function getTransactionPage(query: string): Promise<TransactionPage> {
  return getJson<TransactionPage>(`/transactions/page?${query}`);
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
}): Promise<ImportTransactionsResult> {
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

export async function confirmMonthlyIncome(month: string): Promise<MonthlyReviewStatus> {
  return postJson("/monthly-review/income", { month });
}

export async function updateMonthlyReviewContent(
  month: string,
  input: MonthlyReviewContent
): Promise<MonthlyReviewDetail> {
  return patchJson("/monthly-review/content", { month, ...input });
}

export async function completeMonthlyReview(month: string): Promise<MonthlyReviewDetail> {
  return postJson("/monthly-review/complete", { month });
}

export async function reopenMonthlyReview(month: string): Promise<MonthlyReviewDetail> {
  return postJson("/monthly-review/reopen", { month });
}

export type MonthlyReviewActionInput = {
  title: string;
  ownerName?: string;
  dueDate?: string;
  targetAmount?: string;
  status?: MonthlyActionStatus;
};

export async function createMonthlyReviewAction(
  month: string,
  input: MonthlyReviewActionInput
): Promise<MonthlyReviewAction> {
  return postJson("/monthly-review/actions", { month, ...input });
}

export async function updateMonthlyReviewAction(
  id: string,
  input: MonthlyReviewActionInput
): Promise<MonthlyReviewAction> {
  return patchJson(`/monthly-review/actions/${id}`, input);
}

export async function deleteMonthlyReviewAction(id: string): Promise<void> {
  return del(`/monthly-review/actions/${id}`);
}

export async function getMonthlySnapshot(month: string): Promise<MonthlySnapshotData> {
  return getJson(`/monthly-snapshots?month=${encodeURIComponent(month)}`);
}

export async function getYearlyReport(year: string): Promise<YearlyReportData> {
  return getJson(`/reports/yearly?year=${encodeURIComponent(year)}`);
}

export async function deleteAccount(id: string): Promise<void> {
  return del(`/accounts/${id}`);
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

export type CategoryInput = {
  name: string;
  kind: Category["kind"];
  note?: string;
  expenseNature?: ExpenseNature;
};

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

export type RecurringCashflowInput = {
  name: string;
  kind: RecurringCashflowKind;
  amount: string;
  dayOfMonth: number;
  memberName?: string;
  accountId?: string;
  categoryId?: string;
  expenseNature?: ExpenseNature;
  startMonth?: string;
  endMonth?: string;
  isActive?: boolean;
};

export async function updateFinancialSafetySettings(
  input: FinancialSafetySettings
): Promise<FinancialSafetySettings> {
  return patchJson("/financial-safety/settings", input);
}

export async function createRecurringCashflow(
  input: RecurringCashflowInput
): Promise<RecurringCashflow> {
  return postJson("/recurring-cashflows", input);
}

export async function updateRecurringCashflow(
  id: string,
  input: RecurringCashflowInput
): Promise<RecurringCashflow> {
  return patchJson(`/recurring-cashflows/${id}`, input);
}

export async function deleteRecurringCashflow(id: string): Promise<void> {
  return del(`/recurring-cashflows/${id}`);
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
    throw new Error(await readError(response, `${method} ${path} failed with ${response.status}`));
  }
  return response.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await readError(response, `DELETE ${path} failed with ${response.status}`));
  }
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json() as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join("；");
    return data.message || fallback;
  } catch {
    return fallback;
  }
}
