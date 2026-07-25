"use client";
import { useState, useRef } from "react";
import {
  collection, getDocs, query, where, orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Printer, Scale, Calendar, TrendingDown, TrendingUp, Download } from "lucide-react";

interface Account {
  id: string;
  name: string;
  typeName: string;
  balance: number;
}

interface BalanceGroup {
  typeName: string;
  accounts: { no: number; name: string; debit: number; credit: number }[];
  totalDebit: number;
  totalCredit: number;
}

// Account type display order (matching the sample report)
const TYPE_ORDER = [
  "Bank", "Capital", "Cash", "Customer", "Friends Lone", "Vendor",
  "Dealers", "Deposits", "Staff", "Currency", "Investors", "Liabilities",
  "Property", "Temporary Accounts", "Brokers", "Un Registered Import Cars",
  "Fixed Assets", "Import Accounts", "Zero Cars Booking", "Ammars Share Exp",
  "Profit Partner Ship", "Stock"
];

function normalizeTypeName(name: string): string {
  const lower = name?.toLowerCase() || "other";
  const map: Record<string, string> = {
    "bank": "Bank",
    "capital": "Capital",
    "cash": "Cash",
    "customer": "Customer",
    "friends lone": "Friends Lone",
    "vendor": "Vendor",
    "dealers": "Dealers",
    "deposits": "Deposits",
    "staff": "Staff",
    "currency": "Currency",
    "investor": "Investors",
    "investors": "Investors",
    "liabilities": "Liabilities",
    "property": "Property",
    "temporary accounts": "Temporary Accounts",
    "brokers": "Brokers",
    "un registered import cars": "Un Registered Import Cars",
    "fixed assets": "Fixed Assets",
    "import accounts": "Import Accounts",
    "zero cars booking": "Zero Cars Booking",
    "ammars share exp": "Ammars Share Exp",
    "profit partner ship": "Profit Partner Ship",
    "stock": "Stock",
  };
  return map[lower] || (name ? name.charAt(0).toUpperCase() + name.slice(1) : "Other");
}

const fmtNum = (n: number) =>
  n > 0 ? n.toLocaleString("en-PK", { maximumFractionDigits: 0 }) : "";

export const BalanceSheetReport = () => {
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [groups, setGroups] = useState<BalanceGroup[]>([]);
  const [generated, setGenerated] = useState(false);
  const [stockValue, setStockValue] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  const generateReport = async () => {
    setLoading(true);
    setGenerated(false);

    try {
      // Fetch all accounts
      const accountsSnap = await getDocs(query(collection(db, "accounts"), orderBy("name")));
      let allAccounts: Account[] = accountsSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        typeName: d.data().typeName || "Other",
        balance: d.data().balance || 0,
      }));

      // Filter out all accounts with zero balance
      allAccounts = allAccounts.filter(acc => acc.balance !== 0);

      // Get stock value — sum inventory items that are In Stock
      let totalStock = 0;
      try {
        const inventorySnap = await getDocs(
          query(collection(db, "inventory"), where("currentStatus", "in", ["In Stock", "Available", "in_stock"]))
        );
        inventorySnap.docs.forEach(d => {
          const data = d.data();
          totalStock += (data.purchasePrice || data.price || data.costPrice || 0);
        });
      } catch (e) {
        console.warn("Could not fetch inventory stock:", e);
      }
      setStockValue(totalStock);

      // Sort accounts by type order, then alphabetically
      const sortedAccounts = [...allAccounts].sort((a, b) => {
        const aNorm = normalizeTypeName(a.typeName);
        const bNorm = normalizeTypeName(b.typeName);
        const aIdx = TYPE_ORDER.indexOf(aNorm);
        const bIdx = TYPE_ORDER.indexOf(bNorm);
        if (aIdx !== bIdx) return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        return a.name.localeCompare(b.name);
      });

      // Group accounts
      const groupMap = new Map<string, { no: number; name: string; debit: number; credit: number }[]>();
      let globalNo = 1;
      for (const acc of sortedAccounts) {
        const typeName = normalizeTypeName(acc.typeName);
        if (!groupMap.has(typeName)) groupMap.set(typeName, []);
        groupMap.get(typeName)!.push({
          no: globalNo++,
          name: acc.name,
          debit: acc.balance > 0 ? acc.balance : 0,
          credit: acc.balance < 0 ? Math.abs(acc.balance) : 0,
        });
      }

      // Build ordered groups
      const result: BalanceGroup[] = [];
      for (const typeName of TYPE_ORDER) {
        const items = groupMap.get(typeName);
        if (items && items.length > 0) {
          result.push({
            typeName,
            accounts: items,
            totalDebit: items.reduce((s, a) => s + a.debit, 0),
            totalCredit: items.reduce((s, a) => s + a.credit, 0),
          });
          groupMap.delete(typeName);
        }
      }
      for (const [typeName, items] of groupMap.entries()) {
        if (items.length > 0) {
          result.push({
            typeName,
            accounts: items,
            totalDebit: items.reduce((s, a) => s + a.debit, 0),
            totalCredit: items.reduce((s, a) => s + a.credit, 0),
          });
        }
      }

      setGroups(result);
      setGenerated(true);
    } catch (error) {
      console.error("Error generating balance sheet:", error);
      alert("Failed to generate balance sheet. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!generated || groups.length === 0) return;
    setPdfLoading(true);

    try {
      // Dynamic import so jspdf only loads when needed
      const jsPDFModule = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const jsPDF = jsPDFModule.default;
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const dateLabel = new Date(asOfDate + "T00:00:00").toLocaleDateString("en-PK", {
        day: "numeric", month: "long", year: "numeric"
      });
      const generatedOn = new Date().toLocaleString("en-PK");

      // ── Header ──────────────────────────────────────────────────────────
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Zohaib Motors Accounts", pageWidth / 2, 11, { align: "center" });

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Balance Sheet", pageWidth / 2, 18, { align: "center" });

      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text(`As of ${dateLabel}`, pageWidth / 2, 24, { align: "center" });

      // ── Build table body ─────────────────────────────────────────────────
      const grandTotalDebit = groups.reduce((s, g) => s + g.totalDebit, 0) + stockValue;
      const grandTotalCredit = groups.reduce((s, g) => s + g.totalCredit, 0);
      const netBalance = grandTotalDebit - grandTotalCredit;

      type RowType = (string | { content: string; styles?: Record<string, any> })[];
      const body: RowType[] = [];

      for (const group of groups) {
        // Group header row
        body.push([
          {
            content: group.typeName.toUpperCase(),
            colSpan: 4,
            styles: {
              fillColor: [30, 41, 59], // slate-800
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 9,
            }
          } as any
        ]);

        // Account rows
        for (const acc of group.accounts) {
          body.push([
            { content: String(acc.no), styles: { textColor: [148, 163, 184], fontSize: 8 } },
            { content: acc.name, styles: { fontStyle: "normal" } },
            { content: fmtNum(acc.debit), styles: { halign: "right", textColor: acc.debit > 0 ? [220, 38, 38] : [156, 163, 175] } },
            { content: fmtNum(acc.credit), styles: { halign: "right", textColor: acc.credit > 0 ? [5, 150, 105] : [156, 163, 175] } },
          ] as any);
        }

        // Group total row
        body.push([
          { content: "", styles: { fillColor: [241, 245, 249] } },
          {
            content: `TOTAL — ${group.typeName}`,
            styles: { fillColor: [241, 245, 249], fontStyle: "bold", textColor: [71, 85, 105], fontSize: 8 }
          },
          {
            content: fmtNum(group.totalDebit),
            styles: { halign: "right", fillColor: [241, 245, 249], fontStyle: "bold", textColor: [220, 38, 38] }
          },
          {
            content: fmtNum(group.totalCredit),
            styles: { halign: "right", fillColor: [241, 245, 249], fontStyle: "bold", textColor: [5, 150, 105] }
          },
        ] as any);

        // Spacer row
        body.push([{ content: "", colSpan: 4, styles: { fillColor: [255, 255, 255], minCellHeight: 2 } } as any]);
      }

      // Stock row (if any)
      if (stockValue > 0) {
        body.push([
          { content: "STOCK", colSpan: 4, styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 } } as any
        ]);
        body.push([
          { content: "", styles: {} },
          { content: "Current Stock", styles: { fontStyle: "normal" } },
          {
            content: stockValue.toLocaleString("en-PK", { maximumFractionDigits: 0 }),
            styles: { halign: "right", textColor: [220, 38, 38], fontStyle: "bold" }
          },
          { content: "", styles: {} },
        ] as any);
        body.push([{ content: "", colSpan: 4, styles: { fillColor: [255, 255, 255], minCellHeight: 2 } } as any]);
      }

      // Grand Total row
      body.push([
        {
          content: "GRAND TOTAL",
          colSpan: 2,
          styles: {
            fillColor: [15, 23, 42], textColor: [255, 255, 255],
            fontStyle: "bold", fontSize: 10
          }
        } as any,
        {
          content: grandTotalDebit.toLocaleString("en-PK", { maximumFractionDigits: 0 }),
          styles: {
            halign: "right", fillColor: [15, 23, 42],
            textColor: [252, 165, 165], fontStyle: "bold", fontSize: 10
          }
        },
        {
          content: grandTotalCredit.toLocaleString("en-PK", { maximumFractionDigits: 0 }),
          styles: {
            halign: "right", fillColor: [15, 23, 42],
            textColor: [110, 231, 183], fontStyle: "bold", fontSize: 10
          }
        },
      ] as any);

      // Net Balance row
      const balanceFill = netBalance >= 0 ? [254, 242, 242] : [236, 253, 245];
      const balanceColor = netBalance >= 0 ? [185, 28, 28] : [4, 120, 87];
      body.push([
        {
          content: `Balance ${netBalance >= 0 ? "(Dr)" : "(Cr)"}`,
          colSpan: 2,
          styles: { fillColor: balanceFill, textColor: balanceColor, fontStyle: "bold", fontSize: 10 }
        } as any,
        {
          content: netBalance >= 0 ? Math.abs(netBalance).toLocaleString("en-PK", { maximumFractionDigits: 0 }) : "",
          styles: { halign: "right", fillColor: balanceFill, textColor: balanceColor, fontStyle: "bold", fontSize: 10 }
        },
        {
          content: netBalance < 0 ? Math.abs(netBalance).toLocaleString("en-PK", { maximumFractionDigits: 0 }) : "",
          styles: { halign: "right", fillColor: balanceFill, textColor: balanceColor, fontStyle: "bold", fontSize: 10 }
        },
      ] as any);

      // ── Render table ──────────────────────────────────────────────────────
      autoTable(doc, {
        startY: 32,
        head: [[
          { content: "No", styles: { halign: "center" } },
          { content: "Narration" },
          { content: "Debit", styles: { halign: "right" } },
          { content: "Credit", styles: { halign: "right" } },
        ]],
        body,
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 38, halign: "right" },
          3: { cellWidth: 38, halign: "right" },
        },
        headStyles: {
          fillColor: [51, 65, 85], // slate-700
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
          lineWidth: 0,
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252], // slate-50
        },
        margin: { top: 32, left: 10, right: 10 },
        tableLineWidth: 0,
        // Page break: add header on each new page
        didDrawPage: (data: any) => {
          const pageNum = (doc as any).internal.getNumberOfPages();
          if (data.pageNumber > 1) {
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageWidth, 14, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("Zohaib Motors Accounts — Balance Sheet (continued)", pageWidth / 2, 6, { align: "center" });
            doc.setFont("helvetica", "normal");
            doc.setTextColor(203, 213, 225);
            doc.text(`As of ${dateLabel}`, pageWidth / 2, 11, { align: "center" });
          }

          // Footer on every page
          const pageHeight = doc.internal.pageSize.getHeight();
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.setFont("helvetica", "normal");
          doc.text(`Generated: ${generatedOn}`, 10, pageHeight - 6);
          doc.text(
            `Page ${data.pageNumber}`,
            pageWidth - 10,
            pageHeight - 6,
            { align: "right" }
          );
        },
      });

      // Save
      const fileName = `Balance-Sheet-${asOfDate}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  const grandTotalDebit = groups.reduce((s, g) => s + g.totalDebit, 0) + stockValue;
  const grandTotalCredit = groups.reduce((s, g) => s + g.totalCredit, 0);
  const netBalance = grandTotalDebit - grandTotalCredit;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-2 uppercase tracking-wide">
              <Calendar size={12} /> Balance Sheet As Of
            </label>
            <Input
              type="date"
              value={asOfDate}
              onChange={e => setAsOfDate(e.target.value)}
              className="max-w-xs bg-card font-medium"
            />
          </div>

          <Button
            onClick={generateReport}
            disabled={loading || !asOfDate}
            className="bg-secondary hover:bg-secondary/90 text-white min-w-[160px]"
          >
            {loading ? (
              <><Loader2 size={16} className="mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Scale size={16} className="mr-2" /> Generate Report</>
            )}
          </Button>

          {generated && (
            <>
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="border-slate-300 hover:bg-muted min-w-[160px]"
              >
                {pdfLoading ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Building PDF...</>
                ) : (
                  <><Download size={16} className="mr-2" /> Download PDF</>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={handlePrint}
                className="text-muted-foreground hover:text-foreground print:hidden"
                title="Print"
              >
                <Printer size={16} className="mr-2" /> Print
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Report Table */}
      {generated && (
        <div
          ref={printRef}
          className="bg-card rounded-xl border border-border overflow-hidden print:border-0 print:shadow-none"
        >
          {/* Header */}
          <div className="text-center py-6 border-b border-border bg-slate-900">
            <h1 className="text-2xl font-bold text-white">Zohaib Motors Accounts</h1>
            <h2 className="text-base font-semibold text-muted-foreground mt-1">Balance Sheet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              As of {new Date(asOfDate + "T00:00:00").toLocaleDateString("en-PK", {
                day: "numeric", month: "long", year: "numeric"
              })}
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700 text-white text-xs font-bold uppercase tracking-wide">
                  <th className="px-4 py-3 text-left w-12">No</th>
                  <th className="px-4 py-3 text-left">Narration</th>
                  <th className="px-4 py-3 text-right w-40">Debit</th>
                  <th className="px-4 py-3 text-right w-40">Credit</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <>
                    {/* Group header */}
                    <tr key={`hdr-${group.typeName}`} className="bg-slate-800 text-white">
                      <td colSpan={4} className="px-4 py-2.5 font-bold text-sm tracking-wide">
                        {group.typeName}
                      </td>
                    </tr>

                    {/* Accounts */}
                    {group.accounts.map((acc, idx) => (
                      <tr
                        key={`acc-${acc.no}`}
                        className={idx % 2 === 0 ? "bg-card" : "bg-muted/60"}
                      >
                        <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">{acc.no}</td>
                        <td className="px-4 py-2.5 text-foreground font-medium">{acc.name}</td>
                        <td className="px-4 py-2.5 text-right text-red-600 font-semibold tabular-nums">
                          {fmtNum(acc.debit)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-primary font-semibold tabular-nums">
                          {fmtNum(acc.credit)}
                        </td>
                      </tr>
                    ))}

                    {/* Group total */}
                    <tr key={`tot-${group.typeName}`} className="bg-muted border-t border-b border-border font-bold">
                      <td colSpan={2} className="px-4 py-2.5 text-muted-foreground text-xs uppercase tracking-wide">
                        TOTAL — {group.typeName}
                      </td>
                      <td className="px-4 py-2.5 text-right text-red-600 tabular-nums">
                        {fmtNum(group.totalDebit)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-primary tabular-nums">
                        {fmtNum(group.totalCredit)}
                      </td>
                    </tr>
                    {/* Spacer */}
                    <tr key={`gap-${group.typeName}`}><td colSpan={4} className="h-2 bg-card" /></tr>
                  </>
                ))}

                {/* Stock */}
                {stockValue > 0 && (
                  <>
                    <tr className="bg-slate-800 text-white">
                      <td colSpan={4} className="px-4 py-2.5 font-bold text-sm tracking-wide">STOCK</td>
                    </tr>
                    <tr className="bg-card">
                      <td className="px-4 py-2.5 text-muted-foreground text-xs" />
                      <td className="px-4 py-2.5 text-foreground font-medium">Current Stock</td>
                      <td className="px-4 py-2.5 text-right text-red-600 font-semibold tabular-nums">
                        {stockValue.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-2.5" />
                    </tr>
                    <tr><td colSpan={4} className="h-2 bg-card" /></tr>
                  </>
                )}

                {/* Grand Total */}
                <tr className="bg-slate-900 text-white border-t-2 border-slate-600">
                  <td colSpan={2} className="px-4 py-3.5 font-black text-sm uppercase tracking-widest">
                    GRAND TOTAL
                  </td>
                  <td className="px-4 py-3.5 text-right font-black text-base tabular-nums text-red-300">
                    {grandTotalDebit.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3.5 text-right font-black text-base tabular-nums text-emerald-300">
                    {grandTotalCredit.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
                  </td>
                </tr>

                {/* Net Balance */}
                <tr className={`border-t-2 ${netBalance >= 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                  <td
                    colSpan={2}
                    className={`px-4 py-3.5 font-black text-sm flex items-center gap-2 ${netBalance >= 0 ? "text-red-800" : "text-emerald-800"}`}
                  >
                    {netBalance >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    Balance {netBalance >= 0 ? "(Dr)" : "(Cr)"}
                  </td>
                  <td className={`px-4 py-3.5 text-right font-black text-sm tabular-nums ${netBalance >= 0 ? "text-red-600" : "text-muted-foreground"}`}>
                    {netBalance >= 0 ? Math.abs(netBalance).toLocaleString("en-PK", { maximumFractionDigits: 0 }) : ""}
                  </td>
                  <td className={`px-4 py-3.5 text-right font-black text-sm tabular-nums ${netBalance < 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {netBalance < 0 ? Math.abs(netBalance).toLocaleString("en-PK", { maximumFractionDigits: 0 }) : ""}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="p-4 text-center text-xs text-muted-foreground border-t border-border">
            Generated on {new Date().toLocaleString("en-PK")} — Zohaib Motors Accounts
          </div>
        </div>
      )}

      {!generated && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Scale size={56} className="mb-4 text-slate-200" />
          <p className="font-medium text-muted-foreground text-lg">Select a date and click Generate Report</p>
          <p className="text-sm mt-1">The balance sheet will be grouped by account type</p>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          nav, header, aside, [data-print-hidden] { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};
