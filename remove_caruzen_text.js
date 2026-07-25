const fs = require('fs');
const path = require('path');

function walkSync(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    const dirent = fs.statSync(dirFile);
    if (dirent.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        filelist = walkSync(dirFile, filelist);
      }
    } else {
      if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
}

const allFiles = walkSync('features');
allFiles.push(...walkSync('app'));
allFiles.push(...walkSync('components'));

let replaceCount = 0;

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Replacements
  content = content.replace(/Caruzen Motors/g, 'Zohaib Motors');
  content = content.replace(/Caruzen Accounts System/g, 'Zohaib Motors Accounts System');
  content = content.replace(/Caruzen accounts System/g, 'Zohaib Motors accounts System');
  content = content.replace(/Caruzen Accounts/g, 'Zohaib Motors Accounts');
  content = content.replace(/caruzen-logo/g, 'zohaib-logo'); // if any
  content = content.replace(/\bCaruzen\b/g, 'Zohaib Motors');
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Removed Caruzen references in ${file}`);
    replaceCount++;
  }
}

console.log(`Finished removing Caruzen references in ${replaceCount} files.`);
