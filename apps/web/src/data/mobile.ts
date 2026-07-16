import type { FinanceTransaction } from "@family-finance/shared";

export function paginateMobileRecords<T>(records: T[], requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: records.slice(start, start + pageSize),
    page,
    total: records.length
  };
}

export function buildMobileTransactionCard(transaction: FinanceTransaction) {
  return {
    date: transaction.date,
    categoryName: transaction.categoryName,
    memberName: transaction.memberName,
    amount: transaction.amount,
    sourceLabel: transaction.source === "wechat"
      ? "微信"
      : transaction.source === "alipay"
        ? "支付宝"
        : transaction.source === "manual"
          ? "手工录入"
          : "未标记",
    pending: Boolean(transaction.source && transaction.source !== "manual" && !transaction.confirmedAt),
    note: transaction.note
  };
}
