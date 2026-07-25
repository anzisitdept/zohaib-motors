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
let replaceCount = 0;

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  
  const searchStr = '<h2 className="text-2xl font-black tracking-tighter text-foreground mb-3 uppercase">Zohaib Motors</h2>';
  if (content.includes(searchStr)) {
    // Upgraded typographic logo
    const upgradedLogo = '<div className="mb-3 -ml-1"><h2 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-[#E5484D] to-[#8a1c20] bg-clip-text text-transparent uppercase drop-shadow-sm leading-none">ZOHAIB MOTORS</h2><div className="h-1 w-12 bg-[#1C1F26] mt-1 rounded-full opacity-80"></div></div>';
    
    content = content.replace(new RegExp(searchStr.replace(/[.*+?^$\/{}()|[\]\\]/g, '\\$&'), 'g'), upgradedLogo);
    fs.writeFileSync(file, content);
    console.log(`Upgraded logo in ${file}`);
    replaceCount++;
  }
}

console.log(`Finished upgrading logo in ${replaceCount} files.`);
