// House rule, enforced instead of remembered: no em dashes or en dashes anywhere in the site.
// Runs before every build (npm "prebuild"). A typographic minus (U+2212) is allowed for numbers.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['content', 'pages', 'components', 'lib', 'styles', 'public', 'apps-script', 'scripts'];
const TEXT = new Set(['.js', '.mjs', '.cjs', '.css', '.txt', '.xml', '.json', '.gs', '.md']);
const BANNED = /[\u2013\u2014]/; // en dash, em dash
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (TEXT.has(extname(name))) {
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        if (BANNED.test(line)) problems.push(`${path}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
  }
}

for (const root of ROOTS) {
  try { walk(root); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
for (const doc of ['README.md', 'DEPLOY.md', 'DESIGN.md', 'PRODUCT.md']) {
  try {
    readFileSync(doc, 'utf8').split('\n').forEach((line, i) => {
      if (BANNED.test(line)) problems.push(`${doc}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
}

if (problems.length) {
  console.error('Em or en dash found. Use a period, comma, colon, parentheses, or a hyphen for ranges:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('check-copy: no em or en dashes');
