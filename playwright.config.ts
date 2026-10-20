import { defineConfig, devices } from "@playwright/test";

// 다른 앱이 3000번을 쓰고 있을 수 있어 전용 포트를 쓴다. 페이지별 개발 컴파일이 느려서 프로덕션 빌드로 돌린다.
const port = Number(process.env.E2E_PORT ?? 3200);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 900_000,
  expect: { timeout: 20_000 },
  use: { baseURL },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npx next build && npx next start -p ${port}`, url: `${baseURL}/login`, reuseExistingServer: false, timeout: 300_000 },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL ?? "chrome" } }],
});
