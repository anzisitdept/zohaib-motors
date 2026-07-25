import { BanksManager } from "@/features/banks/BanksManager";
import { PageHeader } from "@/components/shared/PageHeader";

export default function BanksPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Manage Banks & Specialized Accounts" 
        description="Create and manage bank accounts, investors, and clients with extended details." 
      />
      <BanksManager />
    </div>
  );
}
