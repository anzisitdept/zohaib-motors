import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

export default function WebsiteSaleRequestsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sale Requests"
        description="View and manage sale requests received through the website."
      />
      <Card className="border-dashed border-2 border-border">
        <CardContent className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-4">
          <Newspaper size={48} className="opacity-30" />
          <p className="text-base font-medium">No sale requests yet</p>
          <p className="text-sm text-center max-w-sm">
            Sale requests submitted via the website will appear here once this feature is connected.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
