/* F1 — Agrega @map("snake_case") a cada campo de los modelos del schema.prisma */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const lines = fs.readFileSync(file, 'utf8').split('\n');

function toSnake(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

const out = [];
let inModel = false;
for (const line of lines) {
  if (/^model\s+\w+\s*\{/.test(line)) inModel = true;
  else if (/^\}/.test(line)) inModel = false;

  if (inModel && /^  [a-zA-Z]\w*\s+\S/.test(line) && !line.startsWith('  @@') && !line.includes('@map(')) {
    const m = line.match(/^  ([a-zA-Z]\w*)\s+(.+)$/);
    out.push(`  ${m[1]} ${m[2]} @map("${toSnake(m[1])}")`);
  } else {
    out.push(line);
  }
}
fs.writeFileSync(file, out.join('\n'));
console.log('schema.prisma actualizado con @map');
