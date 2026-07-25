const fs = require('fs');
const file = 'app/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. QUICK_ACTIONS array replacement
content = content.replace(/const QUICK_ACTIONS = \[\s+[\s\S]+?\];/, `const QUICK_ACTIONS = [
  { label: "New Registration",   href: "/dashboard/registry",          icon: UserPlus,      iconColor: "text-[#E5484D]" },
  { label: "Sale Invoice",       href: "/dashboard/sale-invoice",      icon: Receipt,       iconColor: "text-[#5B7FD1]" },
  { label: "Purchase Invoice",   href: "/dashboard/purchase-invoice",  icon: ShoppingCart,  iconColor: "text-[#F2A93C]" },
  { label: "Cash Voucher",       href: "/dashboard/cash-voucher",      icon: Banknote,      iconColor: "text-[#E5484D]" },
  { label: "General Voucher",    href: "/dashboard/general-voucher",   icon: BookOpen,      iconColor: "text-[#5B7FD1]" },
  { label: "Clients",            href: "/dashboard/clients",           icon: Users,         iconColor: "text-[#F2A93C]" },
  { label: "Purchase Inventory", href: "/dashboard/purchase-inventory",icon: Package,       iconColor: "text-[#E5484D]" },
  { label: "General Ledger",     href: "/dashboard/general-ledger",    icon: BarChart3,     iconColor: "text-[#5B7FD1]" },
  { label: "Reports",            href: "/dashboard/reports",           icon: ClipboardList, iconColor: "text-[#F2A93C]" },
];`);

// 2. QUICK_ACTIONS mapping replacement
content = content.replace(/\{QUICK_ACTIONS\.map\(action => \{[\s\S]+?\}\)\}/, `{QUICK_ACTIONS.map(action => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href}>
                  <Card className="border-[0.5px] border-[#2E323C] bg-[#1C1F26] hover:bg-[#252932] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer h-full">
                    <CardContent className="p-4 flex flex-col items-center justify-center gap-3 h-full text-center">
                      <Icon size={24} className={action.iconColor} />
                      <span className="text-[11px] font-semibold leading-tight text-[#F2F1EE]">{action.label}</span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}`);

// 3. Layout fix (Hero Metric Layout)
const layoutReplacement = `{/* ── Asymmetric Layout: Hero Metric + Secondary Metrics ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hero Card */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {(["bank"] as MetricKey[]).map(key => {
              const cfg = METRIC_CONFIG[key];
              const Icon = cfg.icon;
              const isActive = activeMetric === key;
              return (
                <Card
                  key={key}
                  onClick={() => setActiveMetric(key)}
                  className={'border bg-card relative cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex-1 flex flex-col justify-center ' +
                    (isActive ? 'border-primary border-l-4 scale-[1.01] shadow-md' : 'border-border opacity-90 hover:opacity-100')}
                >
                  <div className={'absolute -right-3 -top-3 opacity-5 ' + cfg.color}>
                    <Icon size={120} />
                  </div>
                  <CardContent className="p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <Icon size={24} className={cfg.color} />
                      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">{cfg.label}</span>
                    </div>
                    <p className="text-4xl font-extrabold leading-tight text-foreground">{fmt(metricValues[key])}</p>
                    {isActive && (
                      <div className="mt-4 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <PieChartIcon size={14} className={cfg.color} /> Showing breakdown and trends
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Secondary 4 Metrics Grid */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(["cash", "inventory", "receivables", "payables"] as MetricKey[]).map(key => {
              const cfg = METRIC_CONFIG[key];
              const Icon = cfg.icon;
              const isActive = activeMetric === key;
              return (
                <Card
                  key={key}
                  onClick={() => setActiveMetric(key)}
                  className={'border bg-card relative cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm ' +
                    (isActive ? 'border-primary border-l-4 scale-[1.01] shadow-sm' : 'border-border opacity-90 hover:opacity-100')}
                >
                  <div className={'absolute -right-2 -top-2 opacity-5 ' + cfg.color}>
                    <Icon size={70} />
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={16} className={cfg.color} />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{cfg.label}</span>
                    </div>
                    <p className="text-xl font-extrabold leading-tight text-foreground">{fmt(metricValues[key])}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>`;

content = content.replace(/\{\/\* ── 5 Metric Cards ── \*\/\}[\s\S]+?<\/div>\s*\{\/\* ── Dynamic Charts ── \*\/\}/, layoutReplacement + '\n\n        {/* ── Dynamic Charts ── */}');

// 4. Integrated Pipelines
content = content.replace(/<\/section>[\s\S]+?\{\/\* ═══════════════════════════════════════════════════════════════\s+FILE TRACKING DASHBOARD\s+═══════════════════════════════════════════════════════════════ \*\/\}[\s\S]+?<div>/, `        {/* ═══════════════════════════════════════════════════════════════
          FILE TRACKING DASHBOARD (Integrated)
        ═══════════════════════════════════════════════════════════════ */}
        <div className="pt-4">`);

// 5. Semantic Tokens (Local to page.tsx)
const tokens = [
  { from: /\\bbg-white\\b/g, to: 'bg-card' },
  { from: /\\bbg-slate-50\\b/g, to: 'bg-muted' },
  { from: /\\bbg-slate-100\\b/g, to: 'bg-muted' },
  { from: /\\bbg-slate-200\\b/g, to: 'border-border' },
  { from: /\\bborder-slate-100\\b/g, to: 'border-border' },
  { from: /\\bborder-slate-200\\b/g, to: 'border-border' },
  { from: /\\btext-slate-300\\b/g, to: 'text-muted-foreground' },
  { from: /\\btext-slate-400\\b/g, to: 'text-muted-foreground' },
  { from: /\\btext-slate-500\\b/g, to: 'text-muted-foreground' },
  { from: /\\btext-slate-600\\b/g, to: 'text-muted-foreground' },
  { from: /\\btext-slate-700\\b/g, to: 'text-foreground' },
  { from: /\\btext-slate-800\\b/g, to: 'text-foreground' },
  { from: /\\btext-slate-900\\b/g, to: 'text-foreground' },
  { from: /\\bbg-slate-900\\b/g, to: 'bg-primary text-primary-foreground' },
  { from: /\\bhover:bg-slate-800\\b/g, to: 'hover:bg-primary/90' },
];

for (const {from, to} of tokens) {
  content = content.replace(from, to);
}

fs.writeFileSync(file, content);
console.log('Reapplied all fixes to page.tsx successfully!');
