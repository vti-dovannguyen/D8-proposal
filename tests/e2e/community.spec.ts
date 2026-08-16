import { test, expect } from "@playwright/test";

const routes = ["/topics", "/announcements", "/agents", "/workspace"];

for (const route of routes) {
  test(`unauthenticated user hitting ${route} is redirected to login`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login/);
  });
}
