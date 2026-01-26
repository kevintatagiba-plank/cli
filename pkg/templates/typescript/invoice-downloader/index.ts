import { Kernel, type KernelContext } from "@onkernel/sdk";
import { chromium } from "playwright-core";

const kernel = new Kernel();

const app = kernel.app("ts-invoice-downloader");

// Environment variables
const PORTAL_URL = process.env.PORTAL_URL;
const PORTAL_USERNAME = process.env.PORTAL_USERNAME;
const PORTAL_PASSWORD = process.env.PORTAL_PASSWORD;

interface DownloadInvoiceByIdInput {
  invoiceId: string;
  portalUrl?: string;
}

interface DownloadInvoiceByDateInput {
  date: string; // ISO date string or YYYY-MM-DD format
  portalUrl?: string;
}

interface DownloadInvoiceOutput {
  invoiceId?: string;
  date?: string;
  downloaded: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Helper function to perform login to the billing portal
 * Note: You'll need to customize the selectors based on your specific portal
 */
async function loginToPortal(
  page: any,
  portalUrl: string,
  username: string,
  password: string
): Promise<void> {
  await page.goto(portalUrl);
  
  // Wait for login form to be visible
  // TODO: Customize these selectors based on your portal
  await page.waitForSelector('input[type="email"], input[name="username"], input[id="username"]', { timeout: 10000 });
  
  // Fill username - try common selectors
  const usernameSelector = 'input[type="email"]:visible, input[name="username"]:visible, input[id="username"]:visible, input[placeholder*="email" i]:visible, input[placeholder*="username" i]:visible';
  const usernameInput = await page.$(usernameSelector);
  if (usernameInput) {
    await usernameInput.fill(username);
  } else {
    throw new Error("Could not find username/email input field. Please customize the selector.");
  }
  
  // Fill password
  const passwordSelector = 'input[type="password"]:visible';
  const passwordInput = await page.$(passwordSelector);
  if (passwordInput) {
    await passwordInput.fill(password);
  } else {
    throw new Error("Could not find password input field. Please customize the selector.");
  }
  
  // Submit login form
  const submitSelector = 'button[type="submit"]:visible, input[type="submit"]:visible, button:has-text("Sign in"):visible, button:has-text("Log in"):visible, button:has-text("Login"):visible';
  const submitButton = await page.$(submitSelector);
  if (submitButton) {
    await submitButton.click();
  } else {
    // Try pressing Enter as fallback
    await page.keyboard.press("Enter");
  }
  
  // Wait for navigation after login (adjust timeout and selector as needed)
  await page.waitForLoadState("networkidle", { timeout: 30000 });
  
  // Verify login was successful (customize this check based on your portal)
  const currentUrl = page.url();
  if (currentUrl.includes("login") || currentUrl.includes("signin")) {
    throw new Error("Login may have failed - still on login page. Please check credentials and selectors.");
  }
}

/**
 * Helper function to navigate to invoices section
 * Note: You'll need to customize this based on your portal's navigation
 */
async function navigateToInvoices(page: any): Promise<void> {
  // TODO: Customize this navigation based on your portal
  // Common patterns:
  // - Click on "Invoices" link in navigation menu
  // - Navigate to /invoices URL directly
  // - Click on "Billing" then "Invoices"
  
  // Try common invoice navigation patterns
  const invoiceLinkSelectors = [
    'a:has-text("Invoices"):visible',
    'a:has-text("Billing"):visible',
    'nav a[href*="invoice" i]:visible',
    'button:has-text("Invoices"):visible'
  ];
  
  let navigated = false;
  for (const selector of invoiceLinkSelectors) {
    try {
      const link = await page.$(selector);
      if (link) {
        await link.click();
        await page.waitForLoadState("networkidle", { timeout: 10000 });
        navigated = true;
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  if (!navigated) {
    // Try direct URL navigation
    const currentUrl = new URL(page.url());
    const invoicesUrl = `${currentUrl.origin}/invoices`;
    try {
      await page.goto(invoicesUrl);
      await page.waitForLoadState("networkidle", { timeout: 10000 });
    } catch (e) {
      console.warn("Could not automatically navigate to invoices. Please customize the navigation logic.");
    }
  }
}

/**
 * Helper function to search for invoice by ID
 */
async function searchInvoiceById(page: any, invoiceId: string): Promise<void> {
  // TODO: Customize search selectors based on your portal
  // Common patterns:
  // - Search input field
  // - Filter by invoice ID
  // - Direct link to invoice
  
  // Try common search patterns
  const searchSelectors = [
    'input[type="search"]:visible',
    'input[placeholder*="search" i]:visible',
    'input[placeholder*="invoice" i]:visible',
    'input[name="search"]:visible',
    'input[id="search"]:visible'
  ];
  
  let searched = false;
  for (const selector of searchSelectors) {
    try {
      const searchInput = await page.$(selector);
      if (searchInput) {
        await searchInput.fill(invoiceId);
        await page.keyboard.press("Enter");
        await page.waitForLoadState("networkidle", { timeout: 10000 });
        searched = true;
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  if (!searched) {
    console.warn("Could not find search input. Please customize the search logic.");
  }
}

/**
 * Helper function to search for invoice by date
 */
async function searchInvoiceByDate(page: any, date: string): Promise<void> {
  // TODO: Customize date filter selectors based on your portal
  // Common patterns:
  // - Date picker inputs
  // - Filter dropdowns
  // - Date range selectors
  
  // Try common date filter patterns
  const dateInputSelectors = [
    'input[type="date"]:visible',
    'input[placeholder*="date" i]:visible',
    'input[name*="date" i]:visible'
  ];
  
  let filtered = false;
  for (const selector of dateInputSelectors) {
    try {
      const dateInput = await page.$(selector);
      if (dateInput) {
        await dateInput.fill(date);
        await page.keyboard.press("Enter");
        await page.waitForLoadState("networkidle", { timeout: 10000 });
        filtered = true;
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  if (!filtered) {
    console.warn("Could not find date filter input. Please customize the date filter logic.");
  }
}

/**
 * Helper function to download invoice PDF
 */
async function downloadInvoicePDF(page: any, invoiceId?: string): Promise<string | null> {
  // TODO: Customize download button/link selectors based on your portal
  // Common patterns:
  // - Download button next to invoice
  // - Download link in invoice details
  // - PDF icon/link
  
  // Set up download listener
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
  
  // Try common download button patterns
  const downloadSelectors = [
    `button:has-text("Download"):visible`,
    `a:has-text("Download"):visible`,
    `button:has-text("PDF"):visible`,
    `a[href*=".pdf" i]:visible`,
    `button[aria-label*="download" i]:visible`,
    `a[download]:visible`
  ];
  
  let downloaded = false;
  for (const selector of downloadSelectors) {
    try {
      const downloadButton = await page.$(selector);
      if (downloadButton) {
        await downloadButton.click();
        const download = await downloadPromise;
        
        // Save the download (adjust path as needed)
        const fileName = download.suggestedFilename() || `invoice-${invoiceId || Date.now()}.pdf`;
        const filePath = `/tmp/${fileName}`;
        await download.saveAs(filePath);
        
        downloaded = true;
        return filePath;
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  if (!downloaded) {
    throw new Error("Could not find download button. Please customize the download selector.");
  }
  
  return null;
}

/**
 * Action: Download invoice by ID
 * 
 * Logs into the billing portal, searches for an invoice by ID, and downloads the PDF.
 * 
 * Args:
 *     ctx: Kernel context containing invocation information
 *     payload: An object with invoiceId and optional portalUrl
 * Returns:
 *     An object containing download status and file path
 * 
 * Invoke this via CLI:
 *  kernel login  # or: export KERNEL_API_KEY=<your_api_key>
 *  kernel deploy index.ts --env-file .env
 *  kernel invoke ts-invoice-downloader download-invoice-by-id --payload '{"invoiceId": "INV-12345"}'
 */
app.action<DownloadInvoiceByIdInput, DownloadInvoiceOutput>(
  "download-invoice-by-id",
  async (
    ctx: KernelContext,
    payload?: DownloadInvoiceByIdInput
  ): Promise<DownloadInvoiceOutput> => {
    if (!payload?.invoiceId) {
      throw new Error("invoiceId is required");
    }

    const portalUrl = payload.portalUrl || PORTAL_URL;
    if (!portalUrl) {
      throw new Error("PORTAL_URL is required (either in payload or environment variables)");
    }

    if (!PORTAL_USERNAME || !PORTAL_PASSWORD) {
      throw new Error("PORTAL_USERNAME and PORTAL_PASSWORD are required in environment variables");
    }

    const kernelBrowser = await kernel.browsers.create({
      invocation_id: ctx.invocation_id,
      stealth: true,
    });

    console.log(
      "Kernel browser live view url: ",
      kernelBrowser.browser_live_view_url
    );

    const browser = await chromium.connectOverCDP(kernelBrowser.cdp_ws_url);
    const context = browser.contexts()[0] || (await browser.newContext());
    const page = context.pages()[0] || (await context.newPage());

    try {
      // Login to portal
      console.log("Logging into portal...");
      await loginToPortal(page, portalUrl, PORTAL_USERNAME, PORTAL_PASSWORD);
      console.log("Login successful");

      // Navigate to invoices
      console.log("Navigating to invoices section...");
      await navigateToInvoices(page);

      // Search for invoice by ID
      console.log(`Searching for invoice: ${payload.invoiceId}`);
      await searchInvoiceById(page, payload.invoiceId);

      // Download the invoice PDF
      console.log("Downloading invoice PDF...");
      const filePath = await downloadInvoicePDF(page, payload.invoiceId);

      return {
        invoiceId: payload.invoiceId,
        downloaded: filePath !== null,
        filePath: filePath || undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error downloading invoice:", errorMessage);
      return {
        invoiceId: payload.invoiceId,
        downloaded: false,
        error: errorMessage,
      };
    } finally {
      await kernel.browsers.deleteByID(kernelBrowser.session_id);
    }
  }
);

/**
 * Action: Download invoice by date
 * 
 * Logs into the billing portal, searches for an invoice by date, and downloads the PDF.
 * 
 * Args:
 *     ctx: Kernel context containing invocation information
 *     payload: An object with date (YYYY-MM-DD or ISO format) and optional portalUrl
 * Returns:
 *     An object containing download status, invoice ID (if found), and file path
 * 
 * Invoke this via CLI:
 *  kernel login  # or: export KERNEL_API_KEY=<your_api_key>
 *  kernel deploy index.ts --env-file .env
 *  kernel invoke ts-invoice-downloader download-invoice-by-date --payload '{"date": "2024-01-15"}'
 */
app.action<DownloadInvoiceByDateInput, DownloadInvoiceOutput>(
  "download-invoice-by-date",
  async (
    ctx: KernelContext,
    payload?: DownloadInvoiceByDateInput
  ): Promise<DownloadInvoiceOutput> => {
    if (!payload?.date) {
      throw new Error("date is required (format: YYYY-MM-DD)");
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(payload.date)) {
      throw new Error("date must be in YYYY-MM-DD format");
    }

    const portalUrl = payload.portalUrl || PORTAL_URL;
    if (!portalUrl) {
      throw new Error("PORTAL_URL is required (either in payload or environment variables)");
    }

    if (!PORTAL_USERNAME || !PORTAL_PASSWORD) {
      throw new Error("PORTAL_USERNAME and PORTAL_PASSWORD are required in environment variables");
    }

    const kernelBrowser = await kernel.browsers.create({
      invocation_id: ctx.invocation_id,
      stealth: true,
    });

    console.log(
      "Kernel browser live view url: ",
      kernelBrowser.browser_live_view_url
    );

    const browser = await chromium.connectOverCDP(kernelBrowser.cdp_ws_url);
    const context = browser.contexts()[0] || (await browser.newContext());
    const page = context.pages()[0] || (await context.newPage());

    try {
      // Login to portal
      console.log("Logging into portal...");
      await loginToPortal(page, portalUrl, PORTAL_USERNAME, PORTAL_PASSWORD);
      console.log("Login successful");

      // Navigate to invoices
      console.log("Navigating to invoices section...");
      await navigateToInvoices(page);

      // Search for invoice by date
      console.log(`Searching for invoice by date: ${payload.date}`);
      await searchInvoiceByDate(page, payload.date);

      // Download the invoice PDF
      console.log("Downloading invoice PDF...");
      const filePath = await downloadInvoicePDF(page);

      return {
        date: payload.date,
        downloaded: filePath !== null,
        filePath: filePath || undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error downloading invoice:", errorMessage);
      return {
        date: payload.date,
        downloaded: false,
        error: errorMessage,
      };
    } finally {
      await kernel.browsers.deleteByID(kernelBrowser.session_id);
    }
  }
);
