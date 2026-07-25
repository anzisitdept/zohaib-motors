import { PurchaseInvoicesList } from "@/features/invoices/PurchaseInvoicesList";
import { PageHeader } from "@/components/shared/PageHeader";

export default function PurchaseInvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Purchase Invoices List" 
        description="View, search, and analyze all purchase invoices generated for stock vehicles." 
      />
      <PurchaseInvoicesList />
    </div>
  );
}
