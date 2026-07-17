import { Progress } from "antd";

interface RatioProgressProps {
  percent: number;
  tone?: "normal" | "danger";
}

export function RatioProgress({ percent, tone = "normal" }: RatioProgressProps) {
  const normalizedPercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return (
    <div className={`ratio-progress${tone === "danger" ? " is-danger" : ""}`}>
      <Progress
        percent={normalizedPercent}
        showInfo={false}
        strokeColor={tone === "danger" ? "#FA5252" : "#52C41A"}
      />
      <span className="ratio-progress-value">{normalizedPercent}%</span>
    </div>
  );
}
