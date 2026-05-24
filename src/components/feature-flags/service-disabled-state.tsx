import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	CoreServiceKey,
	getCoreServiceDisabledMessage,
	getCoreServiceTitle,
} from "@/lib/feature-flags";

export function ServiceDisabledState({ service }: { service: CoreServiceKey }) {
	return (
		<div className="flex flex-col space-y-4 p-4">
			<h1 className="text-2xl font-semibold">{getCoreServiceTitle(service)}</h1>
			<Card className="bg-muted/40">
				<CardHeader>
					<CardTitle>Service unavailable</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-muted-foreground">
					<p>{getCoreServiceDisabledMessage(service)}</p>
					<p>
						Update{" "}
						<code className="rounded bg-muted px-1 py-0.5">CORE_SERVICE_FLAGS.{service}</code> in{" "}
						<code className="rounded bg-muted px-1 py-0.5">src/lib/feature-flags.ts</code> to
						restore this service.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
