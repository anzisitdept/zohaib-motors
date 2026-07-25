import React, { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    description: string;
    action?: ReactNode;
}

export const PageHeader = ({ title, description, action }: PageHeaderProps) => (
  <div className="flex items-center justify-between mb-8">
    <div className="space-y-1">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {action && <div>{action}</div>}
  </div>
);