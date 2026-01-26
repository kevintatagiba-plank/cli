import { existsSync, readFileSync } from "fs";
import type { Page } from "playwright-core";
import type { DownloadResult } from "../types";
import { findDownloadButton } from "./invoice";
import { setupBlobInterceptor } from "./pdf";

export async function checkNoResults(page: Page): Promise<void> {
  const noResults = await page.$('#noResults');
  if (noResults && (await noResults.isVisible())) {
    throw new Error("No invoices found matching the search criteria.");
  }
}

async function readDownloadedFile(
  page: Page,
  download: any,
  invoiceId?: string
): Promise<DownloadResult> {
  const fileName = download.suggestedFilename() || `invoice-${invoiceId || Date.now()}.pdf`;
  const tempPath = await download.path();

  if (!tempPath) {
    throw new Error("Download path is not available");
  }

  // Wait for file to exist
  let retries = 30;
  while (!existsSync(tempPath) && retries > 0) {
    await page.waitForTimeout(200);
    retries--;
  }

  if (!existsSync(tempPath)) {
    throw new Error(`Downloaded file does not exist at ${tempPath} after waiting`);
  }

  const pdfData = readFileSync(tempPath);
  if (!pdfData || pdfData.length === 0) {
    throw new Error("Downloaded file is empty");
  }

  return {
    fileName,
    fileDataBase64: pdfData.toString('base64'),
  };
}

export async function downloadInvoicePDF(
  page: Page,
  invoiceId?: string
): Promise<DownloadResult | null> {
  await checkNoResults(page);

  const pdfDataPromise = setupBlobInterceptor(page);
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

  const { button: downloadButton } = await findDownloadButton(page, invoiceId);
  await downloadButton.click();

  // Try blob interception first
  try {
    const result = await Promise.race([
      pdfDataPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
    ]);

    const pdfData = Buffer.from(result.base64, 'base64');
    console.log(`Successfully intercepted blob download: ${pdfData.length} bytes`);
    
    return {
      fileName: result.filename,
      fileDataBase64: pdfData.toString('base64'),
    };
  } catch (e) {
    // Fallback to Playwright download event
    console.log('Blob interception failed, trying Playwright download event...');
    const download = await downloadPromise;
    const result = await readDownloadedFile(page, download, invoiceId);
    console.log(`Successfully read ${Buffer.from(result.fileDataBase64, 'base64').length} bytes from file`);
    return result;
  }
}
