import { test, expect } from "@playwright/test";

test("unauthenticated user is redirected to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Đăng nhập với Google")).toBeVisible();
});

test("login page states the domain restriction", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("@vti.com.vn")).toBeVisible();
});
