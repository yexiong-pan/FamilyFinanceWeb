import { describe, expect, it } from "vitest";
import { classifyExpenseNote } from "./category-rules";

describe("classifyExpenseNote", () => {
  it.each([
    ["新西兰原住民发起的群收款-27年新西兰住宿", "旅行"],
    ["UNIQLO · 优衣库(上海淮海路全球旗舰店)", "服饰美容"],
    ["凯隆二十九加油站 · 92号车用汽油", "交通出行"],
    ["上海上药新特云慈大药房有限公司", "医疗健康"],
    ["霜山折叠晾衣架阳台晒被子工具", "居住家居"],
    ["上海筷意小馆餐饮有限公司", "餐饮"],
    ["扫经营码付款-给美甲店", "服饰美容"]
  ])("classifies %s as %s", (note, expected) => {
    expect(classifyExpenseNote(note)).toBe(expected);
  });

  it("leaves ambiguous transfers for manual review", () => {
    expect(classifyExpenseNote("微信转账-对方已收钱")).toBeUndefined();
  });
});
