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
  
  const regex = /<img[^>]*src="\/carlogo\.png"[^>]*>/g;
  if (regex.test(content)) {
    content = content.replace(regex, `<h2 className="text-2xl font-black tracking-tighter text-foreground mb-3 uppercase">Zohaib Motors</h2>`);
    fs.writeFileSync(file, content);
    console.log(`Replaced in ${file}`);
    replaceCount++;
  }
}

console.log(`Finished replacing in ${replaceCount} files.`);
