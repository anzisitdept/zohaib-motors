import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function WebsiteInquiriesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Website Inquiries"
        description="View and manage all inquiries submitted through the website."
      />
      <Card className="border-dashed border-2 border-border">
        <CardContent className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-4">
          <MessageSquare size={48} className="opacity-30" />
          <p className="text-base font-medium">No inquiries yet</p>
          <p className="text-sm text-center max-w-sm">
            Website inquiries submitted by customers will appear here once this feature is connected.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
