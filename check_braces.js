const fs = require('fs');
const code = fs.readFileSync('features/invoices/SaleInvoicePrintModal.tsx', 'utf8');
let open = 0, close = 0, inString = false;
for (let i = 0; i < code.length; i++) {
  const ch = code[i];
  if (ch === '"' && code[i-1] !== '\\') inString = !inString;
  if (!inString) {
    if (ch === '{') open++;
    if (ch === '}') close++;
  }
}
console.log('Open:', open, 'Close:', close, 'Diff:', open - close);