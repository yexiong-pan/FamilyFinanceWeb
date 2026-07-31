import { Injectable, UnauthorizedException, BadRequestException, HttpException, HttpStatus, Inject } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { hashPassword, verifyPassword } from "./password";
import type { AcceptInvitationInput, AuthenticatedUser, LoginInput } from "./auth.types";

const SESSION_DAYS = 30;
const FAMILY_ID = "default-family";

@Injectable()
export class AuthService {
  private readonly failedLogins = new Map<string, { count: number; resetAt: number }>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async login(input: LoginInput): Promise<{ token: string; user: AuthenticatedUser }> {
    const email = input.email.trim().toLowerCase();
    this.assertLoginAllowed(email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { family: true }, take: 1 } }
    });
    if (!user || !user.isActive || !(await verifyPassword(input.password, user.passwordHash))) {
      this.recordFailedLogin(email);
      throw new UnauthorizedException("邮箱或密码错误");
    }
    const member = user.memberships[0];
    if (!member || member.familyId !== FAMILY_ID) throw new UnauthorizedException("账号未关联当前家庭");
    const token = randomBytes(32).toString("base64url");
    await this.prisma.authSession.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: addDays(SESSION_DAYS) }
    });
    await this.prisma.auditLog.create({
      data: { familyId: member.familyId, actorName: member.name, action: "login", entityType: "auth", entityId: user.id }
    });
    this.failedLogins.delete(email);
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

  async acceptInvitation(input: AcceptInvitationInput): Promise<{ token: string; user: AuthenticatedUser }> {
    const invitation = await this.prisma.authInvitation.findUnique({ where: { tokenHash: hashToken(input.invitationCode) } });
    if (!invitation || invitation.usedAt || invitation.expiresAt <= new Date()) throw new BadRequestException("邀请码无效或已过期");
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new BadRequestException("该邮箱已注册");
    const member = await this.prisma.familyMember.findFirst({ where: { id: invitation.memberId, familyId: invitation.familyId } });
    if (!member || member.userId) throw new BadRequestException("该家庭成员已绑定登录账号");
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, displayName: member.name, passwordHash: await hashPassword(input.password) } });
      await tx.familyMember.update({ where: { id: member.id }, data: { userId: created.id } });
      await tx.authInvitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } });
      return created;
    });
    return this.login({ email: user.email, password: input.password });
  }

  private assertLoginAllowed(email: string): void {
    const attempt = this.failedLogins.get(email);
    if (!attempt) return;
    if (attempt.resetAt <= Date.now()) {
      this.failedLogins.delete(email);
      return;
    }
    if (attempt.count >= 5) throw new HttpException("登录尝试过多，请 15 分钟后再试", HttpStatus.TOO_MANY_REQUESTS);
  }

  private recordFailedLogin(email: string): void {
    const current = this.failedLogins.get(email);
    const resetAt = Date.now() + 15 * 60 * 1000;
    const count = current && current.resetAt > Date.now() ? current.count + 1 : 1;
    this.failedLogins.set(email, { count, resetAt });
  }

  private assertAvatarData(value: string): void {
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(value) || Buffer.byteLength(value, "utf8") > 100_000) {
      throw new BadRequestException("头像必须是 100KB 以内的 JPG、PNG 或 WebP 图片");
    }
  }
}

function hashToken(value: string) { return createHash("sha256").update(value).digest("hex"); }
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
