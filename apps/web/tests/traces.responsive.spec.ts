import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { resolveMockWarplaneApiResponse } from "../src/test-utils/mockWarplaneApi.js";

const SCREENSHOT_DIR = "test-results/responsive";

async function captureScreenshot(page: Page, name: string) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}`, fullPage: true });
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > window.innerWidth + 1;
  });

  expect(hasOverflow).toBe(false);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    const isMockedEndpoint = url.includes("/api/v1/") || url.endsWith("/health");

    if (!isMockedEndpoint) {
      await route.continue();
      return;
    }

    const { status, body } = resolveMockWarplaneApiResponse(url);
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
});

test("desktop traces workspace uses a full-width control panel at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto("/traces");

  await expect(page.getByText("Showing 4 of 4 traces")).toBeVisible();
  await expect(page.getByTestId("trace-filter-inline")).toBeVisible();
  await expect(page.getByTestId("trace-results-bar")).toBeVisible();
  await expect(page.getByTestId("trace-table-desktop")).toBeVisible();
  await expect(page.getByTestId("trace-cards-mobile")).toBeHidden();
  await expect(page.locator(".trace-workspace-controls-top")).toHaveCSS("flex-direction", "row");
  await expect(page.locator(".trace-workspace-results-bar")).toHaveCSS("position", "sticky");

  await captureScreenshot(page, "traces-1280.png");
});

test("tablet traces workspace stacks cleanly at 1024px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 1100 });
  await page.goto("/traces");

  await expect(page.getByText("Showing 4 of 4 traces")).toBeVisible();
  await expect(page.getByTestId("trace-filter-inline")).toBeVisible();
  await expect(page.locator(".trace-workspace-controls-top")).toHaveCSS("flex-direction", "column");

  const fieldRows = await page.locator(".trace-workspace-filter-field").evaluateAll((elements) => {
    return [...new Set(elements.map((element) => Math.round(element.getBoundingClientRect().top)))];
  });
  expect(fieldRows.length).toBe(2);

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, "traces-1024.png");
});

test("mobile drawer flow works at 768px", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1100 });
  await page.goto("/traces?status=pending");

  await expect(page.getByTestId("trace-mobile-toolbar")).toBeVisible();
  await expect(page.getByTestId("trace-table-desktop")).toBeHidden();
  await expect(page.getByTestId("trace-cards-mobile")).toBeVisible();
  await expect(page.getByText("1 active filter")).toBeVisible();

  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByTestId("trace-filter-drawer")).toBeVisible();

  await page.getByLabel("Scenario filter").selectOption("retry_recovered");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("trace-filter-drawer")).toBeHidden();

  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByTestId("trace-filter-drawer")).toBeVisible();
  await expect(page.getByLabel("Scenario filter")).toHaveValue("");

  await page.getByLabel("Scenario filter").selectOption("retry_recovered");
  await page.getByRole("button", { name: "Apply filters" }).click();

  await expect(page).toHaveURL(/\/traces\?/);
  const searchParams = new URL(page.url()).searchParams;
  expect(searchParams.get("status")).toBe("pending");
  expect(searchParams.get("scenario")).toBe("retry_recovered");
  await expect(page.getByText("2 active filters")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, "traces-768.png");
});

test("small phone drawer stacks controls at 480px", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 1000 });
  await page.goto("/traces");

  await expect(page.getByTestId("trace-mobile-toolbar")).toBeVisible();
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByTestId("trace-filter-drawer")).toBeVisible();

  await expect(page.locator(".trace-workspace-filter-actions")).toHaveCSS(
    "flex-direction",
    "column",
  );
  await expect(page.locator(".trace-filter-drawer")).toHaveCSS("width", "480px");
  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, "traces-480.png");
});
