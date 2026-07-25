import { useState } from "react";
import { Download, Search, FileDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Column {
  header: string;
  accessorKey: string;
  cell?: (item: any) => React.ReactNode;
}

interface ReportTableProps {
  title: string;
  description?: string;
  data: any[];
  columns: Column[];
  searchable?: boolean;
}

export const ReportTable = ({ title, description, data, columns, searchable = true }: ReportTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = data.filter(item => 
    Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const exportToCSV = () => {
    if (data.length === 0) return;
    
    // Headers
    const headers = columns.map(c => c.header).join(",");
    
    // Rows
    const rows = filteredData.map(item => {
      return columns.map(col => {
        const val = item[col.accessorKey];
        // Escape quotes and wrap in quotes to handle commas
        if (val === null || val === undefined) return '""';
        const strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
      }).join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.replace(/\s+/g, "_").toLowerCase()}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
      {/* Header Area */}
      <div className="p-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/50">
        <div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {searchable && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search report..."
                className="pl-9 h-9 text-sm bg-card"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
          <Button variant="outline" size="sm" onClick={exportToCSV} className="h-9 whitespace-nowrap bg-card">
            <FileDown size={16} className="mr-2 text-muted-foreground" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground border-b border-border">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className="px-5 py-3 font-medium whitespace-nowrap">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.length > 0 ? (
              filteredData.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-muted/50 transition-colors">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="px-5 py-3 text-foreground">
                      {col.cell ? col.cell(row) : (row[col.accessorKey] || "-")}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-5 py-8 text-center text-muted-foreground">
                  No data found for this report.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Footer / Summary */}
      <div className="p-3 border-t border-border bg-muted text-xs text-muted-foreground flex justify-between">
        <span>Showing {filteredData.length} records</span>
      </div>
    </div>
  );
};
