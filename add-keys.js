const fs = require('fs');
['vi', 'en', 'pt'].forEach(lang => {
  let c = fs.readFileSync(`src/i18n/${lang}.ts`, 'utf8');
  if (!c.includes('currenciesPageDesc')) {
    const desc = lang === 'vi' ? 'Quản lý tiền tệ — thiết lập tiền tệ chính e tỷ giá.' : lang === 'pt' ? 'Gerencie moedas — defina a moeda principal e taxas de câmbio.' : 'Manage currencies — set primary currency and exchange rates.';
    c = c.replace(/paymentMethodPageDesc: [^\n]+,/, `$&
    currenciesPageDesc: "${desc}",
    exchangeRate: "${lang==='vi'?'Tỷ giá':lang==='pt'?'Taxa de Câmbio':'Exchange Rate'}",
    primary: "${lang==='vi'?'Chính':lang==='pt'?'Principal':'Primary'}",`);
  }
  if (!c.includes('symbol:')) {
    c = c.replace(/common: \{/, `common: {
    symbol: "${lang==='vi'?'Ký hiệu':lang==='pt'?'Símbolo':'Symbol'}",`);
  }
  fs.writeFileSync(`src/i18n/${lang}.ts`, c, 'utf8');
});
