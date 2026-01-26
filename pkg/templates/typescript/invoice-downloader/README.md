# Kernel TypeScript Invoice Downloader Template

A browser automation app that logs into vendor/billing portals, locates invoices by ID or date, and downloads PDF files.

## What it does

The template provides two actions:

- **`download-invoice-by-id`**: Searches for and downloads an invoice by its invoice ID
- **`download-invoice-by-date`**: Searches for and downloads an invoice by date (YYYY-MM-DD format)

Both actions:
1. Create a Kernel browser session with stealth mode
2. Navigate to the billing portal
3. Log in using credentials from environment variables
4. Navigate to the invoices section
5. Search/filter for the target invoice
6. Download the invoice PDF
7. Return metadata about the download

## Input

### Download Invoice by ID

```json
{
  "invoiceId": "INV-12345",  // Required: The invoice ID to search for
  "portalUrl": "https://example.com"  // Optional: Override PORTAL_URL env var
}
```

### Download Invoice by Date

```json
{
  "date": "2024-01-15",  // Required: Date in YYYY-MM-DD format
  "portalUrl": "https://example.com"  // Optional: Override PORTAL_URL env var
}
```

## Output

```json
{
  "invoiceId": "INV-12345",  // Present for ID-based downloads
  "date": "2024-01-15",      // Present for date-based downloads
  "downloaded": true,        // Whether the download was successful
  "filePath": "/tmp/invoice-INV-12345.pdf",  // Path to downloaded file (if successful)
  "error": "Error message"   // Error message (if download failed)
}
```

## Setup

1. **Install dependencies:**

```bash
pnpm install
```

2. **Set up environment variables:**

```bash
cp .env.example .env
# Edit .env with your portal credentials
```

Required environment variables:
- `PORTAL_URL`: The URL of your vendor/billing portal
- `PORTAL_USERNAME`: Your login username
- `PORTAL_PASSWORD`: Your login password

## Customization

This template uses generic selectors that work with common billing portals. **You will need to customize the selectors** in `index.ts` to match your specific portal's HTML structure.

### Key areas to customize:

1. **Login form selectors** (in `loginToPortal` function):
   - Username/email input field
   - Password input field
   - Submit button

2. **Navigation to invoices** (in `navigateToInvoices` function):
   - Link/button to access invoices section
   - Or direct URL path to invoices

3. **Search functionality** (in `searchInvoiceById` and `searchInvoiceByDate` functions):
   - Search input field for invoice ID
   - Date filter inputs for date-based search

4. **Download button** (in `downloadInvoicePDF` function):
   - Download button/link selector
   - PDF download link

### Example customization:

```typescript
// Instead of generic selectors, use your portal's specific selectors:
await page.fill('#username-input', username);
await page.fill('#password-input', password);
await page.click('button.login-submit');
```

## Deploy

```bash
# Login to Kernel
kernel login

# Deploy the app with environment variables
kernel deploy index.ts --env-file .env
```

## Invoke

### Download by Invoice ID

```bash
kernel invoke ts-invoice-downloader download-invoice-by-id --payload '{"invoiceId": "INV-12345"}'
```

### Download by Date

```bash
kernel invoke ts-invoice-downloader download-invoice-by-date --payload '{"date": "2024-01-15"}'
```

## Browser Live View

When you invoke an action, you'll see a browser live view URL in the console output. This allows you to watch the automation in real-time, which is helpful for:
- Debugging selector issues
- Verifying login success
- Confirming invoice search results
- Watching the download process

## Error Handling

The template includes comprehensive error handling:
- Validates required inputs
- Checks environment variables
- Handles login failures
- Catches download errors
- Returns descriptive error messages

If an action fails, check the `error` field in the response for details.

## Notes

- The template saves downloaded PDFs to `/tmp/` by default. You may want to customize the save path based on your needs.
- Download timeouts are set to 30 seconds. Adjust if your portal takes longer to generate PDFs.
- The template uses stealth mode to avoid detection, but some portals may still require additional configuration.
- For portals with CAPTCHA or 2FA, you may need to add additional handling logic.

## Learn More

- [Kernel Documentation](https://www.kernel.sh/docs)
- [Playwright Documentation](https://playwright.dev)
- [Kernel Browser Live View](https://www.kernel.sh/docs/browsers/live-view)
