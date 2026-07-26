const fs = require('fs');
const logPath = 'C:/Users/Dell-7470/.gemini/antigravity/brain/5903b5a2-7091-475d-a2cd-bb6222cac987/.system_generated/logs/overview.txt';
const log = fs.readFileSync(logPath, 'utf8');

const startMarker = 'Showing lines 1 to 724';
const endMarker = 'The above content shows the entire, complete file contents of the requested file.';

const startIdx = log.lastIndexOf(startMarker);
if (startIdx === -1) { console.error('Start marker not found'); process.exit(1); }

const endIdx = log.indexOf(endMarker, startIdx);
if (endIdx === -1) { console.error('End marker not found'); process.exit(1); }

let block = log.substring(startIdx, endIdx);
const lines = block.split('\n');

let fileContent = [];
let started = false;
for (let line of lines) {
  if (line.match(/^1: /)) started = true;
  if (!started) continue;
  
  const match = line.match(/^\d+: (.*)$/);
  if (match) {
    fileContent.push(match[1]);
  } else if (line.match(/^\d+:$/)) {
    fileContent.push('');
  }
}

let contentStr = fileContent.join('\n');

// 1) Replace import
contentStr = contentStr.replace(
  'import { useEffect, useState, useMemo } from "react";',
  'import { useEffect, useState, useMemo, Fragment } from "react";'
);

// 2) Document Pipeline
let docIndex = contentStr.indexOf('value: analytics.docsDelivered, cls: "bg-green-100 text-green-700" },');
if (docIndex !== -1) {
  let target = contentStr.substring(docIndex);
  let toReplace = '].map((s, i, arr) => (\n                  <>\n                    <div key={s.label}';
  let replaceWith = '].map((s, i, arr) => (\n                  <Fragment key={s.label}>\n                    <div';
  contentStr = contentStr.replace(toReplace, replaceWith);
  
  let toReplaceEnd = 'key={`arr-${i}`} />}\n                  </>';
  let replaceWithEnd = '/>}\n                  </Fragment>';
  contentStr = contentStr.replace(toReplaceEnd, replaceWithEnd);
}

// 3) Plate Pipeline
let plateIndex = contentStr.indexOf('value: analytics.platesDelivered, cls: "bg-green-100 text-green-700" },');
if (plateIndex !== -1) {
  let target = contentStr.substring(plateIndex);
  let toReplace = '].map((s, i, arr) => (\n                  <>\n                    <div key={s.label}';
  let replaceWith = '].map((s, i, arr) => (\n                  <Fragment key={s.label}>\n                    <div';
  // Use lastIndexOf or a custom regex for the second occurrence
  let regex2 = /\]\.map\(\(s, i, arr\) => \(\n\s*<>\n\s*<div key=\{s\.label\}/g;
  contentStr = contentStr.replace(regex2, '].map((s, i, arr) => (\n                  <Fragment key={s.label}>\n                    <div');
  
  let regexEnd = /key=\{\`arr-\$\{i\}\`\} \/>\}\n\s*<\/>/g;
  contentStr = contentStr.replace(regexEnd, '/>}\n                  </Fragment>');
}

fs.writeFileSync('app/dashboard/page.tsx', contentStr, 'utf8');
console.log('Restored and fixed page.tsx successfully');
