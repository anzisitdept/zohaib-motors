import { AccountsManager } from "@/features/accounts/AccountsManager";
import { PageHeader } from "@/components/shared/PageHeader";

export default function AccountsPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Accounts Manager" 
        description="Create and manage your accounts, view balances, and associate account types." 
      />
      <AccountsManager />
    </div>
  );
}
