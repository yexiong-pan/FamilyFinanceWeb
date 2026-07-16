import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { classifyExpenseNote, expenseCategoryDefinitions } from "../finance/category-rules";

const FAMILY_ID = "default-family";
const prisma = new PrismaClient();

const legacyCategoryNames: Record<string, string> = {
  交通: "交通出行",
  医疗: "医疗健康",
  日用品: "日用消耗",
  育儿: "育儿教育"
};

async function main(): Promise<void> {
  const summary = await prisma.$transaction(
    async (tx) => {
      const canonical = new Map<string, { id: string; name: string }>();

      for (const definition of expenseCategoryDefinitions) {
        const category = await tx.category.upsert({
          where: {
            familyId_name_kind: {
              familyId: FAMILY_ID,
              name: definition.name,
              kind: "expense"
            }
          },
          create: {
            familyId: FAMILY_ID,
            name: definition.name,
            kind: "expense",
            note: definition.note,
            isDefault: true,
            isActive: true
          },
          update: {
            note: definition.note,
            isDefault: true,
            isActive: true
          },
          select: { id: true, name: true }
        });
        canonical.set(category.name, category);
      }

      let legacyMoved = 0;
      for (const [legacyName, targetName] of Object.entries(legacyCategoryNames)) {
        const legacy = await tx.category.findUnique({
          where: {
            familyId_name_kind: { familyId: FAMILY_ID, name: legacyName, kind: "expense" }
          }
        });
        const target = canonical.get(targetName);
        if (!legacy || !target || legacy.id === target.id) continue;

        const moved = await tx.financeTransaction.updateMany({
          where: { familyId: FAMILY_ID, categoryId: legacy.id },
          data: { categoryId: target.id, categoryName: target.name }
        });
        legacyMoved += moved.count;

        await tx.budget.updateMany({
          where: { familyId: FAMILY_ID, categoryId: legacy.id },
          data: { categoryId: target.id, categoryName: target.name }
        });
        await tx.category.update({ where: { id: legacy.id }, data: { isActive: false } });
      }

      const reviewSourceNames = ["其他", "待分类支出", "购物"];
      const reviewSources = await tx.category.findMany({
        where: { familyId: FAMILY_ID, kind: "expense", name: { in: reviewSourceNames } },
        select: { id: true, name: true }
      });
      const sourceById = new Map(reviewSources.map((category) => [category.id, category.name]));
      const reviewTransactions = await tx.financeTransaction.findMany({
        where: {
          familyId: FAMILY_ID,
          kind: "expense",
          deletedAt: null,
          categoryId: { in: reviewSources.map((category) => category.id) }
        },
        select: { id: true, categoryId: true, note: true }
      });

      let ruleReclassified = 0;
      let shoppingSentToReview = 0;
      for (const transaction of reviewTransactions) {
        const sourceName = transaction.categoryId ? sourceById.get(transaction.categoryId) : undefined;
        const classifiedName = classifyExpenseNote(transaction.note);
        const targetName =
          classifiedName && classifiedName !== sourceName
            ? classifiedName
            : sourceName === "购物"
              ? "待分类支出"
              : undefined;
        const target = targetName ? canonical.get(targetName) : undefined;
        if (!target) continue;

        await tx.financeTransaction.update({
          where: { id: transaction.id },
          data: { categoryId: target.id, categoryName: target.name }
        });
        if (sourceName === "购物" && targetName === "待分类支出") shoppingSentToReview += 1;
        else ruleReclassified += 1;
      }

      const shopping = reviewSources.find((category) => category.name === "购物");
      if (shopping) {
        await tx.category.update({ where: { id: shopping.id }, data: { isActive: false } });
      }

      return {
        canonicalCategories: canonical.size,
        legacyMoved,
        ruleReclassified,
        shoppingSentToReview
      };
    },
    { timeout: 30_000 }
  );

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
