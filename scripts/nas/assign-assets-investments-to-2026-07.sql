-- One-time, idempotent NAS data correction.
-- Treat the existing default-family accounts and investment holdings as July 2026 data.
-- Existing July snapshots are deliberately preserved.

BEGIN;

UPDATE "Account"
SET "createdAt" = TIMESTAMPTZ '2026-07-01 00:00:00+00'
WHERE "familyId" = 'default-family'
  AND "deletedAt" IS NULL;

UPDATE "InvestmentHolding"
SET "createdAt" = TIMESTAMPTZ '2026-07-01 00:00:00+00'
WHERE "familyId" = 'default-family'
  AND "deletedAt" IS NULL;

INSERT INTO "AccountSnapshot" (
  "id", "familyId", "accountId", "date", "value", "cashBalance", "createdAt"
)
SELECT
  'nas-2026-07-account-' || "id",
  "familyId",
  "id",
  TIMESTAMPTZ '2026-07-31 00:00:00+00',
  "currentValue",
  "cashBalance",
  NOW()
FROM "Account"
WHERE "familyId" = 'default-family'
  AND "deletedAt" IS NULL
ON CONFLICT ("accountId", "date") DO NOTHING;

INSERT INTO "InvestmentSnapshot" (
  "id", "familyId", "holdingId", "month", "investedAmount", "marketValue", "confirmedAt"
)
SELECT
  'nas-2026-07-investment-' || "id",
  "familyId",
  "id",
  '2026-07',
  COALESCE("investedAmount", "marketValue" - "profit"),
  "marketValue",
  NOW()
FROM "InvestmentHolding"
WHERE "familyId" = 'default-family'
  AND "deletedAt" IS NULL
ON CONFLICT ("holdingId", "month") DO NOTHING;

INSERT INTO "MonthlyReview" (
  "id", "familyId", "month", "assetsConfirmedAt", "investmentsConfirmedAt", "createdAt", "updatedAt"
)
SELECT
  'nas-2026-07-review',
  'default-family',
  '2026-07',
  NOW(),
  NOW(),
  NOW(),
  NOW()
WHERE EXISTS (
  SELECT 1
  FROM "Account"
  WHERE "familyId" = 'default-family' AND "deletedAt" IS NULL
)
ON CONFLICT ("familyId", "month") DO UPDATE
SET
  "assetsConfirmedAt" = COALESCE("MonthlyReview"."assetsConfirmedAt", EXCLUDED."assetsConfirmedAt"),
  "investmentsConfirmedAt" = COALESCE("MonthlyReview"."investmentsConfirmedAt", EXCLUDED."investmentsConfirmedAt");

COMMIT;
