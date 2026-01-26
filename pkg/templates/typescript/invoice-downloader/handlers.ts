import type { Page } from "playwright-core";
import type { KernelContext } from "@onkernel/sdk";
import type { DownloadInvoiceOutput, DownloadResult } from "./types";
import { PORTAL_USERNAME, PORTAL_PASSWORD, validateEnvironment } from "./config";
import { createBrowserSession, cleanupBrowserSession } from "./utils/browser";
import { loginToPortal } from "./utils/auth";
import { navigateToInvoicesPage } from "./utils/navigation";
import { downloadInvoicePDF } from "./utils/download";

export async function executeInvoiceDownload(
  ctx: KernelContext,
  portalUrl: string,
  searchFn: (page: Page) => Promise<void>,
  downloadFn: (page: Page) => Promise<DownloadResult | null>
): Promise<DownloadInvoiceOutput> {
  validateEnvironment();

  const { page, sessionId } = await createBrowserSession(ctx);

  try {
    console.log("Logging into portal...");
    await loginToPortal(page, portalUrl, PORTAL_USERNAME!, PORTAL_PASSWORD!);
    console.log("Login successful");

    console.log("Navigating to invoices section...");
    await navigateToInvoicesPage(page);

    await searchFn(page);

    console.log("Downloading invoice PDF...");
    const downloadResult = await downloadFn(page);

    return {
      downloaded: downloadResult !== null,
      fileName: downloadResult?.fileName,
      fileDataBase64: downloadResult?.fileDataBase64,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error downloading invoice:", errorMessage);
    return {
      downloaded: false,
      error: errorMessage,
    };
  } finally {
    await cleanupBrowserSession(sessionId);
  }
}
