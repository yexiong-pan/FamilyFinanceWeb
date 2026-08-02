import {
  AppstoreOutlined,
  CalendarOutlined,
  CloseOutlined,
  ExperimentOutlined,
  FireOutlined,
  LineChartOutlined,
  MedicineBoxOutlined,
  MoreOutlined,
  PlusOutlined,
  ScheduleOutlined,
  TrophyOutlined,
  UserOutlined
} from "@ant-design/icons";
import { Button, Drawer, FloatButton, Grid } from "antd";
import { useState, type ReactNode } from "react";
import type { QuickHealthKind } from "./CalendarPage";
import type { HealthTabKey } from "./navigation";

type QuickRecordAction = QuickHealthKind | "schedule" | "more";

interface QuickRecordItem {
  key: QuickRecordAction;
  label: string;
  icon: ReactNode;
}

export const quickRecordItems: QuickRecordItem[] = [
  { key: "schedule", label: "日程", icon: <CalendarOutlined /> },
  { key: "glucose", label: "血糖", icon: <ExperimentOutlined /> },
  { key: "body", label: "体重", icon: <UserOutlined /> },
  { key: "exercise", label: "运动", icon: <FireOutlined /> },
  { key: "strength", label: "力量", icon: <TrophyOutlined /> },
  { key: "medication", label: "用药", icon: <MedicineBoxOutlined /> },
  { key: "more", label: "更多", icon: <MoreOutlined /> }
];

interface QuickRecordFloatButtonProps {
  onSelect: (kind: QuickHealthKind) => void;
  onOpenSchedule: () => void;
  onOpenHealth: (tab: HealthTabKey) => void;
}

export function QuickRecordFloatButton({
  onSelect,
  onOpenSchedule,
  onOpenHealth
}: QuickRecordFloatButtonProps) {
  const screens = Grid.useBreakpoint();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const selectMoreItem = (tab: HealthTabKey) => {
    setMoreOpen(false);
    onOpenHealth(tab);
  };

  return (
    <>
      <FloatButton.Group
        aria-label="快速记录"
        className="quick-record-floating-group"
        closeIcon={<CloseOutlined />}
        icon={<PlusOutlined />}
        open={open}
        placement="top"
        shape="circle"
        trigger="click"
        type="primary"
        onOpenChange={setOpen}
      >
        {quickRecordItems.map((item) => (
          <FloatButton
            key={item.key}
            aria-label={item.label}
            icon={item.icon}
            onClick={() => {
              setOpen(false);
              if (item.key === "more") {
                setMoreOpen(true);
              } else if (item.key === "schedule") {
                onOpenSchedule();
              } else {
                onSelect(item.key);
              }
            }}
          />
        ))}
      </FloatButton.Group>

      <Drawer
        className="quick-record-more-drawer"
        open={moreOpen}
        size={screens.md ? 420 : "100%"}
        title="更多健康功能"
        onClose={() => setMoreOpen(false)}
      >
        <div className="quick-record-more-actions">
          <Button
            block
            icon={<ScheduleOutlined />}
            onClick={() => selectMoreItem("medication")}
          >
            复诊安排与药品库存
          </Button>
          <Button
            block
            icon={<LineChartOutlined />}
            onClick={() => selectMoreItem("glucose")}
          >
            HbA1c 与血糖趋势
          </Button>
          <Button
            block
            icon={<UserOutlined />}
            onClick={() => selectMoreItem("body")}
          >
            身体与运动记录
          </Button>
          <Button
            block
            icon={<AppstoreOutlined />}
            onClick={() => selectMoreItem("overview")}
          >
            健康管理概览
          </Button>
        </div>
      </Drawer>
    </>
  );
}
