const fs = require('fs');
const dicts = {
  en: { cpd: 'Manage currencies — set primary currency and exchange rates.', er: 'Exchange Rate', pri: 'Primary', sym: 'Symbol', del: 'Are you sure you want to delete?' },
  vi: { cpd: 'Quản lý tiền tệ — thiết lập tiền tệ chính và tỷ giá.', er: 'Tỷ giá', pri: 'Chính', sym: 'Ký hiệu', del: 'Bạn có chắc muốn xóa?' },
  pt: { cpd: 'Gerencie moedas — defina a moeda principal e taxas de câmbio.', er: 'Taxa de Câmbio', pri: 'Principal', sym: 'Símbolo', del: 'Tem certeza que deseja excluir?' },
  zh: { cpd: '管理货币 — 设置主要货币和汇率。', er: '汇率', pri: '主要', sym: '符号', del: '您确定要删除吗？' },
  ko: { cpd: '통화 관리 — 기본 통화 및 환율 설정.', er: '환율', pri: '기본', sym: '기호', del: '정말 삭제하시겠습니까?' },
  ja: { cpd: '通貨の管理 — 基本通貨と為替レートを設定します。', er: '為替レート', pri: '主要', sym: 'シンボル', del: '本当に削除しますか？' }
};

Object.keys(dicts).forEach(lang => {
  let c = fs.readFileSync('src/i18n/' + lang + '.ts', 'utf8');
  let d = dicts[lang];
  
  // Replace settings
  c = c.replace(/("?)paymentMethodPageDesc("?):\s*("[^"]+"),/, `$1paymentMethodPageDesc$2: $3,
    $1currenciesPageDesc$2: "${d.cpd}",
    $1exchangeRate$2: "${d.er}",
    $1primary$2: "${d.pri}",`);
  
  // Replace common
  c = c.replace(/("?)common("?):\s*\{/, `$1common$2: {
    $1symbol$2: "${d.sym}",
    $1confirmDelete$2: "${d.del}",`);

  fs.writeFileSync('src/i18n/' + lang + '.ts', c);
});
