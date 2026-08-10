export type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface FamilyFinanceClientOptions {
  baseUrl: string;
  sessionToken: string;
  allowWrite: boolean;
  fetchImplementation?: typeof fetch;
}

export class FamilyFinanceClient {
  private readonly baseUrl: URL;
  private readonly fetchImplementation: typeof fetch;

  constructor(private readonly options: FamilyFinanceClientOptions) {
    if (!options.sessionToken) throw new Error("缺少 FAMILY_FINANCE_MCP_SESSION_TOKEN。请先在家庭财务系统登录并配置会话令牌。");
    this.baseUrl = new URL(ensureTrailingSlash(options.baseUrl));
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async request(
    method: ApiMethod,
    path: string,
    query?: Record<string, string>,
    body?: unknown
  ): Promise<unknown> {
    if (method !== "GET" && !this.options.allowWrite) {
      throw new Error("写入功能已关闭。仅在确认允许 Codex 修改家庭数据后，设置 FAMILY_FINANCE_MCP_ALLOW_WRITE=true。");
    }

    const url = this.createApiUrl(path, query);
    const response = await this.fetchImplementation(url, {
      method,
      headers: {
        Accept: "application/json",
        Cookie: `family_finance_session=${this.options.sessionToken}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const payload = await readResponse(response);
    if (!response.ok) {
      const message = typeof payload === "object" && payload && "message" in payload
        ? String(payload.message)
        : `请求失败（HTTP ${response.status}）`;
      throw new Error(message);
    }
    return payload;
  }

  private createApiUrl(path: string, query?: Record<string, string>): URL {
    if (!path || path.includes("://") || path.startsWith("//")) {
      throw new Error("path 必须是 API 的相对路径，例如 transactions 或 health。");
    }
    const url = new URL(path.replace(/^\/+/, ""), this.baseUrl);
    if (url.origin !== this.baseUrl.origin || !url.pathname.startsWith(this.baseUrl.pathname)) {
      throw new Error("path 必须位于配置的 Family Finance API 下。");
    }
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    return url;
  }
}

export function createClientFromEnvironment(environment = process.env): FamilyFinanceClient {
  return new FamilyFinanceClient({
    baseUrl: environment.FAMILY_FINANCE_MCP_API_URL ?? "http://localhost:4000/api",
    sessionToken: environment.FAMILY_FINANCE_MCP_SESSION_TOKEN ?? "",
    allowWrite: environment.FAMILY_FINANCE_MCP_ALLOW_WRITE === "true"
  });
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return { ok: true };
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
