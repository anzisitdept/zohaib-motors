import { RegistryForm } from "@/features/registry/RegistryForm";
import { PageHeader } from "@/components/shared/PageHeader";

export default function RegistryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Car Registry" description="Register new vehicles into the system." />
      <RegistryForm />
    </div>
  );
}