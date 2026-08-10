import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClientFromEnvironment, type ApiMethod } from "./family-finance-client.js";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(moduleDirectory, "../.env.local"), quiet: true });

const server = new McpServer(
  { name: "family-finance", version: "0.1.0" },
  {
    instructions: "使用 Family Finance MCP 查询家庭财务、健康和日程数据。默认只读；所有写入均需 FAMILY_FINANCE_MCP_ALLOW_WRITE=true，并应先向用户确认记录内容。不要调用 auth 路径，也不要在输出中显示会话令牌。"
  }
);

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "月份必须为 YYYY-MM");
const apiMethodSchema = z.enum(["GET", "POST", "PATCH", "DELETE"]);

server.registerTool(
  "family_finance_dashboard",
  {
    title: "家庭财务月度概览",
    description: "获取指定月份的资产、负债、收支、预算及分类汇总。",
    inputSchema: { month: monthSchema },
    annotations: { readOnlyHint: true }
  },
  async ({ month }) => callApi("GET", "dashboard/summary", { month })
);

server.registerTool(
  "family_finance_list_transactions",
  {
    title: "查询收支流水",
    description: "按月查询全部收支流水；未提供月份时查询全部记录。",
    inputSchema: { month: monthSchema.optional() },
    annotations: { readOnlyHint: true }
  },
  async ({ month }) => callApi("GET", "transactions", month ? { month } : undefined)
);

server.registerTool(
  "family_finance_list_assets",
  {
    title: "查询资产、投资和负债",
    description: "获取指定月份的账户、投资持仓和负债；未提供月份时获取当前数据。",
    inputSchema: { month: monthSchema.optional() },
    annotations: { readOnlyHint: true }
  },
  async ({ month }) => {
    const query = month ? { month } : undefined;
    return callMany([
      ["accounts", query],
      ["investments", query],
      ["liabilities", query]
    ], ["accounts", "investments", "liabilities"]);
  }
);

server.registerTool(
  "family_finance_yearly_report",
  {
    title: "家庭财务年度报告",
    description: "获取指定年份的年度收支和资产报告。",
    inputSchema: { year: z.string().regex(/^\d{4}$/, "年份必须为 YYYY") },
    annotations: { readOnlyHint: true }
  },
  async ({ year }) => callApi("GET", "reports/yearly", { year })
);

server.registerTool(
  "family_finance_health_overview",
  {
    title: "健康概览",
    description: "获取一位家庭成员指定月份的健康记录与概览。memberId 可先通过 family_finance_api 查询 family-members 获取。",
    inputSchema: { memberId: z.string().min(1), month: monthSchema },
    annotations: { readOnlyHint: true }
  },
  async ({ memberId, month }) => callApi("GET", "health", { memberId, month })
);

server.registerTool(
  "family_finance_calendar",
  {
    title: "家庭日历",
    description: "获取月历或年历，其中包含收支、还款、健康和家庭日程。period：月历 YYYY-MM，年历 YYYY。",
    inputSchema: {
      view: z.enum(["month", "year"]),
      period: z.string().min(4),
      memberId: z.string().min(1).optional()
    },
    annotations: { readOnlyHint: true }
  },
  async ({ view, period, memberId }) => callApi("GET", "calendar", { view, period, ...(memberId ? { memberId } : {}) })
);

server.registerTool(
  "family_finance_record_transaction",
  {
    title: "记录一笔收支",
    description: "创建一笔手动收入或支出。写入默认关闭；请先核对日期、金额、分类、成员和账户。",
    inputSchema: {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期必须为 YYYY-MM-DD"),
      kind: z.enum(["income", "expense"]),
      categoryName: z.string().min(1),
      memberName: z.string().min(1),
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "金额必须为非负数字字符串"),
      accountId: z.string().min(1).optional(),
      note: z.string().max(500).optional()
    },
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  async (input) => callApi("POST", "transactions", undefined, input)
);

server.registerTool(
  "family_finance_api",
  {
    title: "家庭财务 API 高级访问",
    description: "访问系统中尚未由专用工具覆盖的 API。path 为相对 API 路径（如 financial-safety 或 calendar/events），禁止 auth 路径。GET 默认可用；POST、PATCH、DELETE 需显式开启写入。",
    inputSchema: {
      method: apiMethodSchema.default("GET"),
      path: z.string().min(1).max(300),
      query: z.record(z.string()).optional(),
      body: z.unknown().optional()
    },
    annotations: { readOnlyHint: false, destructiveHint: true }
  },
  async ({ method, path, query, body }) => {
    const normalizedPath = path.replace(/^\/+/, "");
    if (normalizedPath === "auth" || normalizedPath.startsWith("auth/")) {
      return errorResult("出于安全考虑，MCP 不允许调用 auth API。");
    }
    return callApi(method, normalizedPath, query, body);
  }
);

async function callApi(method: ApiMethod, path: string, query?: Record<string, string>, body?: unknown) {
  try {
    const value = await createClientFromEnvironment().request(method, path, query, body);
    return textResult(value);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : "调用家庭财务 API 时发生未知错误。");
  }
}

async function callMany(
  requests: Array<[string, Record<string, string> | undefined]>,
  keys: string[]
) {
  try {
    const client = createClientFromEnvironment();
    const values = await Promise.all(requests.map(([path, query]) => client.request("GET", path, query)));
    return textResult(Object.fromEntries(keys.map((key, index) => [key, values[index]])));
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : "调用家庭财务 API 时发生未知错误。");
  }
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

await server.connect(new StdioServerTransport());
