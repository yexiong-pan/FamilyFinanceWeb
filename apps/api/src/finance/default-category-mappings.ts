import type { CategoryMappingInput } from "./finance.types";

export const defaultCategoryMappings: Array<Omit<CategoryMappingInput, "targetCategoryId"> & { targetCategoryName: string }> = [
  { source: "alipay", kind: "expense", sourceCategory: "餐饮", targetCategoryName: "餐饮" },
  { source: "alipay", kind: "expense", sourceCategory: "生活日用", targetCategoryName: "日用消耗" },
  { source: "alipay", kind: "expense", sourceCategory: "交通", targetCategoryName: "交通出行" },
  { source: "alipay", kind: "expense", sourceCategory: "爱车", targetCategoryName: "交通出行" },
  { source: "alipay", kind: "expense", sourceCategory: "医疗保健", targetCategoryName: "医疗健康" },
  { source: "alipay", kind: "expense", sourceCategory: "金融保险", targetCategoryName: "保险税费" },
  { source: "alipay", kind: "expense", sourceCategory: "休闲玩乐", targetCategoryName: "休闲娱乐" },
  { source: "alipay", kind: "expense", sourceCategory: "宠物", targetCategoryName: "宠物" },
  { source: "alipay", kind: "expense", sourceCategory: "其他", targetCategoryName: "其他" },
  { source: "alipay", kind: "expense", sourceCategory: "生活服务", targetCategoryName: "其他" },
  { source: "alipay", kind: "expense", sourceCategory: "购物", targetCategoryName: "待分类支出" },
  { source: "alipay", kind: "expense", sourceCategory: "转账", targetCategoryName: "待分类支出" },
  { source: "alipay", kind: "income", sourceCategory: "投资理财", targetCategoryName: "投资收益" },
  { source: "alipay", kind: "income", sourceCategory: "生意", targetCategoryName: "经营收入" },
  { source: "wechat", kind: "expense", sourceCategory: "商户消费", targetCategoryName: "待分类支出" },
  { source: "wechat", kind: "expense", sourceCategory: "扫二维码付款", targetCategoryName: "待分类支出" },
  { source: "wechat", kind: "expense", sourceCategory: "转账", targetCategoryName: "待分类支出" },
  { source: "wechat", kind: "income", sourceCategory: "充电服务-退款", targetCategoryName: "退款报销" },
  { source: "wechat", kind: "income", sourceCategory: "氿格智充-退款", targetCategoryName: "退款报销" },
  { source: "wechat", kind: "income", sourceCategory: "转账-退款", targetCategoryName: "退款报销" },
  { source: "wechat", kind: "income", sourceCategory: "转账", targetCategoryName: "待分类收入" }
];
