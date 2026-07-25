import { SaleInvoiceManager } from "@/features/invoices/SaleInvoiceManager";

export default function SaleInvoicePage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Sale Invoice</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a sale invoice for an available vehicle. Only vehicles with a purchase invoice are listed.
        </p>
      </div>
      <SaleInvoiceManager />
    </div>
  );
}
