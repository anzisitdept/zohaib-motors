import { PurchaseInventoryList } from "@/features/inventory/PurchaseInventoryList";
import { PageHeader } from "@/components/shared/PageHeader";

export default function PurchaseInventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Purchase Inventory" 
        description="Detailed list of stock vehicles, showing purchase price, total expenses, and capitalized asset values." 
      />
      <PurchaseInventoryList />
    </div>
  );
}
