import { FileCheck, CheckCircle, Users, Calculator } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GUIDE_PHASES } from "@/features/holiday-subsidy/utils/holiday-subsidy-guide-content";

const PHASE_ICONS = [FileCheck, CheckCircle, Users, Calculator];

export function GuideProcessOverview() {
	return (
		<Card className="bg-card/40">
			<CardContent className="pt-6 pb-6">
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{GUIDE_PHASES.map(({ phase, label }, i) => {
						const Icon = PHASE_ICONS[i];
						return (
							<div key={phase} className="flex flex-col items-center text-center space-y-2">
								<Icon className="w-8 h-8 text-muted-foreground" />
								<div className="font-semibold text-sm">{phase}</div>
								<div className="text-xs text-muted-foreground">{label}</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
