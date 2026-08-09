import { Injectable, UnauthorizedException, BadRequestException, HttpException, HttpStatus, Inject } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { hashPassword, verifyPassword } from "./password";
import type { AcceptInvitationInput, AuthenticatedUser, AuthRequestContext, LoginInput } from "./auth.types";

const SESSION_DAYS = 30;
const FAMILY_ID = "default-family";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

type RateLimitPolicy = {
  scope: string;
  value: string;
  maximumFailures: number;
};

@Injectable()
export class AuthService {
  private lastRateLimitCleanupAt = 0;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECURITY_HASH_SECRET) {
      throw new Error("生产环境必须设置 AUTH_SECURITY_HASH_SECRET");
    }
  }

  async login(input: LoginInput, context: AuthRequestContext = { sourceIp: "unknown" }): Promise<{ token: string; user: AuthenticatedUser }> {
    const email = normaliseEmail(input.email);
    const rateLimitPolicies = loginRateLimitPolicies(email, context.sourceIp);
    await this.assertRateLimitsAllowed(rateLimitPolicies);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { family: true }, take: 1 } }
    });
    if (!user || !user.isActive || !(await verifyPassword(input.password, user.passwordHash))) {
      const rateLimited = await this.recordRateLimitFailures(rateLimitPolicies);
      await this.recordSecurityEvent("login_failed", email, context.sourceIp, { rateLimited });
      throw new UnauthorizedException("邮箱或密码错误");
    }
    const member = user.memberships[0];
    if (!member || member.familyId !== FAMILY_ID) throw new UnauthorizedException("账号未关联当前家庭");
    const token = randomBytes(32).toString("base64url");
    await this.prisma.authSession.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: addDays(SESSION_DAYS) }
    });
    await this.recordNewSourceIpIfNeeded(email, context.sourceIp);
    await this.prisma.auditLog.create({
      data: {
        familyId: member.familyId,
        actorName: member.name,
        action: "login",
        entityType: "auth",
        entityId: user.id,
        detail: { sourceIpHash: hashSecurityValue(context.sourceIp) }
      }
    });
    await this.recordSecurityEvent("login_succeeded", email, context.sourceIp);
    return { token, user: toAuthenticatedUser(user, member) };
  }

  async currentUser(token: string): Promise<AuthenticatedUser> {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { include: { memberships: true } } }
    });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive) throw new UnauthorizedException();
    const member = session.user.memberships[0];
    if (!member || member.familyId !== FAMILY_ID) throw new UnauthorizedException();
    return toAuthenticatedUser(session.user, member);
  }

  async logout(token?: string): Promise<void> {
    if (!token) return;
    await this.prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  async updateProfile(user: AuthenticatedUser, input: { avatarData?: string | null }): Promise<{ user: AuthenticatedUser }> {
    const avatarData = input.avatarData ?? null;
    if (avatarData !== null) this.assertAvatarData(avatarData);
    await this.prisma.user.update({ where: { id: user.userId }, data: { avatarData } });
    await this.prisma.auditLog.create({
      data: { familyId: user.familyId, actorName: user.displayName, action: "updateProfile", entityType: "auth", entityId: user.userId }
    });
    return { user: { ...user, avatarData: avatarData ?? undefined } };
  }

  async createInvitation(user: AuthenticatedUser, memberId: string): Promise<{ code: string; expiresAt: string }> {
    const member = await this.prisma.familyMember.findFirst({ where: { id: memberId, familyId: user.familyId } });
    if (!member) throw new BadRequestException("家庭成员不存在");
    if (member.userId) throw new BadRequestException("该家庭成员已绑定登录账号");
    const code = randomBytes(18).toString("base64url");
    const expiresAt = addDays(7);
    await this.prisma.authInvitation.create({
      data: { familyId: user.familyId, memberId, tokenHash: hashToken(code), expiresAt }
    });
    await this.prisma.auditLog.create({
      data: { familyId: user.familyId, actorName: user.displayName, action: "invite", entityType: "familyMember", entityId: memberId }
    });
    return { code, expiresAt: expiresAt.toISOString() };
  }

  async acceptInvitation(input: AcceptInvitationInput, context: AuthRequestContext = { sourceIp: "unknown" }): Promise<{ token: string; user: AuthenticatedUser }> {
    const email = normaliseEmail(input.email);
    const rateLimitPolicies = invitationRateLimitPolicies(input.invitationCode, context.sourceIp);
    await this.assertRateLimitsAllowed(rateLimitPolicies);
    const invitation = await this.prisma.authInvitation.findUnique({ where: { tokenHash: hashToken(input.invitationCode) } });
    if (!invitation || invitation.usedAt || invitation.expiresAt <= new Date()) {
      await this.recordInvitationFailure(rateLimitPolicies, email, context.sourceIp);
      throw new BadRequestException("邀请码无效或已过期");
    }
    if (await this.prisma.user.findUnique({ where: { email } })) {
      await this.recordInvitationFailure(rateLimitPolicies, email, context.sourceIp);
      throw new BadRequestException("该邮箱已注册");
    }
    const member = await this.prisma.familyMember.findFirst({ where: { id: invitation.memberId, familyId: invitation.familyId } });
    if (!member || member.userId) {
      await this.recordInvitationFailure(rateLimitPolicies, email, context.sourceIp);
      throw new BadRequestException("该家庭成员已绑定登录账号");
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, displayName: member.name, passwordHash: await hashPassword(input.password) } });
      await tx.familyMember.update({ where: { id: member.id }, data: { userId: created.id } });
      await tx.authInvitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } });
      return created;
    });
    await this.recordSecurityEvent("invitation_accepted", email, context.sourceIp);
    return this.login({ email: user.email, password: input.password }, context);
  }

  private async recordInvitationFailure(policies: RateLimitPolicy[], email: string, sourceIp: string): Promise<void> {
    const rateLimited = await this.recordRateLimitFailures(policies);
    await this.recordSecurityEvent("invitation_failed", email, sourceIp, { rateLimited });
  }

  private async assertRateLimitsAllowed(policies: RateLimitPolicy[]): Promise<void> {
    const now = new Date();
    const records = await Promise.all(policies.map((policy) => this.prisma.authRateLimit.findUnique({
      where: { scope_keyHash: { scope: policy.scope, keyHash: hashRateLimitKey(policy.scope, policy.value) } }
    })));
    if (records.some((record) => record?.blockedUntil && record.blockedUntil > now)) {
      throw new HttpException("登录尝试过多，请 15 分钟后再试", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async recordRateLimitFailures(policies: RateLimitPolicy[]): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RATE_LIMIT_RETENTION_MS);
    const newlyBlocked: string[] = [];
    for (const policy of policies) {
      const keyHash = hashRateLimitKey(policy.scope, policy.value);
      const current = await this.prisma.authRateLimit.findUnique({ where: { scope_keyHash: { scope: policy.scope, keyHash } } });
      if (!current || current.windowStartedAt.getTime() + RATE_LIMIT_WINDOW_MS <= now.getTime()) {
        await this.prisma.authRateLimit.upsert({
          where: { scope_keyHash: { scope: policy.scope, keyHash } },
          create: { scope: policy.scope, keyHash, failureCount: 1, windowStartedAt: now, expiresAt },
          update: { failureCount: 1, windowStartedAt: now, blockedUntil: null, expiresAt }
        });
        continue;
      }
      const failureCount = current.failureCount + 1;
      const blockedUntil = failureCount >= policy.maximumFailures ? new Date(now.getTime() + RATE_LIMIT_WINDOW_MS) : null;
      await this.prisma.authRateLimit.update({
        where: { scope_keyHash: { scope: policy.scope, keyHash } },
        data: { failureCount, blockedUntil, expiresAt }
      });
      if (blockedUntil && !current.blockedUntil) newlyBlocked.push(policy.scope);
    }
    await this.cleanupExpiredRateLimits(now);
    return newlyBlocked.length > 0;
  }

  private async cleanupExpiredRateLimits(now: Date): Promise<void> {
    if (now.getTime() - this.lastRateLimitCleanupAt < 60 * 60 * 1000) return;
    this.lastRateLimitCleanupAt = now.getTime();
    await this.prisma.authRateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
  }

  private async recordNewSourceIpIfNeeded(email: string, sourceIp: string): Promise<void> {
    const subjectHash = hashSecurityValue(email);
    const sourceIpHash = hashSecurityValue(sourceIp);
    const previousLogin = await this.prisma.authSecurityEvent.findFirst({
      where: { action: "login_succeeded", subjectHash, sourceIpHash: { not: sourceIpHash } }
    });
    if (previousLogin) await this.recordSecurityEvent("login_new_source_ip", email, sourceIp);
  }

  private async recordSecurityEvent(action: string, subject?: string, sourceIp?: string, detail?: Prisma.InputJsonObject): Promise<void> {
    await this.prisma.authSecurityEvent.create({
      data: {
        action,
        subjectHash: subject ? hashSecurityValue(subject) : undefined,
        sourceIpHash: sourceIp ? hashSecurityValue(sourceIp) : undefined,
        detail
      }
    });
  }

  private assertAvatarData(value: string): void {
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(value) || Buffer.byteLength(value, "utf8") > 100_000) {
      throw new BadRequestException("头像必须是 100KB 以内的 JPG、PNG 或 WebP 图片");
    }
  }
}

function hashToken(value: string) { return createHash("sha256").update(value).digest("hex"); }
function hashSecurityValue(value: string) {
  return createHmac("sha256", process.env.AUTH_SECURITY_HASH_SECRET ?? "development-only-security-hash-secret")
    .update(value)
    .digest("hex");
}
function hashRateLimitKey(scope: string, value: string) { return hashSecurityValue(`${scope}:${value}`); }
function normaliseEmail(email: string) { return email.trim().toLowerCase(); }
function loginRateLimitPolicies(email: string, sourceIp: string): RateLimitPolicy[] {
  return [
    { scope: "login_email", value: email, maximumFailures: 5 },
    { scope: "login_ip", value: sourceIp, maximumFailures: 20 }
  ];
}
function invitationRateLimitPolicies(invitationCode: string, sourceIp: string): RateLimitPolicy[] {
  return [
    { scope: "invitation_code", value: invitationCode, maximumFailures: 5 },
    { scope: "invitation_ip", value: sourceIp, maximumFailures: 10 }
  ];
}
function addDays(days: number) { const value = new Date(); value.setDate(value.getDate() + days); return value; }
function toAuthenticatedUser(user: { id: string; email: string; displayName: string; avatarData?: string | null }, member: { id: string; familyId: string }) {
  return {
    userId: user.id,
    familyId: member.familyId,
    memberId: member.id,
    email: user.email,
    displayName: user.displayName,
    avatarData: user.avatarData ?? undefined
  };
}
