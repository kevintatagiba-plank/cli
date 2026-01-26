import { Kernel, type KernelContext } from "@onkernel/sdk";
import type {
  DownloadInvoiceByIdInput,
  DownloadInvoiceByDateInput,
  DownloadInvoiceOutput,
} from "./types";
import { PORTAL_URL } from "./config";
import { executeInvoiceDownload } from "./handlers";
import { searchInvoiceById, searchInvoiceByDate } from "./utils/search";
import { downloadInvoicePDF } from "./utils/download";

const kernel = new Kernel();
const app = kernel.app("ts-invoice-downloader");

app.action<DownloadInvoiceByIdInput, DownloadInvoiceOutput>(
  "download-invoice-by-id",
  async (ctx: KernelContext, payload?: DownloadInvoiceByIdInput): Promise<DownloadInvoiceOutput> => {
    if (!payload?.invoiceId) {
      throw new Error("invoiceId is required");
    }

    const portalUrl = payload.portalUrl || PORTAL_URL!;
    if (!portalUrl) {
      throw new Error("PORTAL_URL is required (either in payload or environment variables)");
    }

    const result = await executeInvoiceDownload(
      ctx,
      portalUrl,
      (page) => {
        console.log(`Searching for invoice: ${payload.invoiceId}`);
        return searchInvoiceById(page, payload.invoiceId);
      },
      (page) => downloadInvoicePDF(page, payload.invoiceId)
    );

    return { ...result, invoiceId: payload.invoiceId };
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

    const portalUrl = payload.portalUrl || PORTAL_URL!;
    if (!portalUrl) {
      throw new Error("PORTAL_URL is required (either in payload or environment variables)");
    }

    const result = await executeInvoiceDownload(
      ctx,
      portalUrl,
      (page) => {
        console.log(`Searching for invoice by date: ${payload.date}`);
        return searchInvoiceByDate(page, payload.date);
      },
      (page) => downloadInvoicePDF(page)
    );

    return { ...result, date: payload.date };
  }
);
