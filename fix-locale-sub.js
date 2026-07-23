const fs = require('fs');

let c = fs.readFileSync('src/app/(pos)/reports/reports-client.tsx', 'utf8');
['OverviewTab', 'InvoiceTab', 'SoldItemsTab', 'RevenueTab', 'IngredientTab'].forEach(fn => {
  c = c.replace(new RegExp(`function ${fn}\\([^)]+\\) \\{\\s*`), `$&const { locale } = useI18n();\n  `);
});
fs.writeFileSync('src/app/(pos)/reports/reports-client.tsx', c);

let c2 = fs.readFileSync('src/app/(pos)/settings/components-templates.tsx', 'utf8');
c2 = c2.replace(/function TemplatePreview\([^)]+\) \{\s*/, `$&const { locale } = useI18n();\n  `);
fs.writeFileSync('src/app/(pos)/settings/components-templates.tsx', c2);

let c3 = fs.readFileSync('src/app/(pos)/order/order-client.tsx', 'utf8');
c3 = c3.replace(/function OrderDetailView\([^)]+\) \{\s*/, `$&const { locale } = useI18n();\n  `);
fs.writeFileSync('src/app/(pos)/order/order-client.tsx', c3);
