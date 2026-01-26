import type { Page } from "playwright-core";

export async function isInvoicesPageVisible(page: Page): Promise<boolean> {
  const invoicesPage = await page.$('#invoicesPage');
  if (!invoicesPage) return false;
  return await invoicesPage.isVisible();
}

export async function navigateToInvoicesPage(page: Page): Promise<void> {
  await page.waitForTimeout(1000);

  if (await isInvoicesPageVisible(page)) {
    await page.waitForSelector('.invoices-table', { timeout: 5000 });
    return;
  }

  // Try clicking the invoices link
  try {
    const invoiceLink = await page.$('#invoicesLink, a[href="#invoices"], a:has-text("Invoices")');
    if (invoiceLink) {
      await invoiceLink.click();
      await page.waitForTimeout(500);
    }
  } catch (e) {
    // Continue to URL navigation
  }

  // Navigate via URL hash
  const currentUrl = page.url();
  const baseUrl = currentUrl.split('#')[0];
  const invoicesUrl = `${baseUrl}#invoices`;

  if (!currentUrl.includes('#invoices')) {
    await page.goto(invoicesUrl);
    await page.waitForLoadState("networkidle", { timeout: 10000 });
  }

  await page.waitForSelector('#invoicesPage', { timeout: 10000 });
  await page.waitForSelector('.invoices-table', { timeout: 5000 });
}
