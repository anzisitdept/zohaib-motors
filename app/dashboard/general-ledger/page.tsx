import { GeneralLedgerManager } from "@/features/general-ledger/GeneralLedgerManager";
import { PageHeader } from "@/components/shared/PageHeader";

export default function GeneralLedgerPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="General Ledger" 
        description="Query, audit, and print full debit/credit histories and running balances for any account." 
      />
      <GeneralLedgerManager />
    </div>
  );
}
