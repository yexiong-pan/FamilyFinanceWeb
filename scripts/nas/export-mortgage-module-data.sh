#!/bin/sh

set -eu

# Export only the mortgage/provident-fund module from the local development DB.
# The generated SQL replaces the same module data on NAS, but never touches
# unrelated assets, transactions, liabilities, or family members.
OUTPUT_PATH=${1:-/tmp/family-finance-mortgage-module-data.sql}
FAMILY_ID=${FAMILY_ID:-default-family}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.dev.yml}

case "$FAMILY_ID" in
  *"'"*) echo "FAMILY_ID 不能包含单引号" >&2; exit 1 ;;
esac

mkdir -p "$(dirname "$OUTPUT_PATH")"

other_family_records=$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql \
  -U family_finance -d family_finance -v ON_ERROR_STOP=1 -At \
  -c "SELECT count(*) FROM (
    SELECT \"familyId\" FROM public.\"Mortgage\" WHERE \"familyId\" <> '$FAMILY_ID'
    UNION ALL
    SELECT \"familyId\" FROM public.\"ProvidentFundAccount\" WHERE \"familyId\" <> '$FAMILY_ID'
  ) AS other_family_records;")
if [ "$other_family_records" != "0" ]; then
  echo "本地数据库包含其他家庭的房贷公积金数据；为防止误同步，已停止导出。" >&2
  exit 1
fi

{
  printf '%s\n' '\set ON_ERROR_STOP on'
  printf '%s\n' 'BEGIN;'
  printf '%s\n' 'DO $$'
  printf '%s\n' 'BEGIN'
  printf '%s\n' "  IF NOT EXISTS (SELECT 1 FROM public.\"Family\" WHERE id = '$FAMILY_ID') THEN"
  printf '%s\n' "    RAISE EXCEPTION '目标数据库不存在家庭 %', '$FAMILY_ID';"
  printf '%s\n' '  END IF;'
  printf '%s\n' 'END $$;'
  printf '%s\n' "DELETE FROM public.\"Mortgage\" WHERE \"familyId\" = '$FAMILY_ID';"
  printf '%s\n' "DELETE FROM public.\"ProvidentFundAccount\" WHERE \"familyId\" = '$FAMILY_ID';"
} > "$OUTPUT_PATH"

docker compose -f "$COMPOSE_FILE" exec -T postgres psql \
  -U family_finance -d family_finance -v ON_ERROR_STOP=1 -At \
  -c "SELECT format(
    'INSERT INTO public.\"Liability\" (id, \"familyId\", name, type, \"ownerName\", \"initialBalance\", \"currentBalance\", \"monthlyPayment\", \"paymentDay\", \"repaymentSchedule\", \"remainingPeriods\", lender, status, note, \"deletedAt\", \"createdAt\", \"updatedAt\") VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, \"ownerName\" = EXCLUDED.\"ownerName\", \"initialBalance\" = EXCLUDED.\"initialBalance\", \"currentBalance\" = EXCLUDED.\"currentBalance\", \"monthlyPayment\" = EXCLUDED.\"monthlyPayment\", \"paymentDay\" = EXCLUDED.\"paymentDay\", \"repaymentSchedule\" = EXCLUDED.\"repaymentSchedule\", \"remainingPeriods\" = EXCLUDED.\"remainingPeriods\", lender = EXCLUDED.lender, status = EXCLUDED.status, note = EXCLUDED.note, \"deletedAt\" = EXCLUDED.\"deletedAt\", \"updatedAt\" = EXCLUDED.\"updatedAt\";',
    l.id, l.\"familyId\", l.name, l.type::text, l.\"ownerName\", l.\"initialBalance\", l.\"currentBalance\", l.\"monthlyPayment\", l.\"paymentDay\", l.\"repaymentSchedule\"::text, l.\"remainingPeriods\", l.lender, l.status::text, l.note, l.\"deletedAt\", l.\"createdAt\", l.\"updatedAt\"
  )
  FROM public.\"Liability\" l
  INNER JOIN public.\"Mortgage\" m ON m.\"liabilityId\" = l.id
  WHERE m.\"familyId\" = '$FAMILY_ID'
  ORDER BY l.id;" >> "$OUTPUT_PATH"

for table in \
  'Mortgage' \
  'ProvidentFundAccount' \
  'MortgageLoanPart' \
  'MortgageLoanRateVersion' \
  'MortgageMonthlyRepayment' \
  'MortgageLoanPartRepayment' \
  'MortgageProvidentFundParticipant' \
  'ProvidentFundContributionRate' \
  'ProvidentFundAccountTransaction'; do
  docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump \
    -U family_finance -d family_finance --data-only --no-owner --no-privileges \
    --table="public.\"$table\"" >> "$OUTPUT_PATH"
done

printf '%s\n' 'COMMIT;' >> "$OUTPUT_PATH"
printf '已导出房贷公积金模块数据：%s\n' "$OUTPUT_PATH"
