export interface DownloadInvoiceByIdInput {
  invoiceId: string;
  portalUrl?: string;
  username?: string;
  password?: string;
  recordReplay?: boolean;
}

export interface DownloadInvoiceByDateInput {
  date: string; // YYYY-MM-DD format
  portalUrl?: string;
  username?: string;
  password?: string;
  recordReplay?: boolean;
}

export interface DownloadInvoiceOutput {
  invoiceId?: string;
  date?: string;
  success: boolean;
  message: string;
  replayUrl?: string;
}
