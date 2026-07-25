import { ClientManager } from "@/features/clients/ClientManager";
import { PageHeader } from "@/components/shared/PageHeader";

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Client Management" 
        description="Manage customer database for vehicle registration." 
      />
      <ClientManager />
    </div>
  );
}