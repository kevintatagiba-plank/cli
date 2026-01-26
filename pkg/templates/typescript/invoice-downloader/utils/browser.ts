import { chromium, type Page, type Browser, type BrowserContext } from "playwright-core";
import { Kernel, type KernelContext } from "@onkernel/sdk";

const kernel = new Kernel();

export async function createBrowserSession(
  ctx: KernelContext
): Promise<{ browser: Browser; context: BrowserContext; page: Page; sessionId: string }> {
  const kernelBrowser = await kernel.browsers.create({
    invocation_id: ctx.invocation_id,
    stealth: true,
  });

  console.log("Kernel browser live view url:", kernelBrowser.browser_live_view_url);

  const browser = await chromium.connectOverCDP(kernelBrowser.cdp_ws_url);
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = context.pages()[0] || (await context.newPage());

  return { browser, context, page, sessionId: kernelBrowser.session_id };
}

export async function cleanupBrowserSession(sessionId: string): Promise<void> {
  await kernel.browsers.deleteByID(sessionId);
}
