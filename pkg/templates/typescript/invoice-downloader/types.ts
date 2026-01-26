export interface DownloadInvoiceByIdInput {
  invoiceId: string;
  portalUrl?: string;
}

export interface DownloadInvoiceByDateInput {
  date: string; // YYYY-MM-DD format
  portalUrl?: string;
}

export interface DownloadInvoiceOutput {
  invoiceId?: string;
  date?: string;
  downloaded: boolean;
  fileDataBase64?: string;
  fileName?: string;
  error?: string;
}

export interface InvoiceData {
  id: string;
  date: string;
  amount: string;
}

export interface DownloadResult {
  fileName: string;
  fileDataBase64: string;
}
