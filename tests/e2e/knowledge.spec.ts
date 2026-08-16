import { test, expect } from "@playwright/test";

test("unauthenticated user hitting /knowledge is redirected to login", async ({ page }) => {
  await page.goto("/knowledge");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated user hitting /knowledge/documents is redirected to login", async ({ page }) => {
  await page.goto("/knowledge/documents");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated user hitting /knowledge/wiki is redirected to login", async ({ page }) => {
  await page.goto("/knowledge/wiki");
  await expect(page).toHaveURL(/\/login/);
});
