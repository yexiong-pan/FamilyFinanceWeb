import type { AssetPurpose } from "@family-finance/shared";
import { Tag } from "antd";

const assetPurposeMeta: Record<AssetPurpose, { label: string; color: string }> = {
  daily: { label: "日常可用", color: "green" },
  emergency: { label: "应急储备", color: "blue" },
  goal: { label: "目标储备", color: "gold" },
  investment: { label: "投资增值", color: "purple" },
  restricted: { label: "长期受限", color: "default" }
};

export const assetPurposeOptions = (Object.keys(assetPurposeMeta) as AssetPurpose[]).map((value) => ({
  value,
  label: assetPurposeMeta[value].label
}));

export function assetPurposeLabel(value: AssetPurpose) {
  return assetPurposeMeta[value].label;
}

export function renderAssetPurpose(value?: AssetPurpose) {
  if (!value) return "—";
  const meta = assetPurposeMeta[value];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}
