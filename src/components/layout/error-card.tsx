import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorCardProps {
  error: string;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
}

export function ErrorCard({ error, onRetry, backHref, backLabel }: ErrorCardProps) {
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="flex flex-col items-center gap-4 p-6">
        <p className="text-destructive font-medium text-center">{error}</p>
        <div className="flex gap-2">
          {onRetry && (
            <Button onClick={onRetry} variant="default">
              Try again
            </Button>
          )}
          {backHref && (
            <Button asChild variant="outline">
              <Link href={backHref}>{backLabel || "Go back"}</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
