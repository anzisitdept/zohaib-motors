"use client";
import { useState, useEffect, use } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

export default function PrintProfitDistributionReport({ params }: { params: Promise<{ month: string }> }) {
  const { month } = use(params);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        if (!month) return;
        const [yearStr, monthStr] = month.split("-");
        const monthName = new Date(Number(yearStr), Number(monthStr) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

        // 1. Fetch Cars sold in this month
        const carsQuery = query(collection(db, "cars"), where("isSold", "==", true));
        const carsSnap = await getDocs(carsQuery);
        const cars = carsSnap.docs
          .map(d => ({ id: d.id, ...d.data() as any }))
          .filter(c => c.saleDate && c.saleDate.substring(0, 7) === month);

        // 2. Fetch Accounts to find Expenses
        const accountsSnap = await getDocs(collection(db, "accounts"));
        const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const expenseAccs = new Set(
          accounts.filter((a: any) => (a.typeName || "").toLowerCase().includes("expense") || (a.typeName || "").toLowerCase().includes("refreshment")).map(a => a.id)
        );

        // 3. Fetch Vouchers
        const startStr = `${month}-01`;
        const endStr = `${month}-31`;

        const expensesByAccount: Record<string, any[]> = {};
        const addExpenseVoucher = (accountName: string, voucherData: any) => {
          if (!expensesByAccount[accountName]) expensesByAccount[accountName] = [];
          expensesByAccount[accountName].push(voucherData);
        };

        const vQuery = query(collection(db, "vouchers"), where("date", ">=", startStr), where("date", "<=", endStr));
        const vSnap = await getDocs(vQuery);
        vSnap.forEach(d => {
          const v = d.data();
          if (expenseAccs.has(v.cashAccountId || v.accountId) && (v.cashType || v.type) === "debit") {
            addExpenseVoucher(v.cashAccountName || v.accountName || "Unknown Expense", { desc: v.description, amount: v.amount, no: v.voucherNo, date: v.date });
          }
          if (v.counterAccountId && expenseAccs.has(v.counterAccountId) && v.counterType === "debit") {
            addExpenseVoucher(v.counterAccountName || "Unknown Expense", { desc: v.description, amount: v.amount, no: v.voucherNo, date: v.date });
          }
        });

        const jvQuery = query(collection(db, "general-vouchers"), where("date", ">=", startStr), where("date", "<=", endStr));
        const jvSnap = await getDocs(jvQuery);
        jvSnap.forEach(d => {
          const v = d.data();
          if (expenseAccs.has(v.toAccountId)) {
            addExpenseVoucher(v.toAccountName || "Unknown Expense", { desc: v.description, amount: v.amount, no: v.voucherNo, date: v.date });
          }
        });

        // Calculate Totals
        const totalRevenue = cars.reduce((sum, c) => sum + Number(c.salePrice || 0), 0);
        const totalCOGS = cars.reduce((sum, c) => sum + Number(c.capitalizedCost || 0), 0);
        const grossProfit = cars.reduce((sum, c) => sum + Number(c.netProfit ?? (Number(c.salePrice || 0) - Number(c.capitalizedCost || 0) - Number(c.commissionPaid || 0))), 0);
        
        let totalExpensesAmount = 0;
        Object.values(expensesByAccount).forEach(list => {
          totalExpensesAmount += list.reduce((sum, item) => sum + item.amount, 0);
        });

        const netProfit = grossProfit - totalExpensesAmount;

        setReportData({
          monthName,
          cars,
          expensesByAccount,
          totalRevenue,
          totalCOGS,
          grossProfit,
          totalExpensesAmount,
          netProfit,
        });

      } catch (err) {
        console.error("Failed to load report", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReportData();
  }, [month]);

  useEffect(() => {
    if (!loading && reportData) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, reportData]);

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline mr-2" /> Generating Report...</div>;
  if (!reportData) return <div className="p-8 text-center text-red-600">Failed to load report data.</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 print:p-0 print:max-w-none bg-white text-black min-h-screen">
      <div className="text-center mb-8 border-b-2 border-black pb-6">
        <h1 className="text-3xl font-black uppercase tracking-widest mb-1">Profit Distribution Report</h1>
        <p className="text-lg font-bold text-gray-600">Month: {reportData.monthName}</p>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-black border-b border-black uppercase pb-1 mb-3 bg-gray-100 p-2">Vehicles Included</h2>
        {reportData.cars.length === 0 ? (
          <p className="text-sm text-gray-500 italic px-2">No vehicles sold this month.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 px-2 font-bold uppercase">Vehicle</th>
                <th className="text-right py-2 px-2 font-bold uppercase">Cost (COGS)</th>
                <th className="text-right py-2 px-2 font-bold uppercase">Sale Price</th>
                <th className="text-right py-2 px-2 font-bold uppercase">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reportData.cars.map((car: any) => (
                <tr key={car.id}>
                  <td className="py-2 px-2 font-semibold">{car.brandName} {car.model} ({car.year})</td>
                  <td className="py-2 px-2 text-right">Rs. {Number(car.capitalizedCost || 0).toLocaleString()}</td>
                  <td className="py-2 px-2 text-right">Rs. {Number(car.salePrice || 0).toLocaleString()}</td>
                  <td className="py-2 px-2 text-right font-bold text-green-700">Rs. {Number(car.netProfit ?? (Number(car.salePrice || 0) - Number(car.capitalizedCost || 0) - Number(car.commissionPaid || 0))).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-black border-b border-black uppercase pb-1 mb-3 bg-gray-100 p-2">Expenses</h2>
        {Object.keys(reportData.expensesByAccount).length === 0 ? (
          <p className="text-sm text-gray-500 italic px-2">No expenses recorded this month.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(reportData.expensesByAccount).map(([accName, vouchers]: [string, any]) => {
              const subtotal = vouchers.reduce((sum: number, v: any) => sum + v.amount, 0);
              return (
                <div key={accName} className="px-2">
                  <h3 className="font-bold text-gray-800 uppercase mb-2 flex justify-between">
                    <span>{accName}</span>
                    <span>Rs. {subtotal.toLocaleString()}</span>
                  </h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="text-left py-1 w-24">Date</th>
                        <th className="text-left py-1 w-24">Voucher No</th>
                        <th className="text-left py-1">Description</th>
                        <th className="text-right py-1 w-32">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {vouchers.map((v: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-1.5">{v.date}</td>
                          <td className="py-1.5 font-mono">{v.no}</td>
                          <td className="py-1.5 truncate max-w-xs">{v.desc || "-"}</td>
                          <td className="py-1.5 text-right font-semibold">Rs. {v.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-2 border-black p-4 mt-8">
        <h2 className="text-lg font-black uppercase mb-4 text-center">Summary of Month</h2>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm max-w-xl mx-auto">
          <div className="flex justify-between">
            <span className="font-bold">Total Revenue:</span>
            <span>Rs. {reportData.totalRevenue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">Total COGS:</span>
            <span>Rs. {reportData.totalCOGS.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-green-700">
            <span className="font-bold">Gross Vehicle Profit:</span>
            <span className="font-bold">Rs. {reportData.grossProfit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span className="font-bold">Total Expenses:</span>
            <span className="font-bold">-Rs. {reportData.totalExpensesAmount.toLocaleString()}</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-black text-center">
          <p className="text-sm font-bold uppercase tracking-wider mb-1">Net Distributable Profit</p>
          <p className="text-3xl font-black">Rs. {reportData.netProfit.toLocaleString()}</p>
        </div>
      </div>
      
      <div className="mt-12 text-center text-xs text-gray-400 print:block">
        Generated by Zohaib Motors Management System · {new Date().toLocaleString()}
      </div>
    </div>
  );
}
