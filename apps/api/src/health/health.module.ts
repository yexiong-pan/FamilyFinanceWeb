import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({
  controllers: [HealthController],
  providers: [PrismaService, HealthService]
})
export class HealthModule {}
