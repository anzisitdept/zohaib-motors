const fs = require('fs');
const file = 'app/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const tokens = [
  { from: /\bbg-white\b/g, to: 'bg-card' },
  { from: /\bbg-slate-50\b/g, to: 'bg-muted' },
  { from: /\bbg-slate-100\b/g, to: 'bg-muted' },
  { from: /\bbg-slate-200\b/g, to: 'border-border' },
  { from: /\bborder-slate-100\b/g, to: 'border-border' },
  { from: /\bborder-slate-200\b/g, to: 'border-border' },
  { from: /\btext-slate-300\b/g, to: 'text-muted-foreground' },
  { from: /\btext-slate-400\b/g, to: 'text-muted-foreground' },
  { from: /\btext-slate-500\b/g, to: 'text-muted-foreground' },
  { from: /\btext-slate-600\b/g, to: 'text-muted-foreground' },
  { from: /\btext-slate-700\b/g, to: 'text-foreground' },
  { from: /\btext-slate-800\b/g, to: 'text-foreground' },
  { from: /\btext-slate-900\b/g, to: 'text-foreground' },
  { from: /\bbg-slate-900\b/g, to: 'bg-primary text-primary-foreground' },
  { from: /\bhover:bg-slate-800\b/g, to: 'hover:bg-primary/90' },
];

for (const {from, to} of tokens) {
  content = content.replace(from, to);
}

fs.writeFileSync(file, content);
console.log('Tokens reapplied correctly!');
