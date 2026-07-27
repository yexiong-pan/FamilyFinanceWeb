import { QuestionCircleOutlined } from "@ant-design/icons";
import type { ExpenseNature } from "@family-finance/shared";
import { Button, Popover, Space, Tag, Tooltip, Typography } from "antd";

const { Text } = Typography;

const expenseNatureMeta: Record<ExpenseNature, { label: string; color: string; description: string }> = {
  fixed: {
    label: "刚性",
    color: "purple",
    description: "由合同或固定账单决定，短期内很难调整，如房贷、房租、保险和税费。"
  },
  necessary: {
    label: "必要",
    color: "blue",
    description: "维持家庭正常生活所需，但金额仍可优化，如餐饮、水电、交通和医疗。"
  },
  flexible: {
    label: "弹性",
    color: "orange",
    description: "可以推迟或减少，不影响基本生活，如娱乐、服饰、美容和非必要购物。"
  },
  goal: {
    label: "目标",
    color: "green",
    description: "为明确计划主动安排的支出，如旅行、教育、装修和大额购置。"
  }
};

export const expenseNatureOptions = (Object.keys(expenseNatureMeta) as ExpenseNature[]).map((value) => ({
  label: expenseNatureMeta[value].label,
  value
}));

export function expenseNatureLabel(value: ExpenseNature) {
  return expenseNatureMeta[value].label;
}

export function expenseNatureColor(value: ExpenseNature) {
  return expenseNatureMeta[value].color;
}

export function expenseNatureDescription(value: ExpenseNature) {
  return expenseNatureMeta[value].description;
}

export function renderExpenseNature(value: ExpenseNature) {
  const meta = expenseNatureMeta[value];
  return (
    <Tooltip title={`${meta.label}支出：${meta.description}`}>
      <Tag color={meta.color}>{meta.label}</Tag>
    </Tooltip>
  );
}

export function ExpenseNatureHelp() {
  return (
    <Popover
      title="四种支出性质"
      trigger={["hover", "click"]}
      content={
        <Space orientation="vertical" size={10} className="expense-nature-help-content">
          {(Object.keys(expenseNatureMeta) as ExpenseNature[]).map((value) => {
            const meta = expenseNatureMeta[value];
            return (
              <div className="expense-nature-help-row" key={value}>
                <Tag color={meta.color}>{meta.label}</Tag>
                <Text>{meta.description}</Text>
              </div>
            );
          })}
        </Space>
      }
    >
      <Button
        type="text"
        size="small"
        icon={<QuestionCircleOutlined />}
        aria-label="查看四种支出性质说明"
        className="expense-nature-help-button"
      />
    </Popover>
  );
}
