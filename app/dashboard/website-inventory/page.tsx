import { WebsiteInventoryManager } from "@/features/website-inventory/WebsiteInventoryManager";
import { PageHeader } from "@/components/shared/PageHeader";

export default function WebsiteInventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Website Inventory" 
        description="Manage vehicle inventory published to the public website (Purchase Registry)." 
      />
      <WebsiteInventoryManager />
    </div>
  );
}
