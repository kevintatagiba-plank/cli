import type { Page } from "playwright-core";
import type { InvoiceData } from "../types";

export async function extractInvoiceDataFromRow(row: any): Promise<InvoiceData | null> {
  const cells = await row.$$('td');
  if (cells.length < 3) return null;

  const id = await cells[0].textContent();
  const date = await cells[1].textContent();
  const amount = await cells[2].textContent();

  return {
    id: id?.trim() || '',
    date: date?.trim() || '',
    amount: amount?.trim() || '',
  };
}

export async function findInvoiceRow(
  page: Page,
  invoiceId: string
): Promise<{ row: any; data: InvoiceData | null } | null> {
  const rows = await page.$$('.invoices-table tbody tr');
  
  for (const row of rows) {
    const rowText = await row.textContent();
    if (rowText && rowText.includes(invoiceId)) {
      const data = await extractInvoiceDataFromRow(row);
      return { row, data };
    }
  }
  
  return null;
}

export async function findFirstInvoiceRow(
  page: Page
): Promise<{ row: any; data: InvoiceData | null } | null> {
  const firstRow = await page.$('.invoices-table tbody tr');
  if (!firstRow) return null;

  const data = await extractInvoiceDataFromRow(firstRow);
  return { row: firstRow, data };
}

export async function findDownloadButton(
  page: Page,
  invoiceId?: string
): Promise<{ button: any; invoiceData: InvoiceData | null }> {
  await page.waitForSelector('.download-btn:visible', { timeout: 10000 });

  let downloadButton = null;
  let invoiceData: InvoiceData | null = null;

  if (invoiceId) {
    const result = await findInvoiceRow(page, invoiceId);
    if (result) {
      downloadButton = await result.row.$('.download-btn');
      invoiceData = result.data;
    }
  }

  if (!downloadButton) {
    downloadButton = await page.$('.download-btn:visible');
    if (downloadButton) {
      const result = await findFirstInvoiceRow(page);
      if (result) {
        invoiceData = result.data;
      }
    }
  }

  if (!downloadButton) {
    throw new Error("Could not find download button. Please check if the invoice exists in the filtered results.");
  }

  return { button: downloadButton, invoiceData };
}
