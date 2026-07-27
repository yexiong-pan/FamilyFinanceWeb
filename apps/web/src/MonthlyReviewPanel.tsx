import {
  CheckCircleOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import type {
  MonthlyActionStatus,
  MonthlyReviewAction,
  MonthlyReviewContent,
  MonthlyReviewDetail
} from "@family-finance/shared";
import { formatMoney } from "@family-finance/shared";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Typography
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import {
  completeMonthlyReview,
  confirmMonthlyIncome,
  createMonthlyReviewAction,
  deleteMonthlyReviewAction,
  reopenMonthlyReview,
  updateMonthlyReviewAction,
  updateMonthlyReviewContent
} from "./api/client";

const { Text } = Typography;

type Submit = <T>(
  run: () => Promise<T>,
  options: { success: string; onSuccess?: (result: T) => void }
) => Promise<void>;

interface MonthlyReviewPanelProps {
  detail: MonthlyReviewDetail;
  members: string[];
  submit: Submit;
  onOpenCheck: (key: string) => void;
}

const reviewStateMeta = {
  draft: { label: "待盘点", color: "orange" },
  ready: { label: "待完成复盘", color: "blue" },
  completed: { label: "复盘已完成", color: "green" }
} as const;

const actionStatusMeta: Record<MonthlyActionStatus, { label: string; color: string }> = {
  pending: { label: "待完成", color: "orange" },
  completed: { label: "已完成", color: "green" },
  cancelled: { label: "已取消", color: "default" }
};

export function MonthlyReviewPanel({
  detail,
  members,
  submit,
  onOpenCheck
}: MonthlyReviewPanelProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<MonthlyReviewAction | null>(null);
  const [reviewForm] = Form.useForm();
  const [actionForm] = Form.useForm();
  const stateMeta = reviewStateMeta[detail.state];
  const requiredChecks = detail.checks.filter((item) => item.severity === "required");
  const warningChecks = detail.checks.filter((item) => item.severity === "warning");
  const incompleteWarnings = warningChecks.filter((item) => !item.complete);

  useEffect(() => {
    if (!reviewOpen) return;
    reviewForm.setFieldsValue(detail.content);
  }, [detail.content, reviewForm, reviewOpen]);

  useEffect(() => {
    if (!actionOpen) return;
    actionForm.setFieldsValue(
      editingAction
        ? {
            ...editingAction,
            dueDate: editingAction.dueDate ? dayjs(editingAction.dueDate) : undefined,
            targetAmount: editingAction.targetAmount ? Number(editingAction.targetAmount) : undefined
          }
        : {
            title: undefined,
            ownerName: undefined,
            dueDate: undefined,
            targetAmount: undefined,
            status: "pending"
          }
    );
  }, [actionForm, actionOpen, editingAction]);

  return (
    <Card
      title="月度复盘"
      className="report-section-card monthly-review-card"
      extra={<Tag color={stateMeta.color}>{stateMeta.label}</Tag>}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <section className="review-section">
            <Flex justify="space-between" align="center" gap={8}>
              <Text strong>复盘前检查</Text>
              <Text type="secondary">
                {requiredChecks.filter((item) => item.complete).length} / {requiredChecks.length}
              </Text>
            </Flex>
            <div className="review-check-list">
              {requiredChecks.map((item) => (
                <button
                  type="button"
                  className={item.complete ? "review-check-item is-complete" : "review-check-item"}
                  key={item.key}
                  onClick={() => {
                    if (item.key === "income" && !item.complete) {
                      void submit(
                        () => confirmMonthlyIncome(detail.month),
                        { success: "本月收入已确认" }
                      );
                      return;
                    }
                    onOpenCheck(item.key);
                  }}
                >
                  <CheckCircleOutlined />
                  <span>{item.label}</span>
                  <Tag color={item.complete ? "green" : "default"}>
                    {item.complete ? "完成" : item.key === "income" ? "点击确认" : "去处理"}
                  </Tag>
                </button>
              ))}
            </div>
            {incompleteWarnings.length ? (
              <Alert
                type="warning"
                showIcon
                title={`${incompleteWarnings.length} 项数据质量提醒`}
                description={incompleteWarnings.map((item) => item.detail || item.label).join("；")}
              />
            ) : (
              <Alert type="success" showIcon title="账务数据检查通过" />
            )}
          </section>
        </Col>

        <Col xs={24} xl={14}>
          <section className="review-section">
            <Text strong>与上月相比</Text>
            <div className="review-change-grid">
              {detail.changes.map((item) => (
                <div className="review-change-item" key={item.key}>
                  <Flex justify="space-between" align="center" gap={8}>
                    <Text>{item.label}</Text>
                    <Tag color={item.tone === "positive" ? "green" : item.tone === "negative" ? "red" : "default"}>
                      {Number(item.changeAmount) > 0 ? "+" : ""}{formatMoney(item.changeAmount)}
                      {item.changeRate === undefined ? "" : ` · ${item.changeRate > 0 ? "+" : ""}${item.changeRate}%`}
                    </Tag>
                  </Flex>
                  <Text type="secondary">本月 {formatMoney(item.currentAmount)}，上月 {formatMoney(item.previousAmount)}</Text>
                </div>
              ))}
            </div>
          </section>
        </Col>
      </Row>

      <div className="review-divider" />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <section className="review-section">
            <Flex justify="space-between" align="center" gap={8}>
              <Text strong>复盘结论</Text>
              <Button size="small" icon={<EditOutlined />} onClick={() => setReviewOpen(true)}>
                {detail.content.summary ? "编辑" : "填写"}
              </Button>
            </Flex>
            {detail.content.summary ? (
              <div className="review-content">
                <ReviewText label="本月总结" value={detail.content.summary} />
                <ReviewText label="做得好的" value={detail.content.good} />
                <ReviewText label="需要改进" value={detail.content.improve} />
                <ReviewText label="下月重点" value={detail.content.nextFocus} />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="完成盘点后，写下结论和下月重点" />
            )}
          </section>
        </Col>

        <Col xs={24} xl={14}>
          <section className="review-section">
            <Flex justify="space-between" align="center" gap={8}>
              <Text strong>下月行动</Text>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingAction(null);
                  setActionOpen(true);
                }}
              >
                新增
              </Button>
            </Flex>
            {detail.actions.length ? (
              <div className="review-action-list">
                {detail.actions.map((action) => (
                  <div className="review-action-item" key={action.id}>
                    <div className="review-action-main">
                      <Text delete={action.status !== "pending"} strong>{action.title}</Text>
                      <Flex gap={6} wrap>
                        <Tag color={actionStatusMeta[action.status].color}>{actionStatusMeta[action.status].label}</Tag>
                        {action.ownerName ? <Tag>{action.ownerName}</Tag> : null}
                        {action.dueDate ? <Tag>{dayjs(action.dueDate).format("M月D日前")}</Tag> : null}
                        {action.targetAmount ? <Tag color="blue">{formatMoney(action.targetAmount)}</Tag> : null}
                      </Flex>
                    </div>
                    <Space size={2}>
                      {action.status === "pending" ? (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => submit(
                            () => updateMonthlyReviewAction(action.id, {
                              title: action.title,
                              ownerName: action.ownerName,
                              dueDate: action.dueDate,
                              targetAmount: action.targetAmount,
                              status: "completed"
                            }),
                            { success: "行动已完成" }
                          )}
                        >
                          完成
                        </Button>
                      ) : null}
                      <Button type="link" size="small" onClick={() => {
                        setEditingAction(action);
                        setActionOpen(true);
                      }}>编辑</Button>
                      <Popconfirm
                        title="确认删除这项行动？"
                        onConfirm={() => submit(
                          () => deleteMonthlyReviewAction(action.id),
                          { success: "行动已删除" }
                        )}
                      >
                        <Button type="link" size="small" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  </div>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="把复盘结论转成一两项可执行行动" />
            )}
          </section>
        </Col>
      </Row>

      <Flex justify="end" gap={8} wrap className="review-footer-actions">
        {detail.state === "completed" ? (
          <Button
            icon={<ReloadOutlined />}
            onClick={() => submit(
              () => reopenMonthlyReview(detail.month),
              { success: "月度复盘已重新打开" }
            )}
          >
            重新打开
          </Button>
        ) : (
          <>
            <Button onClick={() => setReviewOpen(true)}>
              {detail.content.summary ? "修改复盘结论" : "填写复盘结论"}
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => submit(
                () => completeMonthlyReview(detail.month),
                { success: "本月复盘已完成" }
              )}
            >
              完成月度复盘
            </Button>
          </>
        )}
      </Flex>

      <Drawer
        title="填写月度复盘"
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        size={500}
        destroyOnHidden
      >
        <Form
          form={reviewForm}
          layout="vertical"
          onFinish={(values: MonthlyReviewContent) => submit(
            () => updateMonthlyReviewContent(detail.month, values),
            { success: "复盘结论已保存", onSuccess: () => setReviewOpen(false) }
          )}
        >
          <Form.Item name="summary" label="本月财务总结" rules={[{ required: true, message: "请填写本月财务总结" }]}>
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} placeholder="本月整体收支、资产负债和投资情况如何？" />
          </Form.Item>
          <Form.Item name="good" label="做得好的">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} placeholder="哪些决策值得继续保持？" />
          </Form.Item>
          <Form.Item name="improve" label="需要改进">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} placeholder="哪些支出或决策偏离了预期？" />
          </Form.Item>
          <Form.Item name="nextFocus" label="下月重点">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} placeholder="下个月最需要关注的一件事" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>保存</Button>
        </Form>
      </Drawer>

      <Drawer
        title={editingAction ? "编辑行动" : "新增下月行动"}
        open={actionOpen}
        onClose={() => setActionOpen(false)}
        size={440}
        destroyOnHidden
      >
        <Form
          form={actionForm}
          layout="vertical"
          onFinish={(values) => {
            const payload = {
              title: values.title,
              ownerName: values.ownerName,
              dueDate: values.dueDate?.format("YYYY-MM-DD"),
              targetAmount: values.targetAmount == null ? undefined : String(values.targetAmount),
              status: values.status
            };
            return submit(
              () => editingAction
                ? updateMonthlyReviewAction(editingAction.id, payload)
                : createMonthlyReviewAction(detail.month, payload),
              {
                success: editingAction ? "行动已更新" : "行动已新增",
                onSuccess: () => setActionOpen(false)
              }
            );
          }}
        >
          <Form.Item name="title" label="行动内容" rules={[{ required: true }]}>
            <Input placeholder="如：将餐饮支出控制在3000元内" />
          </Form.Item>
          <Form.Item name="ownerName" label="负责人">
            <Select allowClear options={members.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item name="dueDate" label="完成日期">
            <DatePicker className="full-width" />
          </Form.Item>
          <Form.Item name="targetAmount" label="目标金额">
            <InputNumber min={0} precision={2} className="full-width" />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={(Object.keys(actionStatusMeta) as MonthlyActionStatus[]).map((value) => ({
              label: actionStatusMeta[value].label,
              value
            }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>保存</Button>
        </Form>
      </Drawer>
    </Card>
  );
}

function ReviewText({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <Text type="secondary">{label}</Text>
      <p>{value}</p>
    </div>
  );
}
