import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  colorClass: string;
}

export const StatsCard = ({ title, value, icon: Icon, colorClass }: StatsCardProps) => (
  <Card className="p-6">
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-full ${colorClass}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <h3 className="text-2xl font-bold">{value}</h3>
      </div>
    </div>
  </Card>
);
