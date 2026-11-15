import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://kitabxana@localhost:5434/kitabxana_test",
      MAIL_MODE: "log",
      ALLOWED_EMAIL_DOMAINS: "qu.edu.az",
      APP_URL: "http://localhost:3000",
    },
  },
});
