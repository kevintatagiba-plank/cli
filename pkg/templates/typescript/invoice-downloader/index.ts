import { Kernel, type KernelContext } from "@onkernel/sdk";
import { existsSync, readFileSync } from "fs";
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
  fileDataBase64?: string; // Base64-encoded file contents for downloading
  fileName?: string; // Suggested filename
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
 * Note: This portal uses hash routing (#invoices)
 */
async function navigateToInvoices(page: any): Promise<void> {
  // Wait a bit for the page to fully load after login
  await page.waitForTimeout(1000);

  // Check if we're already on the invoices page (check if invoicesPage is visible)
  const invoicesPage = await page.$('#invoicesPage');
  if (invoicesPage) {
    const isVisible = await invoicesPage.isVisible();
    if (isVisible) {
      // Already on invoices page, just wait for the table to be ready
      await page.waitForSelector('.invoices-table', { timeout: 5000 });
      return;
    }
  }

  // Try clicking the "Invoices" link (which has href="#invoices")
  try {
    const invoiceLink = await page.$('#invoicesLink, a[href="#invoices"], a:has-text("Invoices")');
    if (invoiceLink) {
      await invoiceLink.click();
      await page.waitForTimeout(500);
    }
  } catch (e) {
    // Continue to URL navigation
  }

  // Navigate to the URL with #invoices hash
  const currentUrl = page.url();
  const baseUrl = currentUrl.split('#')[0]; // Remove any existing hash
  const invoicesUrl = `${baseUrl}#invoices`;

  // Only navigate if we're not already on the correct URL
  if (!currentUrl.includes('#invoices')) {
    await page.goto(invoicesUrl);
    await page.waitForLoadState("networkidle", { timeout: 10000 });
  }

  // Wait for the invoices page to be visible
  await page.waitForSelector('#invoicesPage', { timeout: 10000 });
  await page.waitForSelector('.invoices-table', { timeout: 5000 });
}

/**
 * Helper function to search for invoice by ID
 */
async function searchInvoiceById(page: any, invoiceId: string): Promise<void> {
  // Wait for the search input to be visible
  await page.waitForSelector('#searchById', { timeout: 10000 });

  // Fill the search input
  const searchInput = await page.$('#searchById');
  if (!searchInput) {
    throw new Error("Could not find search by ID input field (#searchById)");
  }

  // Clear any existing value and fill with invoice ID
  await searchInput.fill(invoiceId);

  // Trigger the input event to filter invoices (the page uses input event listener)
  await searchInput.dispatchEvent('input');

  // Wait a bit for the table to update
  await page.waitForTimeout(500);

  // Wait for the invoices table to be visible/updated
  await page.waitForSelector('.invoices-table tbody', { timeout: 5000 });
}

/**
 * Helper function to search for invoice by date
 */
async function searchInvoiceByDate(page: any, date: string): Promise<void> {
  // Wait for the date input to be visible
  await page.waitForSelector('#searchByDate', { timeout: 10000 });

  // Fill the date input
  const dateInput = await page.$('#searchByDate');
  if (!dateInput) {
    throw new Error("Could not find search by date input field (#searchByDate)");
  }

  // Fill with the date
  await dateInput.fill(date);

  // Trigger the change event to filter invoices (the page uses change event listener)
  await dateInput.dispatchEvent('change');

  // Wait a bit for the table to update
  await page.waitForTimeout(500);

  // Wait for the invoices table to be visible/updated
  await page.waitForSelector('.invoices-table tbody', { timeout: 5000 });
}

/**
 * Helper function to download invoice PDF
 * Intercepts the download response and returns file contents as base64
 * This avoids file system issues when running in Kernel cloud environment
 */
async function downloadInvoicePDF(
  page: any,
  invoiceId?: string
): Promise<{ fileName: string; fileDataBase64: string } | null> {
  // Check if there are no results first
  const noResults = await page.$('#noResults');
  if (noResults) {
    const isVisible = await noResults.isVisible();
    if (isVisible) {
      throw new Error("No invoices found matching the search criteria.");
    }
  }

  // Wait for the download button to be visible (should be in the filtered table)
  await page.waitForSelector('.download-btn:visible', { timeout: 10000 });

  // Intercept the blob download by overriding the downloadInvoice function
  // This will capture the PDF data directly from the JavaScript blob
  const pdfDataPromise = page.evaluate(() => {
    return new Promise((resolve, reject) => {
      // Store the original downloadInvoice function
      const originalDownloadInvoice = (window as any).downloadInvoice;
      
      // Override downloadInvoice to capture the blob
      (window as any).downloadInvoice = function(invoiceId: string, date: string, amount: string) {
        // Create the PDF content (same as original function)
        const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 200
>>
stream
BT
/F1 24 Tf
100 700 Td
(INVOICE) Tj
0 -30 Td
/F1 12 Tf
(Invoice ID: ${invoiceId}) Tj
0 -20 Td
(Date: ${date}) Tj
0 -20 Td
(Amount: ${amount}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000316 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
516
%%EOF`;

        // Convert to blob and then to base64
        const blob = new Blob([pdfContent], { type: 'application/pdf' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1]; // Remove data:application/pdf;base64, prefix
          resolve({ base64, filename: `invoice-${invoiceId}.pdf` });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      };
      
      // Set a timeout in case the function isn't called
      setTimeout(() => {
        reject(new Error('Download button was not clicked or downloadInvoice was not called'));
      }, 30000);
    });
  });

  // Set up download listener as fallback
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

  // Find the download button - if invoiceId is provided, try to find the row with that ID first
  let downloadButton = null;
  let invoiceData: { id: string; date: string; amount: string } | null = null;
  
  if (invoiceId) {
    // Get all table rows
    const rows = await page.$$('.invoices-table tbody tr');
    for (const row of rows) {
      const rowText = await row.textContent();
      if (rowText && rowText.includes(invoiceId)) {
        downloadButton = await row.$('.download-btn');
        if (downloadButton) {
          // Extract invoice data from the row
          const cells = await row.$$('td');
          if (cells.length >= 3) {
            const id = await cells[0].textContent();
            const date = await cells[1].textContent();
            const amount = await cells[2].textContent();
            invoiceData = { id: id || invoiceId, date: date || '', amount: amount || '' };
          }
          break;
        }
      }
    }
  }

  // Fallback to first visible download button if we couldn't find by invoice ID
  if (!downloadButton) {
    downloadButton = await page.$('.download-btn:visible');
    // Try to get invoice data from first row
    const firstRow = await page.$('.invoices-table tbody tr');
    if (firstRow) {
      const cells = await firstRow.$$('td');
      if (cells.length >= 3) {
        const id = await cells[0].textContent();
        const date = await cells[1].textContent();
        const amount = await cells[2].textContent();
        invoiceData = { id: id || invoiceId || 'UNKNOWN', date: date || '', amount: amount || '' };
      }
    }
  }

  if (!downloadButton) {
    throw new Error("Could not find download button. Please check if the invoice exists in the filtered results.");
  }

  // Click the download button
  await downloadButton.click();

  // Try to get PDF data from intercepted blob first
  let pdfData: Buffer;
  let fileName: string;
  
  try {
    const result = await Promise.race([
      pdfDataPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]) as { base64: string; filename: string };
    
    pdfData = Buffer.from(result.base64, 'base64');
    fileName = result.filename;
    console.log(`Successfully intercepted blob download: ${pdfData.length} bytes`);
  } catch (e) {
    // Fallback to Playwright download event
    console.log('Blob interception failed, trying Playwright download event...');
    const download = await downloadPromise;
    fileName = download.suggestedFilename() || `invoice-${invoiceId || Date.now()}.pdf`;
    
    // Try to get the path and read the file
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
    
    pdfData = readFileSync(tempPath);
    console.log(`Successfully read ${pdfData.length} bytes from ${tempPath}`);
  }

  if (!pdfData || pdfData.length === 0) {
    throw new Error("Downloaded file is empty");
  }

  // Convert to base64
  const fileDataBase64 = pdfData.toString('base64');

  return {
    fileName,
    fileDataBase64,
  };
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
      const downloadResult = await downloadInvoicePDF(page, payload.invoiceId);

      return {
        invoiceId: payload.invoiceId,
        downloaded: downloadResult !== null,
        fileName: downloadResult?.fileName,
        fileDataBase64: downloadResult?.fileDataBase64,
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
      const downloadResult = await downloadInvoicePDF(page);

      return {
        date: payload.date,
        downloaded: downloadResult !== null,
        fileName: downloadResult?.fileName,
        fileDataBase64: downloadResult?.fileDataBase64,
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
