// app/dashboard/users/page.tsx
import { UserManagement } from "@/features/users/UserManagement";
import { PageHeader } from "@/components/shared/PageHeader";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="User Management" 
        description="Manage staff access and create new accounts." 
      />
      <UserManagement />
    </div>
  );
}