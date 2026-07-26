const fs = require('fs');
const logPath = 'C:/Users/Dell-7470/.gemini/antigravity/brain/5903b5a2-7091-475d-a2cd-bb6222cac987/.system_generated/logs/overview.txt';
const log = fs.readFileSync(logPath, 'utf8');

const startMarker = 'Showing lines 1 to 724';
const endMarker = 'The above content shows the entire, complete file contents of the requested file.';

const startIdx = log.lastIndexOf(startMarker);
if (startIdx === -1) { console.error('Start marker not found'); process.exit(1); }

const endIdx = log.indexOf(endMarker, startIdx);
if (endIdx === -1) { console.error('End marker not found'); process.exit(1); }

// Extract the block
let block = log.substring(startIdx, endIdx);
// The block starts with 'Showing lines 1 to 724\n...', followed by the line number warning.
const lines = block.split('\n');

let fileContent = [];
let started = false;
for (let line of lines) {
  if (line.match(/^1: /)) started = true;
  if (!started) continue;
  
  // match 'line_number: content'
  const match = line.match(/^\d+: (.*)$/);
  if (match) {
    fileContent.push(match[1]);
  } else if (line.match(/^\d+:$/)) {
    // empty line
    fileContent.push('');
  }
}

let contentStr = fileContent.join('\n');

// Now apply the React Fragment fix
contentStr = contentStr.replace(/import \{ useEffect, useState, useMemo \} from "react";/g, 'import { useEffect, useState, useMemo, Fragment } from "react";');

// Fix Document Pipeline
contentStr = contentStr.replace(
  /\]\.map\(\(s, i, arr\) => \(\n\s*<>\n\s*<div key=\{s\.label\} /g,
  '].map((s, i, arr) => (\n                  <Fragment key={s.label}>\n                    <div '
);

// Remove the remaining <> parts for Document Pipeline and Plate Pipeline
contentStr = contentStr.replace(
  /key=\{\`arr-\$\{i\}\`\} \/>\}\n\s*<\/>/g,
  '/>}\n                  </Fragment>'
);

fs.writeFileSync('app/dashboard/page.tsx', contentStr, 'utf8');
console.log('Restored and fixed page.tsx');
