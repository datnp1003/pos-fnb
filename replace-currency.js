const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let replaced = content
    .replace(/\+\s*"đ"/g, '+ (t.common.d || "")')
    .replace(/\+\s*'đ'/g, '+ (t.common.d || "")')
    .replace(/(\}đ)(<)/g, '}{t.common.d}$2');
    
  if (content !== replaced) {
    fs.writeFileSync(f, replaced, 'utf8');
    console.log('Replaced in ' + f);
  }
});
