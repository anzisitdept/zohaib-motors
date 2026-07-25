import { InventoryManager } from "@/features/inventory/InventoryManager";
import { PageHeader } from "@/components/shared/PageHeader";

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Vehicle Inventory" 
        description="View and edit details of all registered vehicles." 
      />
      <InventoryManager />
    </div>
  );
}