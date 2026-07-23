const fs = require('fs');

const languages = {
  'en': {
    currenciesPageDesc: 'Manage currencies — set primary currency and exchange rates.',
    exchangeRate: 'Exchange Rate',
    primary: 'Primary',
    symbol: 'Symbol',
    confirmDelete: 'Are you sure you want to delete?'
  },
  'vi': {
    currenciesPageDesc: 'Quản lý tiền tệ — thiết lập tiền tệ chính và tỷ giá.',
    exchangeRate: 'Tỷ giá',
    primary: 'Chính',
    symbol: 'Ký hiệu',
    confirmDelete: 'Bạn có chắc muốn xóa?'
  },
  'pt': {
    currenciesPageDesc: 'Gerencie moedas — defina a moeda principal e taxas de câmbio.',
    exchangeRate: 'Taxa de Câmbio',
    primary: 'Principal',
    symbol: 'Símbolo',
    confirmDelete: 'Tem certeza que deseja excluir?'
  },
  'zh': {
    currenciesPageDesc: '管理货币 — 设置主要货币和汇率。',
    exchangeRate: '汇率',
    primary: '主要',
    symbol: '符号',
    confirmDelete: '您确定要删除吗？'
  },
  'ko': {
    currenciesPageDesc: '통화 관리 — 기본 통화 및 환율 설정.',
    exchangeRate: '환율',
    primary: '기본',
    symbol: '기호',
    confirmDelete: '정말 삭제하시겠습니까?'
  },
  'ja': {
    currenciesPageDesc: '通貨の管理 — 基本通貨と為替レートを設定します。',
    exchangeRate: '為替レート',
    primary: '主要',
    symbol: 'シンボル',
    confirmDelete: '本当に削除しますか？'
  }
};

Object.keys(languages).forEach(lang => {
  const dict = languages[lang];
  let c = fs.readFileSync(`src/i18n/${lang}.ts`, 'utf8');

  // Insert into common: { ... }
  if (!c.includes('symbol:')) {
    c = c.replace(/("?)common("?):\s*\{/, `$1common$2: {\n    symbol: "${dict.symbol}",\n    confirmDelete: "${dict.confirmDelete}",`);
  } else {
    // maybe confirmDelete is missing but symbol is there?
    if (!c.includes('confirmDelete:')) {
      c = c.replace(/symbol:\s*"[^"]+",/, `$& \n    confirmDelete: "${dict.confirmDelete}",`);
    }
  }

  // Insert into settings: { ... }
  if (!c.includes('currenciesPageDesc')) {
    c = c.replace(/("?)paymentMethodPageDesc("?):\s*"[^"]+",/, `$&
    currenciesPageDesc: "${dict.currenciesPageDesc}",
    exchangeRate: "${dict.exchangeRate}",
    primary: "${dict.primary}",`);
  }

  fs.writeFileSync(`src/i18n/${lang}.ts`, c, 'utf8');
});
