import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { expenseCategoryDefinitions, incomeCategoryDefinitions } from "../finance/category-rules";
import { defaultCategoryMappings } from "../finance/default-category-mappings";

const FAMILY_ID = "default-family";
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const summary = await prisma.$transaction(
    async (tx) => {
      await tx.categoryMapping.deleteMany({ where: { familyId: FAMILY_ID } });
      const deleted = {
        accountSnapshots: (await tx.accountSnapshot.deleteMany({ where: { familyId: FAMILY_ID } })).count,
        liabilitySnapshots: (await tx.liabilitySnapshot.deleteMany({ where: { familyId: FAMILY_ID } })).count,
        investmentSnapshots: (await tx.investmentSnapshot.deleteMany({ where: { familyId: FAMILY_ID } })).count,
        monthlyReviews: (await tx.monthlyReview.deleteMany({ where: { familyId: FAMILY_ID } })).count,
        budgets: (await tx.budget.deleteMany({ where: { familyId: FAMILY_ID } })).count,
        transactions: (await tx.financeTransaction.deleteMany({ where: { familyId: FAMILY_ID } })).count,
        investments: (await tx.investmentHolding.deleteMany({ where: { familyId: FAMILY_ID } })).count,
        liabilities: (await tx.liability.deleteMany({ where: { familyId: FAMILY_ID } })).count,
        accounts: (await tx.account.deleteMany({ where: { familyId: FAMILY_ID } })).count,
        auditLogs: (await tx.auditLog.deleteMany({ where: { familyId: FAMILY_ID } })).count,
        importJobs: (await tx.importJob.deleteMany({ where: { familyId: FAMILY_ID } })).count
      };

      const legacySalary = await tx.category.findUnique({
        where: { familyId_name_kind: { familyId: FAMILY_ID, name: "工资", kind: "income" } }
      });
      const salary = await tx.category.findUnique({
        where: { familyId_name_kind: { familyId: FAMILY_ID, name: "工资薪酬", kind: "income" } }
      });
      if (legacySalary && !salary) {
        await tx.category.update({
          where: { id: legacySalary.id },
          data: { name: "工资薪酬", note: "工资、奖金及劳务报酬", isDefault: true, isActive: true }
        });
      }

      const canonical = [...expenseCategoryDefinitions.map((item) => ({ ...item, kind: "expense" as const })),
        ...incomeCategoryDefinitions.map((item) => ({ ...item, kind: "income" as const }))];
      const targetByKey = new Map<string, string>();
      for (const definition of canonical) {
        const category = await tx.category.upsert({
          where: {
            familyId_name_kind: { familyId: FAMILY_ID, name: definition.name, kind: definition.kind }
          },
          create: {
            familyId: FAMILY_ID,
            name: definition.name,
            kind: definition.kind,
            note: definition.note,
            isDefault: true,
            isActive: true
          },
          update: { note: definition.note, isDefault: true, isActive: true }
        });
        targetByKey.set(`${definition.kind}:${definition.name}`, category.id);
      }

      await tx.category.updateMany({
        where: {
          familyId: FAMILY_ID,
          kind: "income",
          name: { in: ["交通", "待分类支出"] }
        },
        data: { isActive: false }
      });

      await tx.categoryMapping.createMany({
        data: defaultCategoryMappings.map((mapping) => ({
          familyId: FAMILY_ID,
          source: mapping.source,
          kind: mapping.kind,
          sourceCategory: mapping.sourceCategory,
          targetCategoryId: targetByKey.get(`${mapping.kind}:${mapping.targetCategoryName}`)!
        }))
      });

      return { deleted, categoriesKept: await tx.category.count({ where: { familyId: FAMILY_ID, isActive: true } }), mappings: defaultCategoryMappings.length };
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
  .finally(async () => prisma.$disconnect());
