import { Suspense } from "react";
import { PurchaseInvoiceManager } from "@/features/invoices/PurchaseInvoiceManager";

export default function PurchaseInvoicePage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Purchase Invoice</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a purchase invoice by selecting a registered vehicle and entering financial details.
        </p>
      </div>
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading...</div>}>
        <PurchaseInvoiceManager />
      </Suspense>
    </div>
  );
}
