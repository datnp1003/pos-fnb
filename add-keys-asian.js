const fs = require('fs');

const languages = {
  'zh': {
    currenciesPageDesc: '管理货币 — 设置主要货币和汇率。',
    exchangeRate: '汇率',
    primary: '主要',
    symbol: '符号'
  },
  'ko': {
    currenciesPageDesc: '통화 관리 — 기본 통화 및 환율 설정.',
    exchangeRate: '환율',
    primary: '기본',
    symbol: '기호'
  },
  'ja': {
    currenciesPageDesc: '通貨の管理 — 基本通貨と為替レートを設定します。',
    exchangeRate: '為替レート',
    primary: '主要',
    symbol: 'シンボル'
  }
};

Object.keys(languages).forEach(lang => {
  const dict = languages[lang];
  let c = fs.readFileSync(`src/i18n/${lang}.ts`, 'utf8');

  if (!c.includes('currenciesPageDesc:')) {
    c = c.replace(/paymentMethodPageDesc: [^\n]+,/, `$&
    "currenciesPageDesc": "${dict.currenciesPageDesc}",
    "exchangeRate": "${dict.exchangeRate}",
    "primary": "${dict.primary}",`);
  }

  if (!c.includes('symbol:')) {
    c = c.replace(/"common": \{/, `"common": {
    "symbol": "${dict.symbol}",`);
  }

  fs.writeFileSync(`src/i18n/${lang}.ts`, c, 'utf8');
});
