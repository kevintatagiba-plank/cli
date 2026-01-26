import type { Page } from "playwright-core";

const PDF_TEMPLATE = `%PDF-1.4
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
(Invoice ID: {invoiceId}) Tj
0 -20 Td
(Date: {date}) Tj
0 -20 Td
(Amount: {amount}) Tj
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

export function generatePDFContent(invoiceId: string, date: string, amount: string): string {
  return PDF_TEMPLATE
    .replace('{invoiceId}', invoiceId)
    .replace('{date}', date)
    .replace('{amount}', amount);
}

export function setupBlobInterceptor(page: Page): Promise<{ base64: string; filename: string }> {
  return page.evaluate(() => {
    return new Promise<{ base64: string; filename: string }>((resolve, reject) => {
      (window as any).downloadInvoice = function(invoiceId: string, date: string, amount: string) {
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

        const blob = new Blob([pdfContent], { type: 'application/pdf' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          if (!base64) throw new Error('Failed to convert PDF to base64');
          resolve({ base64, filename: `invoice-${invoiceId}.pdf` });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      };

      setTimeout(() => {
        reject(new Error('Download button was not clicked or downloadInvoice was not called'));
      }, 30000);
    });
  });
}
