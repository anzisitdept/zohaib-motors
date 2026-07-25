"use client";
import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown, Car, CreditCard, Activity, PieChart as PieChartIcon } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";

export const AnalyticsOverviewManager = () => {
  const [soldCars, setSoldCars] = useState<any[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    // 1. Fetch Sold Cars (saleInvoices)
    unsubs.push(onSnapshot(query(collection(db, "cars"), where("isSold", "==", true)), snap => {
      setSoldCars(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    // 2. Fetch Installment Plans
    unsubs.push(onSnapshot(collection(db, "installmentPlans"), snap => {
      setInstallmentPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    const timer = setTimeout(() => setLoading(false), 800);
    return () => {
      clearTimeout(timer);
      unsubs.forEach(u => u());
    };
  }, []);

  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let lastMonth = currentMonth - 1;
    let lastMonthYear = currentYear;
    if (lastMonth < 0) {
      lastMonth = 11;
      lastMonthYear -= 1;
    }

    let salesThisMonth = 0;
    let revThisMonth = 0;
    let salesLastMonth = 0;
    let revLastMonth = 0;

    // Monthly Sales Trend Data
    const monthlyDataMap: Record<string, { month: string; revenue: number; volume: number; ts: number }> = {};
    
    // Model Breakdown Data
    const brandMap: Record<string, number> = {};

    soldCars.forEach(car => {
      const saleDate = car.saleDate ? new Date(car.saleDate) : car.updatedAt?.toDate ? car.updatedAt.toDate() : null;
      if (!saleDate) return;

      const m = saleDate.getMonth();
      const y = saleDate.getFullYear();
      const price = Number(car.salePrice) || 0;

      // Current vs Last Month
      if (m === currentMonth && y === currentYear) {
        salesThisMonth++;
        revThisMonth += price;
      } else if (m === lastMonth && y === lastMonthYear) {
        salesLastMonth++;
        revLastMonth += price;
      }

      // Time Series
      const monthKey = saleDate.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!monthlyDataMap[monthKey]) {
        monthlyDataMap[monthKey] = { month: monthKey, revenue: 0, volume: 0, ts: new Date(y, m, 1).getTime() };
      }
      monthlyDataMap[monthKey].revenue += price;
      monthlyDataMap[monthKey].volume += 1;

      // Brand Breakdown
      const brand = car.brandName || "Other";
      brandMap[brand] = (brandMap[brand] || 0) + 1;
    });

    const salesVolTrend = salesLastMonth > 0 ? ((salesThisMonth - salesLastMonth) / salesLastMonth) * 100 : 0;
    const revTrend = revLastMonth > 0 ? ((revThisMonth - revLastMonth) / revLastMonth) * 100 : 0;

    const monthlyTrendChart = Object.values(monthlyDataMap)
      .sort((a, b) => a.ts - b.ts)
      .slice(-6); // Last 6 months

    const brandPieChart = Object.entries(brandMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 brands

    // Installments
    let activePlans = 0;
    let overduePlans = 0;
    let totalOutstanding = 0;

    installmentPlans.forEach(p => {
      if (p.status === "active" || p.status === "due_soon") activePlans++;
      if (p.status === "overdue") overduePlans++;
      totalOutstanding += Number(p.outstandingBalance || 0);
    });

    return {
      salesThisMonth,
      salesLastMonth,
      salesVolTrend,
      revThisMonth,
      revLastMonth,
      revTrend,
      monthlyTrendChart,
      brandPieChart,
      activePlans,
      overduePlans,
      totalOutstanding
    };
  }, [soldCars, installmentPlans]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  const TrendPill = ({ val }: { val: number }) => {
    if (val === 0) return <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">No change</span>;
    const isUp = val > 0;
    return (
      <span className={cn(
        "text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit",
        isUp ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
      )}>
        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {Math.abs(val).toFixed(1)}% vs last mo
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-xl text-white shadow-sm">
            <BarChart3 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics Overview</h1>
            <p className="text-sm text-muted-foreground">High-level trends and business volume</p>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="border-border shadow-sm p-16 text-center text-muted-foreground">
          Loading analytics...
        </Card>
      ) : (
        <>
          {/* Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border shadow-sm">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">Vehicles Sold</h3>
                  <Car size={18} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-3xl font-black text-foreground">{metrics.salesThisMonth}</p>
                  <div className="mt-2"><TrendPill val={metrics.salesVolTrend} /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">Revenue (Mo)</h3>
                  <DollarSignIcon size={18} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-black text-foreground">Rs. {(metrics.revThisMonth / 1000000).toFixed(2)}M</p>
                  <div className="mt-2"><TrendPill val={metrics.revTrend} /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">Active Plans</h3>
                  <CreditCard size={18} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-3xl font-black text-foreground">{metrics.activePlans}</p>
                  <p className="text-xs font-medium text-rose-600 mt-2 bg-rose-50 px-2 py-0.5 rounded-full w-fit">
                    {metrics.overduePlans} currently overdue
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm bg-primary border-primary">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-primary-foreground/80 text-sm uppercase tracking-wide">Inst. Outstanding</h3>
                  <Activity size={18} className="text-primary-foreground/80" />
                </div>
                <div>
                  <p className="text-2xl font-black text-primary-foreground">Rs. {(metrics.totalOutstanding / 1000000).toFixed(2)}M</p>
                  <p className="text-xs font-medium text-primary-foreground/80 mt-2">
                    Across all plans
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-border shadow-sm lg:col-span-2">
              <CardHeader className="border-b border-border bg-card">
                <CardTitle className="text-base font-bold text-foreground">Monthly Sales Volume</CardTitle>
                <CardDescription>Vehicles sold over the last 6 months</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {metrics.monthlyTrendChart.length < 2 ? (
                  <div className="h-64 flex items-center justify-center border border-dashed border-border rounded-xl text-muted-foreground bg-muted/20">
                    Not enough data yet
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.monthlyTrendChart}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                        <Tooltip 
                          cursor={{ fill: '#334155', opacity: 0.1 }}
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                        />
                        <Bar dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border bg-card">
                <CardTitle className="text-base font-bold text-foreground">Sales by Brand</CardTitle>
                <CardDescription>Top performing vehicle makers</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {metrics.brandPieChart.length === 0 ? (
                  <div className="h-64 flex items-center justify-center border border-dashed border-border rounded-xl text-muted-foreground bg-muted/20">
                    Not enough data yet
                  </div>
                ) : (
                  <div className="h-64 flex flex-col">
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metrics.brandPieChart}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {metrics.brandPieChart.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {metrics.brandPieChart.map((entry, index) => (
                        <div key={entry.name} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="truncate text-muted-foreground" title={entry.name}>{entry.name}</span>
                          <span className="font-bold text-foreground ml-auto">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

// Helper
const DollarSignIcon = ({ className, size }: { className?: string, size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="1" x2="12" y2="23"></line>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </svg>
);
