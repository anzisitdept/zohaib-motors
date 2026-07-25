import { AccountTypesManager } from "@/features/account-types/AccountTypesManager";
import { PageHeader } from "@/components/shared/PageHeader";

export default function AccountTypesPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Account Types" 
        description="Configure account categories like Cash in hand, Bank, and Investors." 
      />
      <AccountTypesManager />
    </div>
  );
}
