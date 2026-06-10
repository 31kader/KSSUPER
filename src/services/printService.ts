
import { formatSafe, calculateItemPrice } from '../lib/utils';
import { Product, CompanySettings, Purchase, ProductReturn, Transaction } from '../types';

export const printReceipt = async (t: any, settings: CompanySettings) => {
  const useSilent = settings.silentPrinting;
  
  let printWindow: Window | null = null;
  let iframe: HTMLIFrameElement | null = null;
  let doc: Document | null = null;

  if (useSilent) {
    iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }
    doc = iframe.contentWindow?.document || iframe.contentDocument;
  } else {
    printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    doc = printWindow.document;
  }

  if (!doc) return;

  const itemsHtml = (t.items || []).map((item: any) => {
    const unitPrice = calculateItemPrice(item, t.isWholesale);
    const originalUnitPrice = item.overriddenPrice || item.price;
    const hasLineDiscount = item.lineDiscount || (item.overriddenPrice !== undefined && item.overriddenPrice < item.price);
    
    return `
      <div style="padding: 4px 0;">
        <div style="font-weight: 700; font-size: 10px; margin-bottom: 2px;">${item.name}</div>
        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
          <div style="font-size: 9px; font-weight: 500;">
            <span style="font-weight: 700;">${item.quantity}</span> x ${unitPrice.toFixed(2)} ${settings.currency}
            ${item.lineDiscount ? `<span style="color: #000; text-decoration: underline; margin-left: 4px; font-weight: 700;">(-${item.lineDiscount.value}${item.lineDiscount.type === 'percentage' ? '%' : settings.currency})</span>` : ''}
          </div>
          <div style="text-align: right;">
            ${hasLineDiscount ? `<div style="text-decoration: line-through; font-size: 7px; color: #333;">${((originalUnitPrice || 0) * (item.quantity || 0)).toFixed(2)}</div>` : ''}
            <div style="font-weight: 800; font-size: 10px;">${((unitPrice || 0) * (item.quantity || 0)).toFixed(2)} ${settings.currency}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const receiptId = (t.id || 'N/A').slice(-8).toUpperCase();
  const subtotalBeforeDiscounts = ( (t.total || 0) + (t.discountAmount || 0) + (t.pointsDiscount || 0) + (t.voucherDiscount || 0) );
  const paperWidth = settings.paperFormat === '60mm' ? '60mm' : settings.paperFormat === 'A4' ? '210mm' : '80mm';

  doc.open();

  if (settings.paperFormat === 'A4') {
    doc.write(`
      <html>
        <head>
          <title>Facture #${receiptId}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #333;
              background: white;
              padding: 0;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div style="max-width: 800px; margin: 0 auto; padding: 10px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 25px; align-items: flex-end;">
               <div>
                  <h1 style="margin: 0; font-size: 28px; text-transform: uppercase; color: #111; font-weight: 900; letter-spacing: 2px;">FACTURE</h1>
                  <p style="margin: 4px 0 0 0; color: #666; font-size: 11px; letter-spacing: 1px; font-weight: bold;">N° #${receiptId}</p>
               </div>
               <div style="text-align: right;">
                  <div style="font-weight: 900; font-size: 18px; text-transform: uppercase; color: #111; letter-spacing: 1px;">${settings.name}</div>
                  ${settings.address ? `<div style="font-size: 11px; color: #555; margin-top: 4px;">${settings.address}</div>` : ''}
                  ${settings.phone ? `<div style="font-size: 11px; color: #555; margin-top: 2px;">Tel: ${settings.phone}</div>` : ''}
                  ${settings.taxNumber ? `<div style="font-size: 11px; color: #555; margin-top: 2px;">N° TVA: ${settings.taxNumber}</div>` : ''}
               </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 40px; margin-top: 30px;">
               <div>
                  <h3 style="margin: 0 0 8px 0; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 850;">FACTURÉ À</h3>
                  <div style="font-size: 14px; font-weight: 900; color: #111;">${t.customerName || 'Client de Passage'}</div>
               </div>
               <div style="text-align: right; font-size: 12px; color: #333; line-height: 1.6;">
                  <div><strong>Date d'Émission :</strong> ${formatSafe(t.timestamp || Date.now(), 'dd/MM/yyyy HH:mm')}</div>
                  <div><strong>Mode de Paiement :</strong> CONPTANT</div>
                  <div style="text-transform: uppercase;"><strong>Caissier :</strong> ${(t.employeeName || 'ADMIN')}</div>
               </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
               <thead>
                  <tr style="background-color: #111; color: white;">
                     <th style="padding: 12px 10px; font-size: 11px; text-transform: uppercase; text-align: left; font-weight: 900; letter-spacing: 1px; width: 50%;">Article</th>
                     <th style="padding: 12px 10px; font-size: 11px; text-transform: uppercase; text-align: center; font-weight: 900; letter-spacing: 1px; width: 15%;">Qté</th>
                     <th style="padding: 12px 10px; font-size: 11px; text-transform: uppercase; text-align: right; font-weight: 900; letter-spacing: 1px; width: 15%;">Prix Unit.</th>
                     <th style="padding: 12px 10px; font-size: 11px; text-transform: uppercase; text-align: right; font-weight: 900; letter-spacing: 1px; width: 20%;">Total</th>
                  </tr>
               </thead>
               <tbody>
                  ${(t.items || []).map((item: any) => {
                     const unitPrice = calculateItemPrice(item, t.isWholesale);
                     const itemTotal = (unitPrice || 0) * (item.quantity || 0);
                     return `
                        <tr style="border-bottom: 1px solid #efefef;">
                           <td style="padding: 14px 10px; font-size: 13px; color: #111;">
                              <span style="font-weight: 800;">${item.name}</span>
                              ${item.sku ? `<div style="font-size: 10.5px; color: #888; font-family: monospace; margin-top: 2px;">SKU: ${item.sku}</div>` : ''}
                           </td>
                           <td style="padding: 14px 10px; font-size: 13px; text-align: center; font-weight: bold;">${item.quantity}</td>
                           <td style="padding: 14px 10px; font-size: 13px; text-align: right; font-family: monospace; font-weight: 600;">${unitPrice.toFixed(2)} ${settings.currency}</td>
                           <td style="padding: 14px 10px; font-size: 13px; text-align: right; font-family: monospace; font-weight: 800; color: #111;">${itemTotal.toFixed(2)} ${settings.currency}</td>
                        </tr>
                     `;
                  }).join('')}
               </tbody>
            </table>

            <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
               <div style="width: 320px; background-color: #fafafa; padding: 15px; border-radius: 8px; border: 1px solid #eee;">
                  <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px solid #eee;">
                     <span style="font-weight: bold; color: #666; text-transform: uppercase; font-size: 10px; tracking: 0.5px;">Sous-total</span>
                     <span style="font-family: monospace; font-weight: bold;">${subtotalBeforeDiscounts.toFixed(2)} ${settings.currency}</span>
                  </div>
                  ${t.discountAmount > 0 ? `
                     <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #e11d48; border-bottom: 1px solid #eee;">
                        <span style="font-weight: bold; text-transform: uppercase; font-size: 10px;">Remise</span>
                        <span style="font-family: monospace; font-weight: bold;">-${t.discountAmount.toFixed(2)} ${settings.currency}</span>
                     </div>
                  ` : ''}
                  ${t.pointsDiscount > 0 ? `
                     <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #0284c7; border-bottom: 1px solid #eee;">
                        <span style="font-weight: bold; text-transform: uppercase; font-size: 10px;">Remise Points</span>
                        <span style="font-family: monospace; font-weight: bold;">-${t.pointsDiscount.toFixed(2)} ${settings.currency}</span>
                     </div>
                  ` : ''}
                  <div style="display: flex; justify-content: space-between; padding: 10px 0 0 0; font-size: 14px; font-weight: bold; margin-top: 5px;">
                     <span style="text-transform: uppercase; font-size: 11px; tracking: 1px; color: #111;">Net à Payer</span>
                     <span style="font-family: monospace; font-size: 20px; color: #111; font-weight: 900;">${(t.total || 0).toFixed(2)} ${settings.currency}</span>
                  </div>
                  ${t.amountReceived !== undefined ? `
                  <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-top: 1px dashed #eee; margin-top: 5px;">
                     <span style="color: #666; text-transform: uppercase; font-size: 10px;">Montant Reçu</span>
                     <span style="font-family: monospace; font-weight: bold;">${t.amountReceived.toFixed(2)} ${settings.currency}</span>
                  </div>
                  ` : ''}
                  ${t.amountReturned !== undefined && t.amountReturned > 0 ? `
                  <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px;">
                     <span style="color: #666; text-transform: uppercase; font-size: 10px;">Rendu</span>
                     <span style="font-family: monospace; font-weight: bold;">${t.amountReturned.toFixed(2)} ${settings.currency}</span>
                  </div>
                  ` : ''}
                  ${t.amountReceived !== undefined && t.amountReceived < t.total && t.customerId ? `
                  <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #e11d48; font-weight: bold;">
                     <span style="text-transform: uppercase; font-size: 10px;">Dette Client (Crédit)</span>
                     <span style="font-family: monospace;">+${(t.total - t.amountReceived).toFixed(2)} ${settings.currency}</span>
                  </div>
                  ` : ''}
                  ${t.amountReceived !== undefined && t.amountReceived > t.total && t.customerId && (!t.amountReturned || t.amountReturned === 0) ? `
                  <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #16a34a; font-weight: bold;">
                     <span style="text-transform: uppercase; font-size: 10px;">Ajouté au Solde</span>
                     <span style="font-family: monospace;">+${(t.amountReceived - t.total).toFixed(2)} ${settings.currency}</span>
                  </div>
                  ` : ''}
               </div>
            </div>

            <div style="margin-top: 80px; text-align: center; border-top: 1px solid #eee; padding-top: 24px;">
               <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #111; letter-spacing: 1px;">${settings.footerText || 'Merci pour votre visite ! à bientôt.'}</div>
               <div style="font-size: 10px; color: #aaa; margin-top: 6px;">Nexus Automation SAS - Édité numériquement par NEXUS POS PRO</div>
            </div>
          </div>
          <script>
            window.onload = () => {
              try {
                window.focus();
                window.print();
                ${useSilent ? '' : 'setTimeout(() => window.close(), 500);'}
              } catch (e) {
                console.error("Print failed:", e);
              }
            };
          </script>
        </body>
      </html>
    `);
  } else {
    doc.write(`
      <html>
        <head>
          <title>Reçu #${receiptId}</title>
          <style>
            @page { margin: 0; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { 
              width: ${paperWidth}; 
              margin: 0 auto; 
              padding: 8mm 4mm;
              font-family: 'Verdana', 'Geneva', sans-serif;
              color: #000;
              line-height: 1.4;
              background: white;
              font-size: 9px;
              font-weight: 900;
            }
            .header { text-align: center; margin-bottom: 5px; }
            .business-name { font-weight: 900; font-size: 14px; text-transform: uppercase; margin-bottom: 2px; }
            .business-info { font-size: 9px; font-weight: 900; line-height: 1; }
            
            .ticket-info { 
              padding: 8px 0; 
              margin: 8px 0;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .ticket-meta { flex: 1; text-align: center; }
            .ticket-id { font-weight: 900; font-size: 12px; margin: 0; text-transform: uppercase; }
            .ticket-date { font-size: 9px; margin: 2px 0 0 0; font-weight: 900; }
            
            .section-title { font-size: 9px; font-weight: 900; text-transform: uppercase; margin-bottom: 6px; }
            
            .summary-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .summary-label { font-weight: 900; text-transform: uppercase; }
            .summary-value { font-weight: 900; }
            
            .grand-total { 
              margin-top: 8px; 
              padding-top: 8px; 
              border-top: 2px solid #000; 
              display: flex; 
              justify-content: space-between; 
              align-items: center;
            }
            .total-label { font-weight: 900; font-size: 13px; }
            .total-value { font-weight: 900; font-size: 17px; }
  
            .customer-box { border: 1px solid #000; padding: 6px; margin-top: 10px; }
            .customer-name { font-weight: 700; font-size: 10px; }
  
            .footer { text-align: center; margin-top: 20px; padding-top: 10px; }
            .thanks { font-weight: 900; font-size: 10px; margin-bottom: 3px; }
            
            @media print {
              body { padding: 5mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="business-name">${settings.name}</div>
            <div class="business-info">
              ${settings.address ? `<div>${settings.address}</div>` : ''}
              ${settings.phone ? `<div>Tel: ${settings.phone}</div>` : ''}
              ${settings.taxNumber ? `<div>TVA: ${settings.taxNumber}</div>` : ''}
            </div>
          </div>
  
          <div class="ticket-info">
            <div class="ticket-meta">
              <p class="ticket-id">REÇU DE VENTE: #${receiptId}</p>
              <p class="ticket-date">${formatSafe(t.timestamp || Date.now(), 'dd/MM/yyyy HH:mm')}</p>
              <p style="font-size: 9px; font-weight: 900; margin-top: 2px;">CAISSIER: ${(t.employeeName || 'ADMIN').toUpperCase()}</p>
            </div>
          </div>
  
          <div class="section-title">Articles</div>
          <div style="margin-bottom: 20px;">
            ${itemsHtml}
          </div>
  
          <div class="section-title">Total</div>
          <div>
            <div class="summary-row">
              <span class="summary-label">Sous-total</span>
              <span class="summary-value">${subtotalBeforeDiscounts.toFixed(2)} ${settings.currency}</span>
            </div>
            
            ${t.discountAmount > 0 ? `
            <div class="summary-row">
              <span class="summary-label">Remise</span>
              <span class="summary-value">-${t.discountAmount.toFixed(2)} ${settings.currency}</span>
            </div>
            ` : ''}
            
            ${t.pointsDiscount > 0 ? `
            <div class="summary-row">
              <span class="summary-label">Fidélité</span>
              <span class="summary-value">-${t.pointsDiscount.toFixed(2)} ${settings.currency}</span>
            </div>
            ` : ''}
  
            <div class="grand-total">
              <span class="total-label">TOTAL</span>
              <span class="total-value">${(t.total || 0).toFixed(2)} ${settings.currency}</span>
            </div>
            ${t.amountReceived !== undefined ? `
            <div class="summary-row" style="margin-top: 4px; border-top: 1px dashed #ccc; padding-top: 4px;">
              <span class="summary-label" style="font-size: 8px;">Reçu</span>
              <span class="summary-value" style="font-size: 8px;">${t.amountReceived.toFixed(2)} ${settings.currency}</span>
            </div>
            ` : ''}
            ${t.amountReturned !== undefined && t.amountReturned > 0 ? `
            <div class="summary-row">
              <span class="summary-label" style="font-size: 8px;">Rendu</span>
              <span class="summary-value" style="font-size: 8px;">${t.amountReturned.toFixed(2)} ${settings.currency}</span>
            </div>
            ` : ''}
            ${t.amountReceived !== undefined && t.amountReceived < t.total && t.customerId ? `
            <div class="summary-row" style="color: #000; font-weight: bold;">
              <span class="summary-label" style="font-size: 8px;">Nouv. Dette</span>
              <span class="summary-value" style="font-size: 8px;">+${(t.total - t.amountReceived).toFixed(2)} ${settings.currency}</span>
            </div>
            ` : ''}
            ${t.amountReceived !== undefined && t.amountReceived > t.total && t.customerId && (!t.amountReturned || t.amountReturned === 0) ? `
            <div class="summary-row" style="color: #000; font-weight: bold;">
              <span class="summary-label" style="font-size: 8px;">Ajouté au Solde</span>
              <span class="summary-value" style="font-size: 8px;">+${(t.amountReceived - t.total).toFixed(2)} ${settings.currency}</span>
            </div>
            ` : ''}
          </div>
  
          ${t.customerName ? `
          <div class="customer-box">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase;">Client</div>
            <div class="customer-name">${t.customerName}</div>
            ${t.pointsEarned ? `<div style="font-size: 9px; font-weight: 700; color: #444; margin-top: 4px;">Points Gagnés: ${t.pointsEarned}</div>` : ''}
          </div>
          ` : ''}
  
          <div class="footer">
            <div class="thanks">MERCI DE VOTRE VISITE</div>
            <div style="font-size: 12px; font-weight: 700;">${settings.footerText || 'À bientôt !'}</div>
          </div>
  
          <script>
            window.onload = () => {
              try {
                window.focus();
                window.print();
                ${useSilent ? '' : 'setTimeout(() => window.close(), 500);'}
              } catch (e) {
                console.error("Print failed:", e);
              }
            };
          </script>
        </body>
      </html>
    `);
  }
  doc.close();

  // If silent, also try to trigger print from outside the iframe for better compatibility
  if (useSilent && iframe?.contentWindow) {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {}
  }
};

export const printLabels = (products: Product[], rawSettings: CompanySettings) => {
  const settings = rawSettings as any;
  const useSilent = settings.silentPrinting;

  let printWindow: Window | null = null;
  let iframe: HTMLIFrameElement | null = null;
  let doc: Document | null = null;

  if (useSilent) {
    iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }
    doc = iframe.contentWindow?.document || iframe.contentDocument;
  } else {
    printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    doc = printWindow.document;
  }

  if (!doc) return;

  const tpl = (settings.labelTemplate as string) || 'standard';
  
  // Base/unrotated width and height
  const defaultWidthNum = tpl === 'custom' ? 70 : (tpl === 'shelf-large' ? 80 : tpl === 'shelf-standard' ? 40 : 60);
  const defaultHeightNum = tpl === 'custom' ? 40 : (tpl === 'shelf-standard' ? 30 : 40);

  const uWidthNum = settings.labelWidthCustom || defaultWidthNum;
  const uHeightNum = settings.labelHeightCustom || defaultHeightNum;

  // Render Dimensions (width and height swapped if portrait, e.g. for label feeding rolls)
  let widthVal = uWidthNum;
  let heightVal = uHeightNum;
  if (settings.labelOrientation === 'portrait') {
    widthVal = uHeightNum;
    heightVal = uWidthNum;
  }

  const width = `${widthVal}mm`;
  const height = `${heightVal}mm`;
  // Force rotation as requested or use settings
  const rot = settings.labelRotation && settings.labelRotation !== '0' ? settings.labelRotation : '90';

  let labelsHtml = '';

  products.forEach((p) => {
    let contentHtml = '';
    const skuForBarcode = p.sku || p.id.substring(0, 8).toUpperCase();

    if (tpl === 'price-only') {
      contentHtml = `<div class="price-only">${p.price.toFixed(2)} ${settings.currency}</div>`;
    } else if (tpl === 'shelf-standard') {
      contentHtml = `
        <div class="shelf-tag shelf-standard">
          <div class="name">${p.name}</div>
          <div class="main-price">${p.price.toFixed(2)} <span class="currency">${settings.currency}</span></div>
          <div class="footer-meta">
            <div class="qr-box" data-value="${p.sku || p.id}"></div>
            <div class="ref">REF: ${p.sku || p.id.slice(-6).toUpperCase()}</div>
          </div>
        </div>
      `;
    } else if (tpl === 'shelf-large') {
      contentHtml = `
        <div class="shelf-tag shelf-large">
          <div class="brand">${settings.name}</div>
          <div class="name">${p.name}</div>
          <div class="price-row">
            <div class="main-price">${p.price.toFixed(2)} <span class="currency">${settings.currency}</span></div>
            <div class="unit-price">${(p.price / 1).toFixed(2)} ${settings.currency}/${p.unit || 'u'}</div>
          </div>
          <div class="barcode-row">
            <div class="qr-box" data-value="${p.sku || p.id}"></div>
            <div class="sku">${p.sku || p.id}</div>
          </div>
        </div>
      `;
    } else if (tpl === 'shelf-promo') {
      contentHtml = `
        <div class="shelf-tag shelf-promo">
          <div class="promo-badge">PROMO</div>
          <div class="name">${p.name}</div>
          <div class="price-box">
            <div class="old-price">${(p.price * 1.2).toFixed(2)} ${settings.currency}</div>
            <div class="new-price">${p.price.toFixed(2)} <span>${settings.currency}</span></div>
          </div>
        </div>
      `;
    } else if (tpl === 'custom') {
      const showName = settings.customShowName !== false;
      const showPrice = settings.customShowPrice !== false;
      const showBarcode = settings.customShowBarcode !== false;
      const showQr = settings.customShowQr === true;
      const showImage = settings.customShowImage === true;
      const customText = settings.customText || '';
      const borderStyle = settings.customBorder ? '1px solid #000' : 'none';
      
      const nameSize = settings.customNameSize || 11;
      const priceSize = settings.customPriceSize || 16;
      const textSize = settings.customTextSize || 9;
      const bHeight = settings.customBarcodeHeight || 30;
      const paddingVal = settings.customPadding !== undefined ? settings.customPadding : 2;
      
      // Directional margins / alignments (haut, bas, gauche, droite)
      const pTop = settings.customPaddingTop !== undefined ? settings.customPaddingTop : paddingVal;
      const pBottom = settings.customPaddingBottom !== undefined ? settings.customPaddingBottom : paddingVal;
      const pLeft = settings.customPaddingLeft !== undefined ? settings.customPaddingLeft : paddingVal;
      const pRight = settings.customPaddingRight !== undefined ? settings.customPaddingRight : paddingVal;

      const struct = settings.customLayoutStructure || 'classic';
      const align = settings.customAlignment || 'center';

      const tAlign = settings.customTextAlign || 'center';
      const isBold = settings.customTextBold ? 'bold' : 'normal';
      const isItalic = settings.customTextItalic ? 'italic' : 'normal';
      const bWidthVal = settings.customBarcodeWidth || 1.2;

      const imageHtml = showImage && (p.imageUrl || p.image) ? `<img src="${p.imageUrl || p.image}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;" referrerpolicy="no-referrer" />` : '';

      if (struct === 'split') {
        // Two-Column Layout organization: left side details, right side code
        contentHtml = `
          <div class="label-custom" style="
            display: flex; 
            flex-direction: row; 
            align-items: center; 
            justify-content: space-between; 
            height: 100%; 
            width: 100%; 
            padding: ${pTop}mm ${pRight}mm ${pBottom}mm ${pLeft}mm; 
            box-sizing: border-box;
            background: #fff;
            color: #000;
            font-family: Arial, sans-serif;
            border: ${borderStyle};
            gap: 6px;
          ">
            <!-- Left part: details -->
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; text-align: left; height: 100%;">
              ${showName ? `<div class="name" style="font-weight: bold; font-size: ${nameSize}px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">${p.name}</div>` : ''}
              <div style="display: flex; align-items: center; justify-content: flex-start; gap: 6px; margin: 3px 0; width: 100%;">
                ${imageHtml}
                ${showPrice ? `<div class="price" style="font-size: ${priceSize}px; font-weight: 900; margin: 0; white-space: nowrap;">${p.price.toFixed(2)} ${settings.currency}</div>` : ''}
              </div>
              ${customText ? `<div class="custom-text" style="font-size: ${textSize}px; font-weight: ${isBold}; font-style: ${isItalic}; color: #333; margin: 1px 0; width: 100%; word-break: break-word;">${customText}</div>` : ''}
            </div>

            <!-- Right part: barcode or QR -->
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; max-width: 48%; min-width: 32%;">
              ${showBarcode ? `
                <div style="display: flex; justify-content: center; overflow: hidden; width: 100%;">
                  <svg class="barcode-box" data-value="${skuForBarcode}" data-height="${Math.round(bHeight * 0.9)}" data-width="${bWidthVal}" data-show-text="false"></svg>
                </div>
              ` : ''}
              ${showQr ? `
                <div style="display: flex; justify-content: center; width: 100%;">
                  <div class="qr-box" data-value="${p.sku || p.id}" data-scale="1.4"></div>
                </div>
              ` : ''}
              ${(!showBarcode && !showQr) ? `<div class="sku" style="font-size: 8px; color: #666; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">${p.sku || p.id}</div>` : ''}
            </div>
          </div>
        `;
      } else if (struct === 'price-heavy') {
        // Price Dominant layout (Focus prix)
        contentHtml = `
          <div class="label-custom" style="
            display: flex; 
            flex-direction: row; 
            align-items: center; 
            justify-content: space-between; 
            height: 100%; 
            width: 100%; 
            padding: ${pTop}mm ${pRight}mm ${pBottom}mm ${pLeft}mm; 
            box-sizing: border-box;
            background: #fff;
            color: #000;
            font-family: Arial, sans-serif;
            border: ${borderStyle};
            gap: 8px;
          ">
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; background: #f1f5f9; border: 1.5px solid #000; border-radius: 4px; padding: 4px; min-width: 45%; height: 100%; box-sizing: border-box;">
              ${showPrice ? `
                <div class="price" style="font-size: ${Math.round(priceSize * 1.25)}px; font-weight: 900; line-height: 1; text-align: center; color: #000;">${p.price.toFixed(2)}</div>
                <div style="font-size: 9px; font-weight: bold; margin-top: 3px; text-transform: uppercase; color: #475569;">${settings.currency}</div>
              ` : '<div style="font-weight: bold; font-size: 11px;">PROMO</div>'}
            </div>

            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
              ${showName ? `<div class="name" style="font-weight: bold; font-size: ${nameSize}px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</div>` : ''}
              ${customText ? `<div class="custom-text" style="font-size: ${textSize}px; font-weight: ${isBold}; font-style: ${isItalic}; color: #333; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${customText}</div>` : ''}
              
              ${showBarcode ? `
                <div style="width: 100%; overflow: hidden;">
                  <svg class="barcode-box" data-value="${skuForBarcode}" data-height="${Math.max(15, Math.round(bHeight * 0.75))}" data-width="${bWidthVal}" data-show-text="false"></svg>
                </div>
              ` : ''}
              ${showQr && !showBarcode ? `
                <div style="width: 100%; display: flex; justify-content: flex-start;">
                  <div class="qr-box" data-value="${p.sku || p.id}" data-scale="1.2"></div>
                </div>
              ` : ''}
              ${(!showBarcode && !showQr) ? `<div class="sku" style="font-size: 8px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">${p.sku || p.id}</div>` : ''}
            </div>
          </div>
        `;
      } else if (struct === 'barcode-centric') {
        // Barcode Centric (Master code - giant barcode takes center space)
        contentHtml = `
          <div class="label-custom" style="
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: space-between; 
            height: 100%; 
            width: 100%; 
            padding: ${pTop}mm ${pRight}mm ${pBottom}mm ${pLeft}mm; 
            box-sizing: border-box;
            background: #fff;
            color: #000;
            font-family: Arial, sans-serif;
            border: ${borderStyle};
          ">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 6px; margin-bottom: 2px;">
              ${showName ? `<div class="name" style="font-weight: bold; font-size: ${nameSize}px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left;">${p.name}</div>` : ''}
              ${showPrice ? `<div class="price" style="font-size: ${priceSize}px; font-weight: 950; text-align: right; white-space: nowrap;">${p.price.toFixed(2)} ${settings.currency}</div>` : ''}
            </div>

            ${customText ? `<div class="custom-text" style="font-size: ${textSize}px; font-weight: ${isBold}; font-style: ${isItalic}; color: #333; width: 100%; text-align: center; margin-bottom: 2px;">${customText}</div>` : ''}

            ${showBarcode ? `
              <div style="display: flex; justify-content: center; width: 100%; overflow: hidden; flex: 1; align-items: center;">
                <svg class="barcode-box" data-value="${skuForBarcode}" data-height="${Math.round(bHeight * 1.2)}" data-width="${bWidthVal}"></svg>
              </div>
            ` : ''}
            ${showQr && !showBarcode ? `
              <div style="display: flex; justify-content: center; width: 100%; flex: 1; align-items: center;">
                <div class="qr-box" data-value="${p.sku || p.id}" data-scale="1.8"></div>
              </div>
            ` : ''}
            ${(!showBarcode && !showQr) ? `<div class="sku" style="font-size: 8px; color: #666; text-align: center; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.sku || p.id}</div>` : ''}
          </div>
        `;
      } else {
        // 'classic' or default: vertical stack aligned by align setting
        contentHtml = `
          <div class="label-custom" style="
            display: flex; 
            flex-direction: column; 
            align-items: ${align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'}; 
            justify-content: space-between; 
            height: 100%; 
            width: 100%; 
            padding: ${pTop}mm ${pRight}mm ${pBottom}mm ${pLeft}mm; 
            box-sizing: border-box;
            background: #fff;
            color: #000;
            font-family: Arial, sans-serif;
            border: ${borderStyle};
          ">
            ${showName ? `<div class="name" style="font-weight: bold; font-size: ${nameSize}px; width: 100%; text-align: ${align}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">${p.name}</div>` : ''}
            
            <div style="display: flex; align-items: center; justify-content: ${align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'}; gap: 8px; margin: auto; width: 100%;">
              ${imageHtml}
              ${showPrice ? `<div class="price" style="font-size: ${priceSize}px; font-weight: 900; margin: 0; white-space: nowrap;">${p.price.toFixed(2)} ${settings.currency}</div>` : ''}
            </div>

            ${customText ? `<div class="custom-text" style="font-size: ${textSize}px; text-align: ${tAlign}; font-weight: ${isBold}; font-style: ${isItalic}; color: #333; margin: 2px 0; width: 100%; word-break: break-word;">${customText}</div>` : ''}

            ${showBarcode ? `
              <div style="display: flex; justify-content: ${align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'}; width: 100%; overflow: hidden; margin: 2px 0;">
                <svg class="barcode-box" data-value="${skuForBarcode}" data-height="${bHeight}" data-width="${bWidthVal}"></svg>
              </div>
            ` : ''}
            
            ${showQr ? `
              <div style="display: flex; justify-content: ${align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'}; width: 100%; margin: 2px 0;">
                <div class="qr-box" data-value="${p.sku || p.id}" data-scale="1.8"></div>
              </div>
            ` : ''}

            ${(!showBarcode && !showQr) ? `<div class="sku" style="font-size: 8px; color: #666; width: 100%; text-align: ${align}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.sku || p.id}</div>` : ''}
          </div>
        `;
      }
    } else if (tpl === 'barcode-only') {
      contentHtml = `
        <div class="label-standard" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          <svg class="barcode-box" data-value="${skuForBarcode}"></svg>
        </div>
      `;
    } else {
      // standard template
      contentHtml = `
        <div class="label-standard" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          <div class="name" style="font-weight: bold; font-size: 11px; margin-bottom: 2px;">${p.name}</div>
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin: 2px 0;">
            ${(p.imageUrl || p.image) ? `<img src="${p.imageUrl || p.image}" style="width: 28px; height: 28px; object-fit: cover; border-radius: 4px; border: 1.5px solid #ddd;" referrerpolicy="no-referrer" />` : ''}
            <div class="price" style="font-size: 16px; font-weight: 900; margin: 0;">${p.price.toFixed(2)} ${settings.currency}</div>
          </div>
          <svg class="barcode-box" data-value="${skuForBarcode}"></svg>
          <div class="sku" style="font-size: 8px; color: #666; margin-top: 2px;">${p.sku || p.id}</div>
        </div>
      `;
    }

    labelsHtml += `
      <div class="label-container">
        <div class="label-wrapper rot-${rot}">
          ${contentHtml}
        </div>
      </div>
    `;
  });

  doc.open();
  doc.write(`
    <html>
      <head>
        <title>Etiquettes</title>
        <style>
          @page { 
            size: ${width} ${height}; 
            margin: 0; 
          }
          * { box-sizing: border-box; }
          html, body { 
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important;
            font-family: sans-serif;
            width: ${width} !important;
            height: auto !important;
            overflow: visible !important;
          }
          .label-container {
            width: ${width} !important; 
            height: ${height} !important;
            padding: 0;
            margin: 0;
            box-sizing: border-box;
            background: white;
            position: relative !important;
            overflow: hidden;
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .label-wrapper {
            box-sizing: border-box;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            background: white;
          }
          .label-wrapper.rot-90 {
            width: ${uHeightNum}mm;
            height: ${uWidthNum}mm;
            transform: rotate(90deg);
            transform-origin: center center;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(90deg);
          }
          .label-wrapper.rot-180 {
            width: 100%;
            height: 100%;
            transform: rotate(180deg);
          }
          .label-wrapper.rot-270 {
            width: ${uHeightNum}mm;
            height: ${uWidthNum}mm;
            transform: rotate(270deg);
            transform-origin: center center;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(270deg);
          }
          .shelf-tag { width: 100%; height: 100%; padding: 5px; border: 1px solid #ddd; position: relative; }
          .shelf-standard .name { font-size: 10px; font-weight: bold; margin-bottom: 2px; height: 2.4em; overflow: hidden; text-align: left; }
          .shelf-standard .main-price { font-size: 18px; font-weight: 900; text-align: left; }
          .shelf-standard .currency { font-size: 10px; font-weight: 700; }
          .shelf-standard .footer-meta { display: flex; justify-content: space-between; align-items: flex-end; position: absolute; bottom: 5px; width: calc(100% - 10px); }
          .shelf-standard .ref { font-size: 7px; color: #666; font-family: monospace; }
          .shelf-large .brand { font-size: 10px; font-weight: 800; color: #4f46e5; margin-bottom: 2px; }
          .shelf-large .name { font-size: 14px; font-weight: bold; margin-bottom: 5px; text-align: left; }
          .shelf-large .price-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
          .shelf-large .main-price { font-size: 32px; font-weight: 950; letter-spacing: -1px; }
          .shelf-large .unit-price { font-size: 10px; color: #666; font-weight: bold; }
          .shelf-large .barcode-row { display: flex; align-items: center; gap: 10px; }
          .shelf-large .sku { font-size: 9px; font-family: monospace; }
          .shelf-promo { background: #fee2e2; border: 2px solid #ef4444; }
          .shelf-promo .promo-badge { background: #ef4444; color: white; padding: 2px 8px; font-size: 10px; font-weight: 900; display: inline-block; margin-bottom: 5px; }
          .shelf-promo .name { font-size: 12px; font-weight: bold; text-align: left; }
          .shelf-promo .price-box { margin-top: 5px; text-align: left; }
          .shelf-promo .old-price { font-size: 11px; text-decoration: line-through; color: #991b1b; }
          .shelf-promo .new-price { font-size: 24px; font-weight: 900; color: #ef4444; }
          .label-standard { text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 2px; }
          .label-standard .name { font-weight: bold; font-size: 11px; margin-bottom: 2px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .label-standard .price { font-size: 16px; font-weight: 900; margin-bottom: 4px; }
          .label-standard .qr-box { display: flex; justify-content: center; }
          .label-standard .sku { font-size: 8px; color: #666; margin-top: 2px; }
          .price-only { font-size: 28px; font-weight: 900; display: flex; align-items: center; justify-content: center; height: 100%; }
        </style>
      </head>
      <body>
        ${labelsHtml}
        <script src="https://unpkg.com/qrcode-generator@1.4.4/qrcode.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <script>
          window.onload = () => {
            // Generate QRs
            document.querySelectorAll('.qr-box').forEach(el => {
              const val = el.getAttribute('data-value');
              const scaleAttr = el.getAttribute('data-scale');
              const scale = scaleAttr ? parseFloat(scaleAttr) : (${tpl === 'shelf-standard' ? 1.5 : 2.5});
              if (val) {
                const qr = qrcode(0, 'M');
                qr.addData(val);
                qr.make();
                el.innerHTML = qr.createSvgTag(scale, 0);
              }
            });

            // Generate Barcodes
            document.querySelectorAll('.barcode-box').forEach(el => {
              const val = el.getAttribute('data-value');
              const bHeight = Number(el.getAttribute('data-height') || 30);
              const bWidth = Number(el.getAttribute('data-width') || 1.2);
              const showText = el.getAttribute('data-show-text') !== 'false';
              if (val) {
                try {
                  JsBarcode(el, val, {
                    format: "CODE128",
                    width: bWidth,
                    height: bHeight,
                    displayValue: showText,
                    fontSize: 10,
                    margin: 0
                  });
                } catch(e) {
                  console.error(e);
                }
              }
            });

            window.print();
            ${useSilent ? '' : 'setTimeout(() => window.close(), 500);'}
          };
        </script>
      </body>
    </html>
  `);
  doc.close();

  if (useSilent && iframe?.contentWindow) {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {}
  }
};

export const printLabel = (p: Product, settings: CompanySettings) => {
  printLabels([p], settings);
};

export const printPurchaseOrder = (purchase: any, settings: CompanySettings) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const itemsHtml = purchase.items.map((item: any) => `
    <tr>
      <td style="padding: 12px 8px; border-bottom: 2px solid #000;">
        <div style="font-weight: 900; color: #000;">${item.name || item.productName}</div>
        <div style="font-size: 11px; color: #000; font-weight: 700;">Réf: ${item.productId ? item.productId.slice(-6).toUpperCase() : 'NO-SKU'}</div>
      </td>
      <td style="padding: 12px 8px; border-bottom: 2px solid #000; text-align: center; font-weight: 900;">${item.quantity}</td>
      <td style="padding: 12px 8px; border-bottom: 2px solid #000; text-align: right; font-weight: 700;">${(item.costPrice || item.price || 0).toFixed(2)} ${settings.currency}</td>
      <td style="padding: 12px 8px; border-bottom: 2px solid #000; text-align: right; font-weight: 900;">${((item.quantity || 0) * (item.costPrice || item.price || 0)).toFixed(2)} ${settings.currency}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Bon de Commande - ${purchase.supplierName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page { margin: 0; }
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #000; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 4px solid #000; padding-bottom: 20px; }
          .company-info h1 { margin: 0; font-size: 32px; font-weight: 900; text-transform: uppercase; }
          .document-details { text-align: right; }
          .document-label { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
          .document-value { font-size: 24px; font-weight: 900; margin-top: 5px; }
          .section { margin-bottom: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
          .section-title { font-weight: 900; text-transform: uppercase; font-size: 12px; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin: 30px 0; }
          th { text-align: left; padding: 12px 8px; border-bottom: 3px solid #000; font-size: 12px; font-weight: 900; text-transform: uppercase; }
          .totals { margin-left: auto; width: 350px; padding: 20px; border: 4px solid #000; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-weight: 700; }
          .grand-total { border-top: 3px solid #000; margin-top: 10px; padding-top: 15px; font-size: 24px; font-weight: 900; }
          .footer { margin-top: 60px; text-align: center; font-size: 12px; font-weight: 700; border-top: 2px solid #000; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h1>${settings.name}</h1>
            <p>${settings.address || ''}<br>${settings.phone || ''}</p>
          </div>
          <div class="document-details">
            <div class="document-label">Bon de Commande (PO)</div>
            <div class="document-value">${purchase.invoiceNumber || 'PO-' + purchase.id.slice(-6).toUpperCase()}</div>
            <p style="font-weight: 800;">Date: ${formatSafe(purchase.date, 'dd/MM/yyyy')}</p>
          </div>
        </div>
        <div class="section">
          <div>
            <div class="section-title">Fournisseur</div>
            <p style="font-size: 20px; font-weight: 900;">${purchase.supplierName}</p>
          </div>
          <div style="text-align: right;">
            <div class="section-title">Expédier à</div>
            <p style="font-weight: 800;">${settings.name}</p>
            <p>${settings.address || ''}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center;">Quantité</th>
              <th style="text-align: right;">Prix Unit.</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="totals">
          <div class="total-row grand-total">
            <span>TOTAL ESTIMÉ</span>
            <span>${(purchase.total || 0).toFixed(2)} ${settings.currency}</span>
          </div>
        </div>
        <div class="footer">
          <p>BON DE COMMANDE OFFICIEL - ${settings.name}</p>
        </div>
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const printReturn = (r: ProductReturn, settings: CompanySettings) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const itemsHtml = r.items.map((item: any) => `
    <tr>
      <td style="padding: 12px 8px; border-bottom: 2px solid #000; font-family: 'Inter', sans-serif;">
        <div style="font-weight: 900; color: #000;">${item.name}</div>
      </td>
      <td style="padding: 12px 8px; border-bottom: 2px solid #000; text-align: center; font-weight: 900; color: #000;">${item.quantity}</td>
      <td style="padding: 12px 8px; border-bottom: 2px solid #000; text-align: right; color: #000; font-weight: 700;">${item.price.toFixed(2)} ${settings.currency}</td>
      <td style="padding: 12px 8px; border-bottom: 2px solid #000; text-align: right; font-weight: 900; color: #000;">${(item.quantity * item.price).toFixed(2)} ${settings.currency}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Reçu de Retour - #${r.id.slice(-6).toUpperCase()}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          @page { margin: 0; }
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #000; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 4px solid #000; padding-bottom: 20px; }
          .title { font-size: 32px; font-weight: 900; text-transform: uppercase; margin: 0; }
          .subtitle { font-size: 16px; font-weight: 700; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align: left; padding: 12px 8px; border-bottom: 3px solid #000; font-size: 12px; font-weight: 900; text-transform: uppercase; }
          .grand-total { font-size: 24px; font-weight: 900; margin-top: 20px; text-align: right; padding-top: 15px; border-top: 2px solid #000; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">REÇU DE RETOUR</h1>
          <div class="subtitle">${settings.name}</div>
        </div>
        <p><strong>Date:</strong> ${formatSafe(r.timestamp, 'dd/MM/yyyy HH:mm')}</p>
        <p><strong>Transaction original:</strong> #${r.transactionId.slice(-8).toUpperCase()}</p>
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th style="text-align: center;">Qté</th>
              <th style="text-align: right;">Prix Unit.</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="grand-total">
          TOTAL RETOURNÉ: ${r.totalRefund.toFixed(2)} ${settings.currency}
        </div>
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const printPurchaseVoucher = (purchase: any, settings: CompanySettings) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const itemsHtml = purchase.items.map((item: any) => `
    <tr>
      <td style="padding: 12px 8px; border-bottom: 2px solid #000; font-family: 'Inter', sans-serif;">
        <div style="font-weight: 900; color: #000;">${item.name}</div>
      </td>
      <td style="padding: 12px 8px; border-bottom: 2px solid #000; text-align: center; font-weight: 900; color: #000;">${item.quantity}</td>
      <td style="padding: 12px 8px; border-bottom: 2px solid #000; text-align: right; color: #000; font-weight: 700;">${item.costPrice.toFixed(2)} ${settings.currency}</td>
      <td style="padding: 12px 8px; border-bottom: 2px solid #000; text-align: right; font-weight: 900; color: #000;">${(item.quantity * item.costPrice).toFixed(2)} ${settings.currency}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Bon de Réception - #${purchase.id.slice(-6).toUpperCase()}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          @page { margin: 0; }
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #000; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 4px solid #000; padding-bottom: 20px; }
          .title { font-size: 32px; font-weight: 900; text-transform: uppercase; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align: left; padding: 12px 8px; border-bottom: 3px solid #000; font-size: 12px; font-weight: 900; text-transform: uppercase; }
          .grand-total { font-size: 24px; font-weight: 900; margin-top: 20px; text-align: right; padding-top: 15px; border-top: 2px solid #000; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">BON DE RÉCEPTION</h1>
        </div>
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th style="text-align: center;">Qté</th>
              <th style="text-align: right;">Prix Unit.</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="grand-total">
          TOTAL: ${purchase.total.toFixed(2)} ${settings.currency}
        </div>
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const printHistory = (filteredPurchases: Purchase[], settings: CompanySettings) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const itemsHtml = filteredPurchases.map(p => `
    <tr>
      <td style="padding: 10px 8px; border-bottom: 2px solid #000; font-size: 12px; font-weight: 800;">${formatSafe(p.date, 'dd/MM/yyyy HH:mm')}</td>
      <td style="padding: 10px 8px; border-bottom: 2px solid #000;">
        <div style="font-weight: 900; text-transform: uppercase;">${p.supplierName}</div>
        <div style="font-size: 11px; font-weight: 700;">Facture: ${p.invoiceNumber || '-'}</div>
      </td>
      <td style="padding: 10px 8px; border-bottom: 2px solid #000; text-align: center; font-weight: 900;">${p.items.length}</td>
      <td style="padding: 10px 8px; border-bottom: 2px solid #000; text-align: right; font-weight: 900; font-size: 13px;">${p.total.toFixed(2)} ${settings.currency}</td>
    </tr>
  `).join('');

  const totalAmount = filteredPurchases.reduce((sum, p) => sum + p.total, 0);

  printWindow.document.write(`
    <html>
      <head>
        <title>Historique des Achats - ${settings.name}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page { margin: 0; }
          * { box-sizing: border-box; }
          body { 
            font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif !important; 
            padding: 30px; 
            font-size: 13px; 
            color: #000 !important;
            line-height: 1.4;
            -webkit-font-smoothing: antialiased;
          }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 4px solid #000; padding-bottom: 20px; }
          h1 { margin: 0; color: #000; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align: left; background: #fff; padding: 12px 8px; border-bottom: 3px solid #000; text-transform: uppercase; font-size: 12px; font-weight: 900; color: #000; }
          .total-info { margin-top: 20px; text-align: right; font-size: 20px; font-weight: 900; color: #000; }
          .footer { margin-top: 40px; font-size: 12px; color: #000; font-weight: 800; text-align: center; border-top: 3px solid #000; padding-top: 20px; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Rapport de Réceptions d'Achats</h1>
          <p style="font-weight: 800; margin-top: 5px;">${settings.name} - Généré le ${new Date().toLocaleString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Fournisseur / Facture</th>
              <th style="text-align: center;">Articles</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 20px 8px; text-align: right; font-weight: 900; font-size: 16px;">TOTAL GÉNÉRAL</td>
              <td style="padding: 20px 8px; text-align: right; font-weight: 900; font-size: 22px; border-top: 2px dashed #000;">${totalAmount.toFixed(2)} ${settings.currency}</td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">
          Document Interne - ${settings.name}
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
