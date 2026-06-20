import fs from 'fs';
import path from 'path';

const replacements = [
  { regex: /bg-indigo-600\s+hover:bg-indigo-700/g, replace: "bg-btn-bg hover:bg-btn-hover active:bg-btn-active" },
  { regex: /bg-indigo-600\/10/g, replace: "bg-elements/50" },
  { regex: /bg-indigo-600/g, replace: "bg-btn-bg" },
  { regex: /bg-indigo-500\/10/g, replace: "bg-elements" },
  { regex: /bg-indigo-500\/20/g, replace: "bg-elements-hover" },
  { regex: /bg-indigo-500/g, replace: "bg-text-tertiary" }, // For progress bar / indicators
  { regex: /text-indigo-400/g, replace: "text-white" },
  { regex: /text-indigo-500/g, replace: "text-text-secondary" },
  { regex: /border-indigo-500\/20/g, replace: "border-border-base" },
  { regex: /border-indigo-500\/30/g, replace: "border-border-base" },
  { regex: /border-indigo-500\/50/g, replace: "border-border-gray" },
  { regex: /border-indigo-500/g, replace: "border-border-gray" },
  { regex: /focus:border-indigo-500/g, replace: "focus:border-border-gray" },
  { regex: /focus:ring-indigo-500/g, replace: "focus:ring-border-gray" },
  { regex: /ring-indigo-500/g, replace: "ring-border-gray" },
  { regex: /shadow-indigo-500\/25/g, replace: "shadow-black/20" }
];

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('./src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.css')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;
    
    for (const r of replacements) {
      newContent = newContent.replace(r.regex, r.replace);
    }
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
      console.log(`Updated ${filePath}`);
    }
  }
});
