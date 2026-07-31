import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PrismaService } from "../prisma.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Global()
@Module({
  controllers: [AuthController],
  providers: [PrismaService, AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService]
})
export class AuthModule {}
