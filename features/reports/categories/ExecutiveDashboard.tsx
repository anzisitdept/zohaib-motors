"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, Timestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { StatsCard } from "@/components/shared/StatsCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line, RadialBarChart, RadialBar, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  FileText, TrendingUp, Users, CarFront, Download,
  AlertTriangle, CheckCircle2, Fuel, LayoutDashboard, Database, Activity, ShieldAlert,
  Printer, Truck, Calendar, DollarSign
} from "lucide-react";

// --- Types ---
interface CarData {
  id: string;
  brandName: string;
  model: string;
  year: number;
  color: string;
  fuelType: string;
  transmission: string;
  currentStatus: string;
  chassisNumber: string;
  createdAt: Timestamp;
  ownerName?: string;
  fileStatus?: string;
  plateStatus?: string;
  registrationNumber?: string;
  cplcCounter?: string;
  engineNumber?: string;
  platesApplied?: boolean;
}

interface LogData {
  id: string;
  action: string;
  performedBy: string;
  timestamp: Timestamp;
  type: string;
  relatedCarId?: string;
  details?: string;
}

interface UserData {
  id: string;
  name: string;
  role: string;
}

// --- Colors & Themes ---
const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  slate: '#64748b',
  cyan: '#06b6d4',
  pink: '#ec4899'
};

const CHART_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.purple, COLORS.cyan, COLORS.pink, COLORS.danger];

export const ExecutiveDashboard = () => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);

  // Date Filters
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of current year
    end: new Date().toISOString().split('T')[0] // Today
  });

  // Data State
  const [cars, setCars] = useState<CarData[]>([]);
  const [logs, setLogs] = useState<LogData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);

  // 1. Fetch Data
  useEffect(() => {
    const hasPermission = userData?.role === 'admin' || userData?.permissions?.includes('reports') || userData?.permissions?.includes('ALL');
    if (!userData || !hasPermission) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const startTimestamp = Timestamp.fromDate(new Date(dateRange.start));
        const endTimestamp = Timestamp.fromDate(new Date(new Date(dateRange.end).setHours(23, 59, 59)));

        // Fetch Cars (Created in range)
        const carsQ = query(
          collection(db, "cars"),
          where("createdAt", ">=", startTimestamp),
          where("createdAt", "<=", endTimestamp),
          orderBy("createdAt", "desc")
        );

        // Fetch Logs (Activity in range)
        const logsQ = query(
          collection(db, "logs"),
          where("timestamp", ">=", startTimestamp),
          where("timestamp", "<=", endTimestamp)
        );

        // Fetch Users
        const usersQ = query(collection(db, "users"));

        const [carsSnap, logsSnap, usersSnap] = await Promise.all([
          getDocs(carsQ),
          getDocs(logsQ),
          getDocs(usersQ)
        ]);

        setCars(carsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CarData)));
        setLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LogData)));
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserData)));

      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, userData]);

  // --- Derived Metrics ---

  const kpiStats = useMemo(() => {
    const totalStock = cars.length;
    const delivered = cars.filter(c => c.currentStatus === 'DELIVERED').length;
    const processing = cars.filter(c => !['DELIVERED', 'SHOWROOM'].includes(c.currentStatus)).length; // Transit/Excise

    // Efficiency: Avg days to deliver (approx from logs if possible, else simplified)
    // Here simplifying to: Deliveries this month
    const currentMonth = new Date().getMonth();
    const deliveriesThisMonth = cars.filter(c =>
      c.currentStatus === 'DELIVERED' &&
      c.createdAt.toDate().getMonth() === currentMonth
    ).length;

    return { totalStock, delivered, processing, deliveriesThisMonth };
  }, [cars]);

  // Inventory Intelligence
  const brandDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    cars.forEach(c => { counts[c.brandName] = (counts[c.brandName] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [cars]);

  const agingAnalysis = useMemo(() => {
    const today = new Date().getTime();
    return cars
      .filter(c => c.currentStatus === 'SHOWROOM')
      .map(c => ({
        ...c,
        age: Math.floor((today - c.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => b.age - a.age)
      .slice(0, 8);
  }, [cars]);

  // Operational Efficiency
  const operationFunnel = useMemo(() => {
    const platesPrinting = cars.filter(c => c.plateStatus === 'Plates Printing in Process').length;
    const platesReady = cars.filter(c => c.plateStatus === 'Ready for Collection').length;
    const platesCollected = cars.filter(c => c.plateStatus === 'Collected by Showroom').length;
    const platesDelivered = cars.filter(c => c.plateStatus?.toLowerCase().includes('delivered')).length;

    return [
      { name: 'Printing', value: platesPrinting, fill: COLORS.warning },
      { name: 'Ready', value: platesReady, fill: COLORS.primary },
      { name: 'Collected', value: platesCollected, fill: COLORS.purple },
      { name: 'Delivered', value: platesDelivered, fill: COLORS.success }, // Plate Delivery
    ];
  }, [cars]);

  const docStats = useMemo(() => {
    return [
      { name: 'Showroom', value: cars.filter(c => c.fileStatus === 'Showroom').length },
      { name: 'At Excise', value: cars.filter(c => c.fileStatus === 'At Excise').length },
      { name: 'Delivered', value: cars.filter(c => c.fileStatus?.toLowerCase().includes('delivered')).length },
    ];
  }, [cars]);

  // Team Performance
  const teamActivity = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      counts[log.performedBy] = (counts[log.performedBy] || 0) + 1;
    });

    return Object.entries(counts).map(([uid, count]) => {
      const user = users.find(u => u.id === uid);
      return {
        name: user?.name || 'Unknown',
        role: user?.role || 'Staff',
        actions: count,
        deliveries: logs.filter(l => l.performedBy === uid && l.type === 'DELIVERY').length
      };
    }).sort((a, b) => b.actions - a.actions);
  }, [logs, users]);


  if (!userData) return null;

  return (
    <div className="space-y-8 p-6 pb-20 bg-muted/50 min-h-full">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-6 border-b border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground">Executive Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">High-level view of operations and performance.</p>
        </div>
        <div className="flex bg-card p-1.5 rounded-xl border border-border shadow-sm gap-2">
          <Input
            type="date"
            className="h-9 w-36 text-xs border-0 bg-muted focus-visible:ring-0"
            value={dateRange.start}
            onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          />
          <span className="self-center text-muted-foreground">to</span>
          <Input
            type="date"
            className="h-9 w-36 text-xs border-0 bg-muted focus-visible:ring-0"
            value={dateRange.end}
            onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-10 animate-in fade-in duration-500">

          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard title="Total Inventory" value={kpiStats.totalStock} icon={CarFront} colorClass="bg-muted text-primary border-border" />
            <StatsCard title="Completed Deliveries" value={kpiStats.delivered} icon={CheckCircle2} colorClass="bg-emerald-50 text-primary border-border" />
            <StatsCard title="Pending Operations" value={kpiStats.processing} icon={Activity} colorClass="bg-muted text-secondary border-border" />
            <StatsCard title="New Leads (Month)" value={12} icon={TrendingUp} colorClass="bg-muted text-primary border-border" /> {/* Placeholder/Calculated */}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Trend Chart */}
            <Card className="lg:col-span-2 shadow-sm border-border">
              <CardHeader>
                <CardTitle>Registration Trends</CardTitle>
                <CardDescription>Daily vehicle intake volume over selected period</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={Object.entries(cars.reduce((acc: any, car) => {
                    const d = car.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    acc[d] = (acc[d] || 0) + 1;
                    return acc;
                  }, {})).map(([date, count]) => ({ date, count }))}>
                    <defs>
                      <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quick Actions / Alerts */}
            <div className="space-y-6">
              <Card className="shadow-sm border-border h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="text-red-500" size={20} />
                    Critical Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {agingAnalysis.filter(c => c.age > 45).length > 0 ? (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                      <div>
                        <h4 className="font-bold text-red-900 text-sm">{agingAnalysis.filter(c => c.age > 45).length} Vehicles Overdue</h4>
                        <p className="text-xs text-red-700 mt-1">Inventory aging exceeds 45 days. Review pricing or marketing.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3">
                      <CheckCircle2 className="text-green-600" size={18} />
                      <p className="text-sm text-green-800 font-medium">Inventory Health is Good</p>
                    </div>
                  )}

                  <div className="p-4 bg-muted border border-border rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Document Processing</span>
                      <Badge variant="outline">{docStats.find(d => d.name === 'At Excise')?.value || 0} Pending</Badge>
                    </div>
                    <div className="w-full border-border rounded-full h-2">
                      <div className="bg-orange-400 h-2 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
      </div>
    </div>
  );
};