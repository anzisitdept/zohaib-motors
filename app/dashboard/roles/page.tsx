import { RoleManagement } from "@/features/roles/RoleManagement";
import { PageHeader } from "@/components/shared/PageHeader";

export default function RolesPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Role Management"
                description="Define roles and assign page access permissions."
            />
            <RoleManagement />
        </div>
    );
}
