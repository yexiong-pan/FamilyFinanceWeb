import type {
  Account,
  AssetTrendPoint,
  Budget,
  DashboardSummary,
  FamilyMemberInfo,
  FinanceTransaction,
  ImportTransactionItem,
  InvestmentHolding,
  Liability
} from "@family-finance/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export interface Category {
  id: string;
  name: string;
  kind: "expense" | "income" | "transfer" | "adjustment";
  isDefault: boolean;
  isActive: boolean;
}

export interface AppData {
  summary: DashboardSummary;
  members: string[];
  familyMembers: FamilyMemberInfo[];
  categories: Category[];
  accounts: Account[];
  transactions: FinanceTransaction[];
  budgets: Budget[];
  investments: InvestmentHolding[];
  liabilities: Liability[];
  assetTrend: AssetTrendPoint[];
}

export async function loadAppData(month: string): Promise<AppData> {
  const [summary, familyMembers, categories, accounts, transactions, budgets, investments, liabilities, assetTrend] =
    await Promise.all([
      getJson<DashboardSummary>(`/dashboard/summary?month=${month}`),
      getJson<FamilyMemberInfo[]>("/family-members"),
      getJson<Category[]>("/categories"),
      getJson<Account[]>("/accounts"),
      getJson<FinanceTransaction[]>(`/transactions?month=${month}`),
      getJson<Budget[]>(`/budgets?month=${month}`),
      getJson<InvestmentHolding[]>("/investments"),
      getJson<Liability[]>("/liabilities"),
      getJson<AssetTrendPoint[]>("/dashboard/asset-trend")
    ]);

  return {
    summary,
    members: familyMembers.map((member) => member.name),
    familyMembers,
    categories,
    accounts,
    transactions,
    budgets,
    investments,
    liabilities,
    assetTrend
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

export async function deleteTransaction(id: string): Promise<void> {
  return del(`/transactions/${id}`);
}

export async function importTransactions(payload: {
  accountId?: string;
  memberName: string;
  items: ImportTransactionItem[];
}): Promise<{ imported: number }> {
  return postJson("/transactions/import", payload);
}

export type UpdateAccountInput = Omit<Account, "id" | "currentValue" | "createdAt" | "updatedAt">;

export async function createAccount(input: Omit<Account, "id">): Promise<Account> {
  return postJson("/accounts", input);
}

export async function updateAccount(id: string, input: UpdateAccountInput): Promise<Account> {
  return patchJson(`/accounts/${id}`, input);
}

export async function adjustAccount(id: string, value: string): Promise<Account> {
  return postJson(`/accounts/${id}/adjust`, { value });
}

export interface AccountSnapshotRecord {
  date: string;
  value: string;
}

export async function listAccountSnapshots(accountId: string): Promise<AccountSnapshotRecord[]> {
  return getJson(`/accounts/${accountId}/snapshots`);
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

export type CategoryInput = { name: string; kind: Category["kind"] };

export async function createCategory(input: CategoryInput): Promise<Category> {
  return postJson("/categories", input);
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  return patchJson(`/categories/${id}`, input);
}

export async function deleteCategory(id: string): Promise<void> {
  return del(`/categories/${id}`);
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
