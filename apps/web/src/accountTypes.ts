import type { AccountTypeOption } from "@family-finance/shared";

export interface AccountTypeSelectOption {
  label: string;
  value: string;
}

export interface AccountTypeMeta {
  label: string;
  color: string;
}

const defaultAccountTypeMeta: Record<string, AccountTypeMeta> = {
  bankCard: { label: "银行卡", color: "blue" },
  银行卡: { label: "银行卡", color: "blue" },
  cash: { label: "现金", color: "green" },
  现金: { label: "现金", color: "green" },
  alipay: { label: "支付宝", color: "cyan" },
  支付宝: { label: "支付宝", color: "cyan" },
  wechat: { label: "微信", color: "geekblue" },
  微信: { label: "微信", color: "geekblue" },
  fund: { label: "基金", color: "orange" },
  基金: { label: "基金", color: "orange" },
  stock: { label: "股票", color: "volcano" },
  股票: { label: "股票", color: "volcano" },
  other: { label: "其他", color: "default" },
  其他: { label: "其他", color: "default" }
};

export function accountTypeOptionsFromSettings(accountTypes: AccountTypeOption[]): AccountTypeSelectOption[] {
  return accountTypes
    .filter((accountType) => accountType.isActive)
    .map((accountType) => ({ label: accountType.name, value: accountType.name }));
}

export function getAccountTypeMeta(type: string): AccountTypeMeta {
  return defaultAccountTypeMeta[type] ?? { label: type, color: "default" };
}
