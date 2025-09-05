import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface CreditNotePDFData extends CreditNote {
  customers: {
    name: string;
    email?: string;
    phone?: string;
    customer_code: string;
    address?: string;
    city?: string;
    country?: string;
  };
  credit_note_items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_percentage: number;
    tax_amount: number;
    line_total: number;
    products?: {
      name: string;
      product_code: string;
    };
  }>;
  invoices?: {
    invoice_number: string;
  };
}

export interface CompanyData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  tax_number?: string;
  registration_number?: string;
  logo_url?: string;
}

// Default company details (fallback) - logo will be determined dynamically
const DEFAULT_COMPANY: CompanyData = {
  name: 'Biolegend Scientific Ltd',
  address: 'P.O. Box 85988-00200, Nairobi\nAlpha Center, Eastern Bypass, Membley',
  city: 'Nairobi',
  country: 'Kenya',
  phone: '0741207690/0780165490',
  email: 'biolegend@biolegendscientific.co.ke',
  tax_number: 'P051701091X',
  logo_url: '' // Will use company settings or fallback gracefully
};

export const generateCreditNotePDF = async (creditNote: CreditNotePDFData, company?: CompanyData) => {
  const companyData = company || DEFAULT_COMPANY;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const htmlContent = `<!DOCTYPE html>
  <html>
  <head>
    <title>Credit Note ${creditNote.credit_note_number}</title>
    <meta charset="UTF-8">
    <style>
      @page { size: A4; margin: 15mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Arial', sans-serif; margin:0; padding:0; color:#333; line-height:1.4; font-size:12px; background:white; }
      .page { width:210mm; min-height:297mm; margin:0 auto; background:white; padding:20mm; position:relative; display:flex; flex-direction:column; }

      /* Header styles matching quotation layout */
      .header { margin-bottom:30px; padding-bottom:20px; border-bottom:1px solid #D1D5DB; }
      .header-rows { width:100%; }
      .header-row { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
      .logo-row { justify-content:flex-end; }
      .logo { width:240px; height:80px; overflow:hidden; }
      .logo img { width:100%; height:100%; object-fit:contain; }

      .party-left, .party-right { flex:1 1 0; min-width:0; }
      .party-right { text-align:right; }

      .document-number { font-size:20px; font-weight:700; color:#111827; }
      .document-title { font-size:28px; font-weight:700; color:#111827; text-transform:uppercase; margin:0 0 8px; }

      .company-details, .customer-details { font-size:11px; color:#666; line-height:1.6; }

      .items-section { margin:30px 0; }
      .items-table { width:100%; border-collapse:collapse; margin:20px 0; font-size:11px; border:1px solid #E5E7EB; border-radius:8px; overflow:hidden; }
      .items-table thead { background:#F3F4F6; color:#111827; }
      .items-table th { padding:12px 8px; text-align:center; font-weight:bold; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; border-right:1px solid rgba(255,255,255,0.2); }
      .items-table th:last-child { border-right:none; }
      .items-table td { padding:10px 8px; border-bottom:1px solid #e9ecef; border-right:1px solid #e9ecef; text-align:center; vertical-align:top; }
      .items-table td:last-child { border-right:none; }
      .description-cell { text-align:left !important; max-width:200px; word-wrap:break-word; }
      .amount-cell { text-align:right !important; font-weight:500; }
      .center { text-align:center !important; }

      .totals-section { margin-top:20px; display:flex; justify-content:flex-end; }
      .totals-table { width:300px; border-collapse:collapse; font-size:12px; }
      .totals-table td { padding:8px 15px; border:none; }
      .totals-table .label { text-align:left; color:#495057; font-weight:500; }
      .totals-table .amount { text-align:right; font-weight:600; color:#212529; }
      .totals-table .total-row { border-top:1px solid #111827; background:#f8f9fa; }
      .totals-table .total-row .amount { font-size:16px; font-weight:700; color:#111827; }

      .watermark { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-45deg); font-size:72px; color:rgba(0,0,0,0.06); font-weight:bold; z-index:-1; pointer-events:none; text-transform:uppercase; letter-spacing:5px; }

      @media print { body { background:white; } .page { box-shadow:none; margin:0; padding:0; } }
      @media screen { body { background:#f5f5f5; padding:20px; } }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="watermark">Credit Note</div>

      <div class="header">
        <div class="header-rows">
          <div class="header-row logo-row">
            <div style="flex:1"></div>
            <div class="logo">${companyData.logo_url ? `<img src="${companyData.logo_url}" alt="${companyData.name} Logo" />` : ''}</div>
          </div>

          <div class="header-row party-row" style="margin-top:12px;">
            <div class="party-left">
              <div class="section-subtitle" style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Credit To</div>
              <div class="customer-details">
                <strong>${creditNote.customers.name}</strong><br>
                ${creditNote.customers.email ? `${creditNote.customers.email}<br>` : ''}
                ${creditNote.customers.phone ? `${creditNote.customers.phone}<br>` : ''}
                ${creditNote.customers.address ? `${creditNote.customers.address}<br>` : ''}
                ${creditNote.customers.city ? `${creditNote.customers.city}` : ''}${creditNote.customers.country ? `, ${creditNote.customers.country}` : ''}<br>
                Customer Code: ${creditNote.customers.customer_code}
              </div>
            </div>

            <div class="party-right">
              <div class="document-title">Credit Note</div>
              <div class="document-number">${creditNote.credit_note_number}</div>
              <div style="height:8px"></div>
              <div class="company-details">
                ${companyData.tax_number ? `PIN: ${companyData.tax_number}<br>` : ''}
                ${companyData.address ? `${companyData.address.replace(/\n/g, '<br>')}<br>` : ''}
                ${companyData.city ? `${companyData.city}` : ''}${companyData.country ? `, ${companyData.country}` : ''}<br>
                ${companyData.phone ? `Tel: ${companyData.phone}<br>` : ''}
                ${companyData.email ? `Email: ${companyData.email}` : ''}
              </div>
            </div>
          </div>

          <div class="header-row meta-row" style="margin-top:12px; justify-content:flex-end;">
            <div style="text-align:right;">
              <div><strong>Date:</strong> ${formatDate(creditNote.credit_note_date)}</div>
              <div><strong>Status:</strong> ${creditNote.status.toUpperCase()}</div>
              <div><strong>Credit Amount:</strong> ${formatCurrency(creditNote.total_amount)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Items Section -->
      ${creditNote.credit_note_items && creditNote.credit_note_items.length > 0 ? `
      <div class="items-section">
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:5%;">#</th>
              <th style="width:40%;">Description</th>
              <th style="width:10%;">Qty</th>
              <th style="width:15%;">Unit Price</th>
              <th style="width:10%;">Tax %</th>
              <th style="width:15%;">Tax Amount</th>
              <th style="width:15%;">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${creditNote.credit_note_items.map((item, index) => `
              <tr>
                <td class="center">${index + 1}</td>
                <td class="description-cell">${item.description || item.product_name || item.products?.name || 'Unknown Item'}</td>
                <td class="center">${item.quantity}</td>
                <td class="amount-cell">${formatCurrency(item.unit_price)}</td>
                <td class="center">${item.tax_percentage}%</td>
                <td class="amount-cell">${formatCurrency(item.tax_amount)}</td>
                <td class="amount-cell">${formatCurrency(item.line_total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- Totals Section -->
      <div class="totals-section">
        <table class="totals-table">
          <tr class="subtotal-row">
            <td class="label">Subtotal:</td>
            <td class="amount">${formatCurrency(creditNote.subtotal)}</td>
          </tr>
          <tr>
            <td class="label">Tax Amount:</td>
            <td class="amount">${formatCurrency(creditNote.tax_amount)}</td>
          </tr>
          <tr class="total-row">
            <td class="label">TOTAL CREDIT:</td>
            <td class="amount">${formatCurrency(creditNote.total_amount)}</td>
          </tr>
          <tr>
            <td class="label">Applied Amount:</td>
            <td class="amount">${formatCurrency(creditNote.applied_amount)}</td>
          </tr>
          <tr class="balance-row">
            <td class="label">REMAINING BALANCE:</td>
            <td class="amount">${formatCurrency(creditNote.balance)}</td>
          </tr>
        </table>
      </div>

      <!-- Footer -->
      <div style="margin-top:30px; font-size:11px; color:#666;">
        <strong>Thank you for your business!</strong><br>
        <strong>${companyData.name}</strong><br>
        This credit note was generated on ${new Date().toLocaleString()}<br>
      </div>

    </div>
  </body>
  </html>`;

  // Render the HTML using html2canvas + jsPDF to produce a consistent PDF
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.srcdoc = htmlContent;
  document.body.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => setTimeout(resolve, 400);
  });

  const pageEl = iframe.contentDocument?.querySelector('.page') as HTMLElement;
  if (!pageEl) {
    document.body.removeChild(iframe);
    throw new Error('Failed to render credit note content');
  }

  const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const pageHeightPx = (canvas.width * pageHeight) / imgWidth;

  if (imgHeight <= pageHeight) {
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  } else {
    let renderedHeight = 0;
    const imgDataPages: string[] = [];
    while (renderedHeight < canvas.height) {
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.min(pageHeightPx, canvas.height - renderedHeight);
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(canvas, 0, renderedHeight, canvas.width, pageCanvas.height, 0, 0, pageCanvas.width, pageCanvas.height);
      imgDataPages.push(pageCanvas.toDataURL('image/png'));
      renderedHeight += pageCanvas.height;
    }

    imgDataPages.forEach((img, idx) => {
      if (idx > 0) pdf.addPage();
      const h = (pageHeightPx * imgWidth) / canvas.width;
      pdf.addImage(img, 'PNG', 0, 0, imgWidth, h);
    });
  }

  // Instead of forcing a download, open the generated PDF in a new tab
  const blob = pdf.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
  // Revoke the object URL after a short delay
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

  document.body.removeChild(iframe);
  return;
};
