import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../auth/password";

const FAMILY_ID = "default-family";

async function main(): Promise<void> {
  const [email, memberName] = process.argv.slice(2);
  const password = process.env.INITIAL_USER_PASSWORD;
  if (!email || !password || !memberName) {
    throw new Error("用法：INITIAL_USER_PASSWORD=密码 npm run auth:create-user -w @family-finance/api -- 邮箱 家庭成员姓名");
  }
  const prisma = new PrismaClient();
  try {
    if (await prisma.user.count()) throw new Error("首个登录用户已存在；请通过网站邀请码添加其他用户");
    await prisma.family.upsert({
      where: { id: FAMILY_ID },
      create: { id: FAMILY_ID, name: "我的家庭" },
      update: {}
    });
    const member = await prisma.familyMember.upsert({
      where: { familyId_name: { familyId: FAMILY_ID, name: memberName } },
      create: { familyId: FAMILY_ID, name: memberName, role: "OWNER" },
      update: {}
    });
    const user = await prisma.user.create({
      data: { email: email.trim().toLowerCase(), displayName: member.name, passwordHash: await hashPassword(password) }
    });
    await prisma.familyMember.update({ where: { id: member.id }, data: { userId: user.id } });
    console.log(`已创建首个登录用户：${user.email}（绑定 ${member.name}）`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
