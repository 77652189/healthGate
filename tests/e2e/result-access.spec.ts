import { expect, test } from "@playwright/test";

test("complete funnel, preview result, pay, and unlock full result", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "基础画像" })).toBeVisible();
  await page.getByRole("button", { name: /保存并继续/ }).click();
  await page.getByRole("button", { name: /保存并继续/ }).click();
  await page.getByRole("button", { name: /保存并继续/ }).click();
  await page.getByRole("button", { name: /保存并继续/ }).click();
  await page.getByRole("button", { name: /保存并继续/ }).click();
  await page.getByRole("button", { name: /保存并继续/ }).click();
  await page.getByRole("button", { name: /保存并继续/ }).click();
  await page.getByRole("button", { name: /生成结果/ }).click();

  await expect(page).toHaveURL(/\/result\?sessionId=/);
  await expect(page.getByRole("heading", { name: "你的健康评估预览" })).toBeVisible();
  await expect(page.getByText("preview")).toBeVisible();
  await expect(page.getByText(/每日建议摄入/)).toHaveCount(0);

  await page.getByRole("button", { name: /模拟支付并解锁/ }).click();
  await expect(page.getByRole("heading", { name: "完整计划已解锁" })).toBeVisible();
  await expect(page.getByText("full")).toBeVisible();
  await expect(page.getByText(/每日建议摄入/)).toBeVisible();
});

test("restores progress after refresh", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /保存并继续/ }).click();
  await expect(page.getByRole("heading", { name: "目标方向" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "目标方向" })).toBeVisible();
});
