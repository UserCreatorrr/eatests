interface OrderEmailOptions {
  proveedor: string
  message: string   // editable body text from user
  items: { nombre: string; cantidad?: number; unidad?: string }[]
  appUrl: string
  numOrder?: string
  fecha?: string
}

export function buildOrderEmailHtml(opts: OrderEmailOptions): string {
  const { proveedor, message, items, appUrl, numOrder, fecha } = opts
  const base = appUrl.replace(/\/$/, '')
  const logoUrl = `${base}/logos/COMPLETE_BICOLOR_NEGATIVE.png`
  const today = fecha || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const itemRows = items.length > 0 ? items.map(i => `
    <tr>
      <td style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:#dfd5c9;font-family:'Courier New',Courier,monospace;font-size:13px;line-height:1.4;">
        ${escHtml(i.nombre)}
      </td>
      <td style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:#19f973;font-family:'Courier New',Courier,monospace;font-size:13px;text-align:right;white-space:nowrap;font-weight:bold;">
        ${i.cantidad != null ? i.cantidad + (i.unidad ? '&nbsp;' + escHtml(i.unidad) : '') : '—'}
      </td>
    </tr>`).join('') : `
    <tr>
      <td colspan="2" style="padding:14px 20px;color:rgba(223,213,201,0.4);font-family:'Courier New',Courier,monospace;font-size:12px;text-align:center;">
        Sin desglose de productos
      </td>
    </tr>`

  // Convert plain text message to HTML paragraphs (preserve line breaks)
  const messageHtml = escHtml(message)
    .split('\n')
    .filter(l => l.trim())
    .map(l => `<p style="margin:0 0 10px;color:#dfd5c9;font-family:'Courier New',Courier,monospace;font-size:13px;line-height:1.7;">${l}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pedido MarginBites</title>
</head>
<body style="margin:0;padding:0;background-color:#1e1a17;font-family:'Courier New',Courier,monospace;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1e1a17;min-height:100vh;">
  <tr>
    <td align="center" style="padding:40px 20px;">

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background-color:#2a2522;border-radius:16px 16px 0 0;padding:32px 40px 28px;border-bottom:2px solid #19f973;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <img src="${logoUrl}" alt="MarginBites" width="180" style="display:block;height:auto;max-width:180px;" />
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;background-color:#19f973;color:#2a2522;font-family:'Courier New',Courier,monospace;font-size:10px;font-weight:bold;letter-spacing:2px;padding:5px 12px;border-radius:20px;text-transform:uppercase;">
                    Pedido de compra
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Meta info bar -->
        <tr>
          <td style="background-color:#332e2a;padding:14px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="color:rgba(223,213,201,0.5);font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;">
                  Para: <span style="color:#dfd5c9;">${escHtml(proveedor)}</span>
                </td>
                <td align="right" style="color:rgba(223,213,201,0.5);font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;">
                  ${numOrder ? `Ref: <span style="color:#19f973;">${escHtml(numOrder)}</span>&nbsp;&nbsp;·&nbsp;&nbsp;` : ''}Fecha: <span style="color:#dfd5c9;">${today}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#2a2522;padding:32px 40px;">

            <!-- Message -->
            <div style="margin-bottom:28px;">
              ${messageHtml}
            </div>

            <!-- Items table -->
            ${items.length > 0 ? `
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
              <tr>
                <td style="background-color:#332e2a;padding:10px 20px;color:rgba(223,213,201,0.45);font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;">
                  Producto
                </td>
                <td style="background-color:#332e2a;padding:10px 20px;color:rgba(223,213,201,0.45);font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;text-align:right;">
                  Cantidad
                </td>
              </tr>
              ${itemRows}
            </table>` : ''}

          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="background-color:#2a2522;padding:0 40px;">
            <div style="height:1px;background:linear-gradient(to right,transparent,rgba(25,249,115,0.3),transparent);"></div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#2a2522;border-radius:0 0 16px 16px;padding:24px 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0 0 4px;color:rgba(223,213,201,0.35);font-family:'Courier New',Courier,monospace;font-size:11px;">
                    Este email fue generado automáticamente desde MarginBites.
                  </p>
                  <p style="margin:0;color:rgba(223,213,201,0.2);font-family:'Courier New',Courier,monospace;font-size:10px;">
                    Gestión de cocina inteligente · marginbites.com
                  </p>
                </td>
                <td align="right" style="vertical-align:bottom;">
                  <img src="${base}/logos/ICON_GREEN.png" alt="" width="28" style="display:block;opacity:0.6;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td>
  </tr>
</table>

</body>
</html>`
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
