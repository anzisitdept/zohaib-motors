import { StatusTable } from "@/features/status/StatusTable";
import { PageHeader } from "@/components/shared/PageHeader";

export default function StatusPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Status Management" 
        description="Track and update vehicle statuses in real-time." 
      />
      <StatusTable />
    </div>
  );
}