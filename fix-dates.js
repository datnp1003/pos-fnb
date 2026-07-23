const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let original = content;

  // 1. Fix dashboard long ternary
  content = content.replace(
    /locale === "vi" \? "vi-VN" : locale === "en" \? "en-US" : locale === "zh" \? "zh-CN" : locale === "ko" \? "ko-KR" : "ja-JP"/g,
    'locale === "pt" ? "pt-BR" : locale === "en" ? "en-US" : "vi-VN"'
  );

  // 2. Add locale to useI18n if it's missing but t is used, and there is a date formatting happening that will need locale
  if (content.includes('toLocaleDateString') || content.includes('toLocaleTimeString')) {
    if (content.includes('const { t } = useI18n();')) {
      content = content.replace('const { t } = useI18n();', 'const { t, locale } = useI18n();');
    }
  }

  // 3. Replace "vi-VN" and "en-US" inside toLocaleDateString and toLocaleTimeString with dynamic locale
  // Careful not to replace inside Intl.NumberFormat if we just want numbers to be "vi-VN"
  content = content.replace(
    /\.toLocaleDateString\("vi-VN"/g,
    '.toLocaleDateString(locale === "pt" ? "pt-BR" : locale === "en" ? "en-US" : "vi-VN"'
  );
  content = content.replace(
    /\.toLocaleTimeString\("vi-VN"/g,
    '.toLocaleTimeString(locale === "pt" ? "pt-BR" : locale === "en" ? "en-US" : "vi-VN"'
  );
  content = content.replace(
    /\.toLocaleDateString\("en-US"/g,
    '.toLocaleDateString(locale === "pt" ? "pt-BR" : locale === "en" ? "en-US" : "vi-VN"'
  );
  content = content.replace(
    /\.toLocaleTimeString\("en-US"/g,
    '.toLocaleTimeString(locale === "pt" ? "pt-BR" : locale === "en" ? "en-US" : "vi-VN"'
  );

  // For inventory-client.tsx it had: toLocaleDateString() without arguments at line 121
  // We can just add the locale
  content = content.replace(
    /\.toLocaleDateString\(\)/g,
    '.toLocaleDateString(locale === "pt" ? "pt-BR" : locale === "en" ? "en-US" : "vi-VN")'
  );

  if (content !== original) {
    fs.writeFileSync(f, content, 'utf8');
    console.log('Fixed dates in: ' + f);
  }
});
