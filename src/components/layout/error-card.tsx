import Link from "next/link";
import { AlertTriangle } from "lucide-react";
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
			<CardContent className="flex flex-col items-center gap-4 py-12 px-6 min-h-[200px]">
				<span className="mb-2 animate-[fade-in-up_0.3s_ease-out_0.05s_both]">
					<AlertTriangle className="h-10 w-10 text-destructive animate-pulse" />
				</span>
				<p className="text-destructive font-medium text-center animate-[fade-in-up_0.3s_ease-out_0.1s_both]">
					{error}
				</p>
				<div className="flex gap-2 animate-[fade-in-up_0.3s_ease-out_0.15s_both]">
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
