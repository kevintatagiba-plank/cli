import { Kernel, type KernelContext } from "@onkernel/sdk";
import type {
  DownloadInvoiceByIdInput,
  DownloadInvoiceByDateInput,
  DownloadInvoiceOutput,
} from "./types";
import { KernelBrowserSession } from "./session";
import { invoiceDownloadLoop } from "./loop";

const kernel = new Kernel();
const app = kernel.app("ts-invoice-downloader");

// Environment variables for portal credentials
const PORTAL_URL = process.env.PORTAL_URL;
const PORTAL_USERNAME = process.env.PORTAL_USERNAME;
const PORTAL_PASSWORD = process.env.PORTAL_PASSWORD;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is required");
}

app.action<DownloadInvoiceByIdInput, DownloadInvoiceOutput>(
  "download-invoice-by-id",
  async (ctx: KernelContext, payload?: DownloadInvoiceByIdInput): Promise<DownloadInvoiceOutput> => {
    if (!payload?.invoiceId) {
      throw new Error("invoiceId is required");
    }

    const portalUrl = payload.portalUrl || PORTAL_URL;
    const username = payload.username || PORTAL_USERNAME;
    const password = payload.password || PORTAL_PASSWORD;

    if (!portalUrl) throw new Error("Portal URL is required");
    if (!username) throw new Error("Username is required");
    if (!password) throw new Error("Password is required");

    const session = new KernelBrowserSession(kernel, {
      stealth: true,
      recordReplay: payload.recordReplay ?? false,
    });

    await session.start();
    console.log("Browser live view:", session.liveViewUrl);

    try {
      const result = await invoiceDownloadLoop({
        portalUrl,
        username,
        password,
        invoiceIdentifier: payload.invoiceId,
        identifierType: "id",
        apiKey: ANTHROPIC_API_KEY,
        kernel,
        sessionId: session.sessionId,
      });

      const sessionInfo = await session.stop();

      return {
        invoiceId: payload.invoiceId,
        success: result.success,
        message: result.message,
        replayUrl: sessionInfo.replayViewUrl,
      };
    } catch (error) {
      await session.stop();
      throw error;
    }
  }
);

app.action<DownloadInvoiceByDateInput, DownloadInvoiceOutput>(
  "download-invoice-by-date",
  async (ctx: KernelContext, payload?: DownloadInvoiceByDateInput): Promise<DownloadInvoiceOutput> => {
    if (!payload?.date) {
      throw new Error("date is required (format: YYYY-MM-DD)");
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(payload.date)) {
      throw new Error("date must be in YYYY-MM-DD format");
    }

    const portalUrl = payload.portalUrl || PORTAL_URL;
    const username = payload.username || PORTAL_USERNAME;
    const password = payload.password || PORTAL_PASSWORD;

    if (!portalUrl) throw new Error("Portal URL is required");
    if (!username) throw new Error("Username is required");
    if (!password) throw new Error("Password is required");

    const session = new KernelBrowserSession(kernel, {
      stealth: true,
      recordReplay: payload.recordReplay ?? false,
    });

    await session.start();
    console.log("Browser live view:", session.liveViewUrl);

    try {
      const result = await invoiceDownloadLoop({
        portalUrl,
        username,
        password,
        invoiceIdentifier: payload.date,
        identifierType: "date",
        apiKey: ANTHROPIC_API_KEY,
        kernel,
        sessionId: session.sessionId,
      });

      const sessionInfo = await session.stop();

      return {
        date: payload.date,
        success: result.success,
        message: result.message,
        replayUrl: sessionInfo.replayViewUrl,
      };
    } catch (error) {
      await session.stop();
      throw error;
    }
  }
);
