import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (process.env.NODE_ENV !== "production") {
    app.enableCors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true
    });
  }
  app.setGlobalPrefix("api");

  const port = Number.parseInt(process.env.API_PORT ?? "4000", 10);
  await app.listen(port);
  console.log(`Family Finance API listening on http://localhost:${port}/api`);
}

void bootstrap();
