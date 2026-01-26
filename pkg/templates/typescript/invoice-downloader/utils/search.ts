import type { Page } from "playwright-core";

async function fillSearchInput(
  page: Page,
  selector: string,
  value: string,
  eventType: 'input' | 'change'
): Promise<void> {
  await page.waitForSelector(selector, { timeout: 10000 });
  const input = await page.$(selector);
  
  if (!input) {
    throw new Error(`Could not find search input field: ${selector}`);
  }

  await input.fill(value);
  await input.dispatchEvent(eventType);
  await page.waitForTimeout(500);
  await page.waitForSelector('.invoices-table tbody', { timeout: 5000 });
}

export async function searchInvoiceById(page: Page, invoiceId: string): Promise<void> {
  await fillSearchInput(page, '#searchById', invoiceId, 'input');
}

export async function searchInvoiceByDate(page: Page, date: string): Promise<void> {
  await fillSearchInput(page, '#searchByDate', date, 'change');
}
