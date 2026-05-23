import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-muted/40">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        {Icon && <Icon className="h-10 w-10 text-muted-foreground/50 mb-4" />}
        <p className="text-lg text-muted-foreground mb-2">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}
