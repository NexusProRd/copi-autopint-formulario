const fs = require('fs');
const content = fs.readFileSync('F:\\Desarrollo\\Nexus\\copi-autopint-formulario\\app\\page.tsx', 'utf8');
const idx = content.indexOf("q.type==='radio'");
if (idx >= 0) {
  console.log(content.substring(idx, idx + 500));
}