"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
	segmentLabel?: string;
}

export function DashboardError({ error, reset, segmentLabel }: DashboardErrorProps) {
	useEffect(() => {
		console.error("Dashboard segment error:", error);
	}, [error]);

	const isDev = process.env.NODE_ENV !== "production";

	return (
		<div className="flex flex-col space-y-4 p-4">
			<Card className="border-destructive/40 bg-destructive/5">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-destructive">
						<AlertTriangle className="size-5" aria-hidden="true" />
						<span>Something went wrong</span>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-sm">
					{segmentLabel ? (
						<p className="text-muted-foreground">
							An unexpected error occurred while loading{" "}
							<span className="font-medium text-foreground">{segmentLabel}</span>.
						</p>
					) : (
						<p className="text-muted-foreground">
							An unexpected error occurred while loading this page.
						</p>
					)}
					{isDev && error?.message ? (
						<pre className="overflow-auto rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
							{error.message}
							{error.digest ? `\n\ndigest: ${error.digest}` : ""}
						</pre>
					) : null}
					<div className="flex flex-wrap gap-2 pt-2">
						<Button onClick={() => reset()} variant="default">
							Try again
						</Button>
						<Button asChild variant="outline">
							<Link href="/dashboard">Go to dashboard</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
