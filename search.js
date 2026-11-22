const fs = require('fs');
const content = fs.readFileSync('F:\\Desarrollo\\Nexus\\copi-autopint-formulario\\app\\page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('type="radio"') || line.includes('type="checkbox"') || line.includes("type='radio'") || line.includes("type='checkbox'")) {
    console.log(i+1, line.trim());
  }
});