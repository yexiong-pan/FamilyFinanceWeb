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
    async listAccounts() {
      return [];
    },
    async listAssetTrend() {
      return [];
    },
    async createAccount(input) {
      return { id: "account-1", ...input };
    },
    async updateAccount(id, input) {
      return { id, currentValue: "0.00", ...input };
    },
    async adjustAccount(_id, _value) {
      return { id: "account-1", name: "test", type: "bankCard" as const, ownerName: "test", currentValue: "0.00" };
    },
    async listAccountSnapshots(_accountId) {
      return [];
    },
    async deleteAccount() {
      return undefined;
    },
    async listTransactions() {
      return [];
    },
    async createTransaction(input) {
      return { id: "transaction-1", ...input };
    },
    async updateTransaction(id, input) {
      return { id, ...input };
    },
    async deleteTransaction() {
      return undefined;
    },
    async importTransactions() {
      return { imported: 0 };
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
