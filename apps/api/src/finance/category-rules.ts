export const expenseCategoryDefinitions = [
  { name: "房贷", note: "住房贷款本金、利息" },
  { name: "居住家居", note: "房租、物业、水电燃气、家具、收纳、维修、家装" },
  { name: "餐饮", note: "买菜、外卖、餐馆、饮品" },
  { name: "交通出行", note: "公交、打车、加油、停车、车辆维护" },
  { name: "服饰美容", note: "衣服、鞋包、理发、美甲、护肤" },
  { name: "日用消耗", note: "纸品、清洁、洗护及其他消耗品" },
  { name: "医疗健康", note: "药品、挂号、体检、健身" },
  { name: "育儿教育", note: "儿童用品、学费、培训、书籍文具" },
  { name: "休闲娱乐", note: "电影、游戏、会员、聚会、兴趣" },
  { name: "旅行", note: "住宿、机票、景点及旅行消费" },
  { name: "通讯数码", note: "话费、宽带、电子设备、软件服务" },
  { name: "宠物", note: "宠物食品、用品、医疗" },
  { name: "人情家庭", note: "红包、礼物、赡养及家庭往来" },
  { name: "保险税费", note: "保险、税费及证照费用" },
  { name: "其他", note: "低频且确实无法归类的支出" },
  { name: "待分类支出", note: "导入后尚未确认用途的临时分类" }
] as const;

export const incomeCategoryDefinitions = [
  { name: "工资薪酬", note: "工资、奖金及劳务报酬" },
  { name: "投资收益", note: "利息、分红及基金股票收益" },
  { name: "经营收入", note: "经营、销售及副业收入" },
  { name: "退款报销", note: "退款、报销及费用返还" },
  { name: "人情往来", note: "红包、礼金及家庭往来收入" },
  { name: "其他收入", note: "低频且确实无法归类的收入" },
  { name: "待分类收入", note: "导入后尚未确认用途的临时分类" }
] as const;

type ExpenseCategoryName = (typeof expenseCategoryDefinitions)[number]["name"];

const categoryRules: Array<{ name: ExpenseCategoryName; pattern: RegExp }> = [
  { name: "房贷", pattern: /房贷|按揭/u },
  { name: "旅行", pattern: /新西兰|旅行|旅游|住宿|酒店|宾馆|民宿|机票|航空|景区/u },
  { name: "服饰美容", pattern: /优衣库|uniqlo|服装|衣服|女装|男装|童装|鞋包|鞋子|美甲|美容|理发|护肤|化妆/ui },
  { name: "医疗健康", pattern: /药房|药店|医院|诊所|挂号|体检|医疗|健身|瑜伽/u },
  { name: "交通出行", pattern: /加油站|汽油|停车|滴滴|出租车|公交|地铁|高铁|铁路|车辆维修|洗车/u },
  { name: "居住家居", pattern: /晾衣架|鞋柜|收纳|置物架|橱柜|拖把|除尘|家具|家居|物业|水费|电费|燃气|维修|装修|床上用品/u },
  { name: "日用消耗", pattern: /卫生巾|纸巾|洗衣|清洁|洗护|日用品|消毒|垃圾袋/u },
  { name: "餐饮", pattern: /餐饮|小馆|火锅|茶楼|蛋糕|咖啡|奶茶|饭店|餐厅|酒楼|外卖|饿了么|面馆|烧烤/u },
  { name: "宠物", pattern: /宠物|猫粮|狗粮|兽医/u },
  { name: "育儿教育", pattern: /学费|学校|培训|书店|文具|儿童|宝宝|幼儿园/u },
  { name: "休闲娱乐", pattern: /电影|影院|ktv|游戏|会员|演出|游乐|桌游/ui },
  { name: "通讯数码", pattern: /中国移动|中国联通|中国电信|话费|宽带|手机|电脑|数码|软件服务/u },
  { name: "人情家庭", pattern: /红包|礼物|赡养|份子钱/u },
  { name: "保险税费", pattern: /保险|税费|税款|证照/u }
];

export function classifyExpenseNote(note?: string | null): ExpenseCategoryName | undefined {
  const text = note?.trim();
  if (!text) return undefined;
  return categoryRules.find((rule) => rule.pattern.test(text))?.name;
}
