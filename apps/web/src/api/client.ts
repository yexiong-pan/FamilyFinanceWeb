import type {
  Account,
  Budget,
  DashboardSummary,
  FinanceTransaction,
  InvestmentHolding
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
  categories: Category[];
  accounts: Account[];
  transactions: FinanceTransaction[];
  budgets: Budget[];
  investments: InvestmentHolding[];
}

export async function loadAppData(month: string): Promise<AppData> {
  const [summary, members, categories, accounts, transactions, budgets, investments] = await Promise.all([
    getJson<DashboardSummary>(`/dashboard/summary?month=${month}`),
    getJson<string[]>("/members"),
    getJson<Category[]>("/categories"),
    getJson<Account[]>("/accounts"),
    getJson<FinanceTransaction[]>(`/transactions?month=${month}`),
    getJson<Budget[]>(`/budgets?month=${month}`),
    getJson<InvestmentHolding[]>("/investments")
  ]);

  return { summary, members, categories, accounts, transactions, budgets, investments };
}

export async function createTransaction(input: Omit<FinanceTransaction, "id">): Promise<FinanceTransaction> {
  return postJson("/transactions", input);
}

export async function createAccount(input: Omit<Account, "id">): Promise<Account> {
  return postJson("/accounts", input);
}

export async function createBudget(input: Omit<Budget, "id">): Promise<Budget> {
  return postJson("/budgets", input);
}

export async function createInvestment(input: Omit<InvestmentHolding, "id">): Promise<InvestmentHolding> {
  return postJson("/investments", input);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`POST ${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}
