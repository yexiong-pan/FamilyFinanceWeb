import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";
import { hashPassword, verifyPassword } from "./password";

describe("AuthService", () => {
  it("stores passwords as hashes and verifies the matching password", async () => {
    const hash = await hashPassword("a-long-test-password");
    expect(hash).not.toContain("a-long-test-password");
    await expect(verifyPassword("a-long-test-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("creates a session only for an active user bound to the current family", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const authSessionCreate = vi.fn();
    const auditLogCreate = vi.fn();
    const authSecurityEventCreate = vi.fn();
    const service = new AuthService({
      user: {
        findUnique: vi.fn(async () => ({
          id: "user-1",
          email: "xiong@example.com",
          displayName: "雄哥",
          passwordHash,
          isActive: true,
          memberships: [{ id: "member-1", familyId: "default-family", name: "雄哥" }]
        }))
      },
      authSession: { create: authSessionCreate },
      auditLog: { create: auditLogCreate },
      authRateLimit: createRateLimitStore(),
      authSecurityEvent: { create: authSecurityEventCreate, findFirst: vi.fn(async () => null) }
    } as never);

    const result = await service.login({ email: "xiong@example.com", password: "a-long-test-password" });

    expect(result.user).toMatchObject({ userId: "user-1", memberId: "member-1", displayName: "雄哥" });
    expect(result.token).toHaveLength(43);
    expect(authSessionCreate).toHaveBeenCalledOnce();
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "login" }) }));
    expect(authSecurityEventCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "login_succeeded" }) }));
  });

  it("persists failed login limits by both account and source IP", async () => {
    const rateLimits = createRateLimitStore();
    const authSecurityEventCreate = vi.fn();
    const service = new AuthService({
      user: { findUnique: vi.fn(async () => null) },
      authRateLimit: rateLimits,
      authSecurityEvent: { create: authSecurityEventCreate, findFirst: vi.fn(async () => null) }
    } as never);
    const input = { email: "xiong@example.com", password: "wrong-password" };
    const context = { sourceIp: "203.0.113.7" };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.login(input, context)).rejects.toMatchObject({ status: 401 });
    }
    await expect(service.login(input, context)).rejects.toMatchObject({ status: 429 });

    expect(rateLimits.upsert).toHaveBeenCalled();
    expect(authSecurityEventCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "login_failed", subjectHash: expect.not.stringContaining("xiong@example.com") })
    }));
  });

  it("updates a user's compressed avatar data", async () => {
    const userUpdate = vi.fn();
    const auditLogCreate = vi.fn();
    const service = new AuthService({ user: { update: userUpdate }, auditLog: { create: auditLogCreate } } as never);
    const avatarData = "data:image/jpeg;base64,aGVsbG8=";

    const result = await service.updateProfile(
      { userId: "user-1", familyId: "default-family", memberId: "member-1", email: "xiong@example.com", displayName: "雄哥" },
      { avatarData }
    );

    expect(userUpdate).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { avatarData } });
    expect(result.user.avatarData).toBe(avatarData);
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "updateProfile" }) }));
  });
});

function createRateLimitStore() {
  const records = new Map<string, { failureCount: number; windowStartedAt: Date; blockedUntil: Date | null; expiresAt: Date }>();
  const keyFor = (where: { scope_keyHash: { scope: string; keyHash: string } }) => {
    const { scope, keyHash } = where.scope_keyHash;
    return `${scope}:${keyHash}`;
  };
  return {
    findUnique: vi.fn(async ({ where }) => records.get(keyFor(where)) ?? null),
    upsert: vi.fn(async ({ where, create, update }) => {
      const key = keyFor(where);
      const value = records.has(key) ? { ...records.get(key)!, ...update } : create;
      records.set(key, value);
      return value;
    }),
    update: vi.fn(async ({ where, data }) => {
      const key = keyFor(where);
      const value = { ...records.get(key)!, ...data };
      records.set(key, value);
      return value;
    }),
    deleteMany: vi.fn(async () => ({ count: 0 }))
  };
}
