import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('./src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content.replace(/rounded-(2xl|xl|lg|md)/g, (match, p1) => {
      if (p1 === '2xl') return 'rounded-xl';
      if (p1 === 'xl') return 'rounded-lg';
      if (p1 === 'lg') return 'rounded-md';
      if (p1 === 'md') return 'rounded-sm';
      return match;
    });
    
    // Replace text-lg font-bold or text-xl font-bold etc with font-title
    newContent = newContent.replace(/(text-(xl|2xl|3xl|4xl)[^"']*)(font-bold|font-semibold)/g, "$1$3 font-title");
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
      console.log(`Updated ${filePath}`);
    }
  }
});
