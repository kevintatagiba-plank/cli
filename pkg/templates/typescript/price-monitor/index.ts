import { Stagehand } from "@browserbasehq/stagehand";
import { Kernel, type KernelContext } from '@onkernel/sdk';
import { z } from 'zod';

const kernel = new Kernel();

const app = kernel.app('ts-price-monitor');

interface PriceMonitorInput {
  url: string;
  itemName?: string; // Optional: helps identify the item on the page
}

interface PriceMonitorOutput {
  price: string;
  currency?: string;
  itemName?: string;
  url: string;
}

// LLM API Keys are set in the environment during `kernel deploy <filename> -e OPENAI_API_KEY=XXX`
// See https://www.kernel.sh/docs/apps/deploy#environment-variables
//
// Kernel authentication is handled automatically by the SDK:
// - Run `kernel login` to authenticate with OAuth, or
// - Set KERNEL_API_KEY environment variable (get from https://dashboard.onkernel.com/api-keys)

app.action<PriceMonitorInput, PriceMonitorOutput>(
  'monitor-price',
  async (ctx: KernelContext, payload?: PriceMonitorInput): Promise<PriceMonitorOutput> => {
    // A function that monitors the price of an item on a website

    // Args:
    //     ctx: Kernel context containing invocation information
    //     payload: An object containing the URL and optional item name

    // Returns:
    //     output: The current price of the item, along with currency and item name if available

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set. Please deploy with: kernel deploy index.ts -e OPENAI_API_KEY=your_key');
    }

    if (!payload?.url) {
      throw new Error('URL is required');
    }

    // Validate and normalize URL
    let url = payload.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }

    const kernelBrowser = await kernel.browsers.create({
      invocation_id: ctx.invocation_id,
      stealth: true,
    });

    console.log("Kernel browser live view url: ", kernelBrowser.browser_live_view_url);

    const stagehand = new Stagehand({
      env: "LOCAL",
      localBrowserLaunchOptions: {
        cdpUrl: kernelBrowser.cdp_ws_url,
      },
      model: "openai/gpt-4o",
      apiKey: OPENAI_API_KEY,
      verbose: 1,
      domSettleTimeout: 30_000
    });
    await stagehand.init();

    try {
      /////////////////////////////////////
      // Your Stagehand implementation here
      /////////////////////////////////////
      const page = stagehand.context.pages()[0];

      if (!page) {
        throw new Error("No page found");
      }

      // Navigate to the product page
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Wait for page to be ready (using Playwright's native method)
      // waitForLoadState accepts state as first param and timeout (ms) as second param
      try {
        await page.waitForLoadState('networkidle', 10000);
      } catch {
        // If networkidle times out, continue anyway - page might be loaded
      }

      // Zoom out to 25% to see more of the page at once
      // This helps when prices might be below the fold or require scrolling
      await page.evaluate(() => {
        document.body.style.transform = 'scale(0.25)';
        document.body.style.transformOrigin = 'top left';
      });
      console.log("Zoomed out to 25% to maximize page visibility");

      // Note: itemName is only used in the extraction prompt below to help identify
      // which price to extract. We do NOT click or navigate - the URL should already
      // point to the product page.

      // Schema definition for price extraction
      const priceSchema = z.object({
        price: z.string().describe("The current price of the item as a string (e.g., '999.99', 'R$ 1.299,00', '$1,299.00')"),
        currency: z.string().optional().describe("The full currency name in English (e.g., 'US Dollar', 'Brazilian Real', 'Euro', 'British Pound'). Convert symbols to full names: $ = US Dollar, R$ = Brazilian Real, € = Euro, £ = British Pound, etc."),
        itemName: z.string().optional().describe("The name of the item if visible on the page"),
      });

      // Extract price information from the page with more specific instructions
      const extractionPrompt = payload.itemName
        ? `Extract the current price information for "${payload.itemName}" from this product page. Look for:
- The main product price (usually displayed prominently, may be in a price box or near "Add to Cart")
- The currency: Convert the currency symbol to its full name in English (e.g., $ = "US Dollar", R$ = "Brazilian Real", € = "Euro", £ = "British Pound", ¥ = "Japanese Yen", etc.)
- The item name if it's different from "${payload.itemName}"

The price might be displayed as "R$ 1.299,00" or "$1,299.00" or similar formats. Extract the complete price string including any formatting. For the currency field, provide the full currency name, not just the symbol.`
        : `Extract the current price information from this product page. Look for:
- The main product price (usually displayed prominently, may be in a price box or near "Add to Cart")
- The currency: Convert the currency symbol to its full name in English (e.g., $ = "US Dollar", R$ = "Brazilian Real", € = "Euro", £ = "British Pound", ¥ = "Japanese Yen", etc.)
- The item name

The price might be displayed as "R$ 1.299,00" or "$1,299.00" or similar formats. Extract the complete price string including any formatting. For the currency field, provide the full currency name, not just the symbol.`;

      const output = await stagehand.extract(extractionPrompt, priceSchema);

      return {
        ...output,
        url: url,
      };
    } finally {
      // Always clean up resources, even if an error occurred
      try {
        await stagehand.close();
      } catch (closeError) {
        console.error("Error closing Stagehand:", closeError);
      }
      try {
        await kernel.browsers.deleteByID(kernelBrowser.session_id);
      } catch (deleteError) {
        console.error("Error deleting browser:", deleteError);
      }
    }
  },
);
