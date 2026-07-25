import { CashVoucherManager } from "@/features/cash-voucher/CashVoucherManager";
import { PageHeader } from "@/components/shared/PageHeader";

export default function CashVoucherPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Cash Voucher Manager" 
        description="Generate, review, and print cash debit/credit transaction vouchers." 
      />
      <CashVoucherManager />
    </div>
  );
}
