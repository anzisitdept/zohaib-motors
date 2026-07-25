import { GeneralVoucherManager } from "@/features/general-voucher/GeneralVoucherManager";
import { PageHeader } from "@/components/shared/PageHeader";

export default function GeneralVoucherPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="General Voucher Manager" 
        description="Generate, review, and print general journal transaction vouchers to transfer balances between accounts." 
      />
      <GeneralVoucherManager />
    </div>
  );
}
