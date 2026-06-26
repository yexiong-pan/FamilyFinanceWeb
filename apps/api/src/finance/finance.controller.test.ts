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
    async listCategories() {
      return [];
    },
    async listAccounts() {
      return [];
    },
    async createAccount(input) {
      return { id: "account-1", ...input };
    },
    async listTransactions() {
      return [];
    },
    async createTransaction(input) {
      return { id: "transaction-1", ...input };
    },
    async listBudgets() {
      return [];
    },
    async createBudget(input) {
      return { id: "budget-1", ...input };
    },
    async listHoldings() {
      return [];
    },
    async createHolding(input) {
      return { id: "holding-1", ...input };
    }
  };
}
