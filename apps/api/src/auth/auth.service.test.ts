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
      auditLog: { create: auditLogCreate }
    } as never);

    const result = await service.login({ email: "xiong@example.com", password: "a-long-test-password" });

    expect(result.user).toMatchObject({ userId: "user-1", memberId: "member-1", displayName: "雄哥" });
    expect(result.token).toHaveLength(43);
    expect(authSessionCreate).toHaveBeenCalledOnce();
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "login" }) }));
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
