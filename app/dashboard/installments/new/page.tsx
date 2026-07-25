import { InstallmentPlanForm } from "@/features/installments/InstallmentPlanForm";

export const metadata = {
  title: "New Installment Plan | Zohaib Motors",
  description: "Create a new installment plan for a vehicle sale.",
};

export default function NewInstallmentPlanPage() {
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">New Installment Plan</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure a structured payment contract and link automated email notifications.</p>
      </div>

      <InstallmentPlanForm />
    </div>
  );
}
