import { test, expect } from "@playwright/test";

test("unauthenticated user hitting /meetings is redirected to login", async ({ page }) => {
  await page.goto("/meetings");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated user hitting /dashboard is redirected to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
