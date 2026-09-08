import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

const brokenRefs: any[] = [];

for (const f of files) {
  const content = fs.readFileSync(path.join(publicDir, f), 'utf-8');
  
  // check src="..."
  const srcRegex = /src=["']([^"'#?]+)["']/g;
  let match;
  while ((match = srcRegex.exec(content)) !== null) {
    const src = match[1];
    if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('//') || src.startsWith('blob:')) continue;
    const cleanSrc = src.startsWith('/') ? src.slice(1) : src;
    const target = path.join(publicDir, cleanSrc);
    if (!fs.existsSync(target)) {
      brokenRefs.push({ file: f, type: 'src', ref: src });
    }
  }

  // check href="..." (stylesheets, links)
  const hrefRegex = /href=["']([^"'#?]+)["']/g;
  while ((match = hrefRegex.exec(content)) !== null) {
    const href = match[1];
    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#') || href.startsWith('data:') || href.startsWith('//') || href.startsWith('javascript:')) continue;
    const cleanHref = href.startsWith('/') ? href.slice(1) : href;
    const target = path.join(publicDir, cleanHref);
    if (!fs.existsSync(target)) {
      brokenRefs.push({ file: f, type: 'href', ref: href });
    }
  }
}

console.log('Broken references found:', brokenRefs.length);
if (brokenRefs.length > 0) {
  console.log(JSON.stringify(brokenRefs, null, 2));
}
