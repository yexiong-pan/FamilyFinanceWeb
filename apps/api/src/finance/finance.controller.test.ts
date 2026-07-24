import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";
import { FINANCE_REPOSITORY } from "./finance.repository";
import type { FinanceRepository } from "./finance.repository";

describe("FinanceController", () => {
  it("receives FinanceService through Nest dependency injection", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        FinanceService,
        {
          provide: FINANCE_REPOSITORY,
          useValue: createEmptyRepository()
        }
      ]
    }).compile();

    const controller = moduleRef.get(FinanceController);

    await expect(controller.getDashboardSummary("2026-06")).resolves.toMatchObject({
      totalAssets: "0.00",
      monthlyExpense: "0.00"
    });
  });

  it("routes aggregate snapshot query and delete through the controller", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        FinanceService,
        { provide: FINANCE_REPOSITORY, useValue: createEmptyRepository() }
      ]
    }).compile();
    const controller = moduleRef.get(FinanceController);

    await expect(controller.listAllSnapshots("a1", "2026-07-01", "2026-07-02")).resolves.toEqual([]);
    await expect(controller.getMonthlySnapshot("2026-07")).resolves.toMatchObject({ month: "2026-07" });
    await expect(controller.deleteSnapshot("s1")).resolves.toBeUndefined();
  });
});

function createEmptyRepository(): FinanceRepository {
  return {
    async ensureBaseData() {
      return undefined;
    },
    async listMembers() {
      return ["丈夫", "妻子", "家庭共同"];
    },
    async listFamilyMembers() {
      return [{ id: "member-1", name: "丈夫" }];
    },
    async createMember(input) {
      return { id: "member-1", name: input.name };
    },
    async updateMember(id, input) {
      return { id, name: input.name };
    },
    async deleteMember() {
      return undefined;
    },
    async listAccountTypes() {
      return [];
    },
    async createAccountType(input) {
      return { id: "account-type-1", isDefault: false, isActive: true, ...input };
    },
    async updateAccountType(id, input) {
      return { id, isDefault: false, isActive: true, ...input };
    },
    async deleteAccountType() {
      return undefined;
    },
    async listCategories() {
      return [];
    },
    async createCategory(input) {
      return { id: "category-1", isDefault: false, isActive: true, ...input };
    },
    async updateCategory(id, input) {
      return { id, isDefault: false, isActive: true, ...input };
    },
    async deleteCategory() {
      return undefined;
    },
    async listCategoryMappings() {
      return [];
    },
    async createCategoryMapping(input) {
      return { id: "mapping-1", targetCategoryName: "餐饮", ...input };
    },
    async updateCategoryMapping(id, input) {
      return { id, targetCategoryName: "餐饮", ...input };
    },
    async deleteCategoryMapping() {
      return undefined;
    },
    async listAccounts() {
      return [];
    },
    async listAccountsForMonth() {
      return [];
    },
    async listAssetTrend() {
      return [];
    },
    async createAccount(input) {
      return { id: "account-1", ...input };
    },
    async updateAccount(id, input) {
      return { id, ...input };
    },
    async snapshotAllAccounts() {
      return { date: "2026-07-01", count: 0 };
    },
    async listAccountSnapshots(_accountId) {
      return [];
    },
    async listAllSnapshots() {
      return [];
    },
    async deleteSnapshot() {
      return undefined;
    },
    async deleteAccount() {
      return undefined;
    },
    async listTransactions() {
      return [];
    },
    async listTransactionsPage() {
      return { items: [], total: 0, totalAmount: "0.00" };
    },
    async listTransactionsForYear() {
      return [];
    },
    async createTransaction(input) {
      return { id: "transaction-1", ...input };
    },
    async updateTransaction(id, input) {
      return { id, ...input };
    },
    async confirmTransaction(id) {
      return {
        id,
        date: "2026-07-01",
        kind: "expense",
        categoryName: "餐饮",
        memberName: "家庭共同",
        amount: "10.00",
        confirmedAt: new Date().toISOString()
      };
    },
    async deleteTransaction() {
      return undefined;
    },
    async importTransactions() {
      return { imported: 0, duplicates: 0 };
    },
    async listBudgets() {
      return [];
    },
    async createBudget(input) {
      return { id: "budget-1", ...input };
    },
    async updateBudget(id, input) {
      return { id, ...input };
    },
    async deleteBudget() {
      return undefined;
    },
    async listHoldings() {
      return [];
    },
    async listHoldingsForMonth() {
      return [];
    },
    async snapshotAllInvestments(month) {
      return { month, count: 0 };
    },
    async createHolding(input) {
      return { id: "holding-1", ...input };
    },
    async updateHolding(id, input) {
      return { id, ...input };
    },
    async deleteHolding() {
      return undefined;
    },
    async listLiabilities() {
      return [];
    },
    async listLiabilitiesForMonth() {
      return [];
    },
    async snapshotAllLiabilities(month) {
      return { month, count: 0 };
    },
    async getMonthlyReview(month) {
      return { month, spending: false, assets: false, liabilities: false, investments: false };
    },
    async getMonthlySnapshot(month) {
      return emptyMonthlySnapshot(month);
    },
    async listAnnualSnapshotSummaries() {
      return [];
    },
    async confirmMonthlySpending(month) {
      return { month, spending: true, assets: false, liabilities: false, investments: false };
    },
    async createLiability(input) {
      return { id: "liability-1", ...input, status: input.status ?? "active" };
    },
    async updateLiability(id, input) {
      return { id, ...input, status: input.status ?? "active" };
    },
    async repayLiability(id) {
      return {
        id,
        name: "stub",
        type: "mortgage",
        ownerName: "家庭共同",
        currentBalance: "0.00",
        status: "paidOff"
      };
    },
    async deleteLiability() {
      return undefined;
    }
  };
}

function emptyMonthlySnapshot(month: string) {
  return {
    month,
    review: { month, spending: false, assets: false, liabilities: false, investments: false },
    summary: {
      totalAssets: "0.00",
      totalLiabilities: "0.00",
      netAssets: "0.00",
      investmentMarketValue: "0.00",
      investmentProfit: "0.00"
    },
    assets: [],
    liabilities: [],
    investments: []
  };
}
