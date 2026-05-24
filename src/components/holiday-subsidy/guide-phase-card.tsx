import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Phase1Card() {
	return (
		<Card>
			<CardHeader>
				<div className="space-y-2">
					<CardTitle className="text-lg font-semibold">
						Phase 1 — Initial Subsidy Declaration
					</CardTitle>
					<div className="flex items-center gap-2">
						<Badge variant="default">Chairs</Badge>
						<Badge variant="destructive">Due: Before Commencement of Week</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-sm text-muted-foreground leading-relaxed">
					Chairs declare subsidy requirements for the entire holiday period. For each position,
					provide weekly hours and a sound justification.
				</p>
				<p className="text-sm text-muted-foreground leading-relaxed">
					You can create new declarations and if JCRC rejects them, edit and resubmit; they will
					re-enter the approval queue.
				</p>
				<Alert>
					<AlertCircleIcon className="h-4 w-4" />
					<AlertTitle className="text-sm font-semibold">Valid Justifications Required</AlertTitle>
					<AlertDescription className="text-sm space-y-3">
						<p>
							For <strong>each position</strong>, provide weekly hours and a sound justification
							that is measurable and accurate.
						</p>
						<p className="font-medium">Example of valid justification:</p>
						<div className="space-y-1">
							<div>
								<strong>CCA:</strong> Swim Team
							</div>
							<div>
								<strong>Position:</strong> Members
							</div>
							<div>
								<strong>Week 1 Training:</strong>
							</div>
							<ul className="list-disc list-inside ml-4">
								<li>Wednesday — 2 hours</li>
								<li>Friday — 2 hours</li>
							</ul>
							<div className="pt-1">
								<strong>Total Declared Hours:</strong> 4 hours for Week 1
							</div>
						</div>
					</AlertDescription>
				</Alert>
			</CardContent>
		</Card>
	);
}

function Phase2Card() {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg font-semibold">Phase 2 — JCRC Approval</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground leading-relaxed">
					JCRC verifies justifications and validates weekly hour allocations. After approval, Chairs
					may edit approved declarations at any time but doing so will reset the status to{" "}
					<strong>Pending</strong> and require re-approval.
				</p>
			</CardContent>
		</Card>
	);
}

function Phase3Card() {
	return (
		<Card>
			<CardHeader>
				<div className="space-y-2">
					<CardTitle className="text-lg font-semibold">
						Phase 3 — Weekly Commitment Declaration
					</CardTitle>
					<div className="flex items-center gap-2">
						<Badge variant="default">Chairs</Badge>
						<Badge variant="destructive">Due: End of Each Week</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-sm text-muted-foreground leading-relaxed">
					Chairs must submit actual hours committed by each member weekly.
				</p>
				<Alert
					variant="destructive"
					className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive"
				>
					<AlertTriangleIcon className="h-4 w-4" />
					<AlertTitle className="text-sm font-semibold">Weekly Deadline</AlertTitle>
					<AlertDescription className="text-sm">
						<p>
							Submission closes every <strong>Tuesday 23:59</strong>. Missing the deadline
							automatically voids the subsidy for that week.
						</p>
						<p>Example: Week 1&apos;s Subsidies are due by Week 2 Tuesday 23:59</p>
					</AlertDescription>
				</Alert>
				<div className="bg-muted/50 rounded-lg p-4 space-y-3">
					<p className="text-sm text-muted-foreground leading-relaxed">
						The interface auto-fills recommended values based on approved declarations from Phase 1.
						You may decrease hours and add remarks, but you cannot increase them.
					</p>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-start gap-2">
							<span className="text-green-600 mt-0.5">•</span>
							<span>
								Each member appears as a row in the table prefilled according to the previous
								subsidy declaration.
							</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-amber-600 mt-0.5">•</span>
							<span>
								By default, all members are marked as{" "}
								<strong>not having committed any hours</strong>.
							</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-green-600 mt-0.5">•</span>
							<span>
								You must manually <strong>tick</strong> each member you want to confirm hours for.
							</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-blue-600 mt-0.5">•</span>
							<span>
								Modify the number of hours if the member&apos;s contributions are less than planned.
							</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-blue-600 mt-0.5">•</span>
							<span>
								You may add <strong>remarks</strong> to explain reduced hours or exceptions.
							</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-red-600 mt-0.5">•</span>
							<span>Hours cannot be increased beyond the approved subsidy declaration.</span>
						</li>
					</ul>
				</div>
				<Alert>
					<CheckCircle2Icon className="h-4 w-4" />
					<AlertTitle className="text-sm font-semibold">
						Why the Interface Is Designed This Way
					</AlertTitle>
					<AlertDescription className="text-sm leading-relaxed">
						<p>
							The submission interface requires chairs to manually confirm each member every week
							because it encourages <strong>intentional and thoughtful verification</strong> of
							actual participation. By reviewing every row, chairs must actively assess whether
							members genuinely showed up, contributed, and fulfilled the hours committed.
							<br />
							<br />
							This design prevents passive or blanket approvals and ensures that subsidy allocations
							reflect <strong>real, meaningful work</strong> rather than assumptions or default
							values. It reinforces fairness across all CCAs and upholds accountability in the
							subsidy process.
						</p>
					</AlertDescription>
				</Alert>
			</CardContent>
		</Card>
	);
}

function Phase4Card() {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg font-semibold">Phase 4 — Final Subsidy Calculation</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground leading-relaxed">
					At the end of the holiday, JCRC and SHWeb will run the subsidy algorithm to compute final
					eligible amounts.
				</p>
			</CardContent>
		</Card>
	);
}

export function GuidePhaseCards() {
	return (
		<div className="space-y-4">
			<Phase1Card />
			<Phase2Card />
			<Phase3Card />
			<Phase4Card />
		</div>
	);
}
