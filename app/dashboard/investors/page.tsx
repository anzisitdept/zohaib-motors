import { InvestorManager } from "@/features/investors/InvestorManager";
import { PageHeader } from "@/components/shared/PageHeader";

export default function InvestorsPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Investor Management" 
        description="Manage investors database and signatures." 
      />
      <InvestorManager />
    </div>
  );
}
