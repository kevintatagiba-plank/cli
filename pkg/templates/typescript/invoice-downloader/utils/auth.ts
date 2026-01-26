import type { Page } from "playwright-core";

export async function fillInputField(page: Page, selector: string, value: string): Promise<void> {
  const input = await page.$(selector);
  if (!input) {
    throw new Error(`Could not find input field with selector: ${selector}`);
  }
  await input.fill(value);
}

export async function submitLoginForm(page: Page): Promise<void> {
  const submitSelector =
    'button[type="submit"]:visible, input[type="submit"]:visible, button:has-text("Sign in"):visible, button:has-text("Log in"):visible, button:has-text("Login"):visible';
  const submitButton = await page.$(submitSelector);
  
  if (submitButton) {
    await submitButton.click();
  } else {
    await page.keyboard.press("Enter");
  }
}

export async function verifyLoginSuccess(page: Page): Promise<void> {
  const currentUrl = page.url();
  if (currentUrl.includes("login") || currentUrl.includes("signin")) {
    throw new Error("Login may have failed - still on login page. Please check credentials and selectors.");
  }
}

export async function loginToPortal(
  page: Page,
  portalUrl: string,
  username: string,
  password: string
): Promise<void> {
  await page.goto(portalUrl);
  await page.waitForSelector('input[type="email"], input[name="username"], input[id="username"]', {
    timeout: 10000,
  });

  const usernameSelector =
    'input[type="email"]:visible, input[name="username"]:visible, input[id="username"]:visible, input[placeholder*="email" i]:visible, input[placeholder*="username" i]:visible';
  await fillInputField(page, usernameSelector, username);

  const passwordSelector = 'input[type="password"]:visible';
  await fillInputField(page, passwordSelector, password);

  await submitLoginForm(page);
  await page.waitForLoadState("networkidle", { timeout: 30000 });
  await verifyLoginSuccess(page);
}
