"use client";

import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PositionOption } from "@/types/declarations";

// Shared building blocks for the two subsidy declaration dialogs (week-keyed
// chair form and date-keyed calendar form).

export function SubsidyFormField({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1">
			<label className="text-sm font-medium text-foreground">{label}</label>
			{children}
		</div>
	);
}

export function SubsidyFormSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select
			className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			{...props}
		/>
	);
}

interface DeclarationFormValues {
	positionId: number;
	hours: string;
	justification: string;
}

export function validateDeclarationForm(values: DeclarationFormValues): string | null {
	if (
		!values.positionId ||
		values.hours === "" ||
		Number(values.hours) <= 0 ||
		!values.justification.trim()
	) {
		return "All fields are required and hours must be greater than 0.";
	}
	return null;
}

/**
 * Position select + hours input + justification textarea, shared verbatim.
 * `children` render between the position select and the hours input
 * (the week-keyed form slots its Week select there).
 */
export function SubsidyDeclarationFields({
	positionLabel = "Position",
	positions,
	values,
	onChange,
	children,
}: {
	positionLabel?: string;
	positions: PositionOption[];
	values: DeclarationFormValues;
	onChange: (patch: Partial<DeclarationFormValues>) => void;
	children?: React.ReactNode;
}) {
	return (
		<>
			<SubsidyFormField label={positionLabel}>
				<SubsidyFormSelect
					value={values.positionId}
					onChange={(e) => onChange({ positionId: Number(e.target.value) })}
					disabled={positions.length === 0}
				>
					{positions.map((position) => (
						<option key={position.id} value={position.id}>
							{position.name} ({position.position_type})
						</option>
					))}
				</SubsidyFormSelect>
			</SubsidyFormField>
			{children}
			<SubsidyFormField label="Hours">
				<Input
					type="number"
					min={0}
					step={0.5}
					placeholder="e.g., 4"
					value={values.hours}
					onChange={(e) => onChange({ hours: e.target.value })}
					required
				/>
			</SubsidyFormField>
			<SubsidyFormField label="Justification">
				<Textarea
					placeholder="Briefly describe the activities and time spent."
					value={values.justification}
					onChange={(e) => onChange({ justification: e.target.value })}
					required
				/>
			</SubsidyFormField>
		</>
	);
}

/** Error alert + cancel/submit footer with the Updating…/Submitting… ternary. */
export function SubsidyDeclarationFormFooter({
	formError,
	submitting,
	isEdit,
	submitDisabled,
	editLabel = "Update Declaration",
	createLabel = "Submit Declaration",
}: {
	formError: string | null;
	submitting: boolean;
	isEdit: boolean;
	submitDisabled?: boolean;
	editLabel?: string;
	createLabel?: string;
}) {
	return (
		<>
			{formError && (
				<Alert variant="destructive">
					<AlertDescription>{formError}</AlertDescription>
				</Alert>
			)}

			<DialogFooter>
				<DialogClose asChild>
					<Button type="button" variant="secondary" disabled={submitting}>
						Cancel
					</Button>
				</DialogClose>
				<Button type="submit" disabled={submitting || submitDisabled}>
					{submitting
						? isEdit
							? "Updating..."
							: "Submitting..."
						: isEdit
							? editLabel
							: createLabel}
				</Button>
			</DialogFooter>
		</>
	);
}
