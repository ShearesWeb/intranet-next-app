"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	SubsidyDeclarationFields,
	SubsidyDeclarationFormFooter,
	SubsidyFormField,
	SubsidyFormSelect,
	validateDeclarationForm,
} from "@/components/holiday-subsidy/subsidy-declaration-form";

import type {
	PositionOption,
	SubsidyDeclaration,
	SubsidyWithPosition,
	WeekOption,
} from "@/types/declarations";

export type SubsidyDeclarationFormDialogProps = {
	ccaId: string;
	ccaName: string;
	positions: PositionOption[];
	weekOptions: WeekOption[];
	open: boolean;
	editingDeclaration: SubsidyDeclaration | null;
	onOpenChange: (open: boolean) => void;
	onSubmitSuccess: (declaration: SubsidyDeclaration, isEdit: boolean) => void;
	mapSubsidyToDeclaration: (
		subsidy: SubsidyWithPosition,
		overrideMap?: Map<number, PositionOption>,
	) => SubsidyDeclaration;
};

export function SubsidyDeclarationFormDialog({
	ccaId,
	ccaName,
	positions,
	weekOptions,
	open,
	editingDeclaration,
	onOpenChange,
	onSubmitSuccess,
	mapSubsidyToDeclaration,
}: SubsidyDeclarationFormDialogProps) {
	const [formState, setFormState] = useState({
		positionId: positions[0]?.id ?? 0,
		weekId: weekOptions[0]?.id ?? 0,
		hours: "",
		justification: "",
	});
	const [formError, setFormError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const resetForm = useCallback(
		(nextPositions?: PositionOption[]) => {
			const availablePositions = nextPositions ?? positions;
			setFormState({
				positionId: availablePositions[0]?.id ?? 0,
				weekId: weekOptions[0]?.id ?? 0,
				hours: "",
				justification: "",
			});
			setFormError(null);
		},
		[positions, weekOptions],
	);

	useEffect(() => {
		if (!open) {
			resetForm();
			return;
		}

		if (editingDeclaration) {
			setFormState({
				positionId: editingDeclaration.positionId,
				weekId: editingDeclaration.weekId,
				hours: editingDeclaration.hours.toString(),
				justification: editingDeclaration.justification,
			});
			setFormError(null);
		} else {
			resetForm();
		}
	}, [editingDeclaration, open, resetForm]);

	useEffect(() => {
		resetForm();
	}, [positions, resetForm]);

	const handleSubmit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setFormError(null);
			setSubmitting(true);

			const validationError = !formState.weekId
				? "All fields are required and hours must be greater than 0."
				: validateDeclarationForm(formState);
			if (validationError) {
				setFormError(validationError);
				setSubmitting(false);
				return;
			}

			try {
				const response = await fetch(`/api/holiday-subsidy/declarations/${ccaId}`, {
					method: editingDeclaration ? "PATCH" : "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						subsidyId: editingDeclaration?.id,
						positionId: formState.positionId,
						weekId: Number(formState.weekId),
						hours: Number(formState.hours),
						justification: formState.justification,
					}),
				});

				const json = await response.json();

				if (!response.ok) {
					throw new Error(json.error || "Failed to submit declaration");
				}

				const payload = json.data ?? json;
				if (payload.subsidy) {
					const overrideMap = new Map<number, PositionOption>(
						positions.map((position) => [position.id, position]),
					);
					onSubmitSuccess(
						mapSubsidyToDeclaration(payload.subsidy as SubsidyWithPosition, overrideMap),
						Boolean(editingDeclaration),
					);
				}

				onOpenChange(false);
				resetForm();
			} catch (err) {
				setFormError(err instanceof Error ? err.message : "Failed to submit declaration");
			} finally {
				setSubmitting(false);
			}
		},
		[
			ccaId,
			editingDeclaration,
			formState,
			mapSubsidyToDeclaration,
			onOpenChange,
			onSubmitSuccess,
			positions,
			resetForm,
		],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{editingDeclaration
							? "Edit Subsidy Declaration"
							: `New Subsidy Declaration - ${ccaName}`}
					</DialogTitle>
					<DialogDescription>
						Declare the hours envelope for this position and week. JCRC reviews the requested hours
						and your justification before approving.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4 pt-2">
					<SubsidyFormField label="CCA">
						<Input value={ccaName} disabled />
					</SubsidyFormField>
					<SubsidyDeclarationFields
						positionLabel="CCA Position"
						positions={positions}
						values={formState}
						onChange={(patch) => setFormState((prev) => ({ ...prev, ...patch }))}
					>
						<SubsidyFormField label="Week">
							<SubsidyFormSelect
								value={formState.weekId}
								onChange={(e) =>
									setFormState((prev) => ({
										...prev,
										weekId: Number(e.target.value),
									}))
								}
							>
								{weekOptions.map((week) => (
									<option key={week.id} value={week.id}>
										{week.label}
									</option>
								))}
							</SubsidyFormSelect>
						</SubsidyFormField>
					</SubsidyDeclarationFields>

					<SubsidyDeclarationFormFooter
						formError={formError}
						submitting={submitting}
						isEdit={Boolean(editingDeclaration)}
						submitDisabled={positions.length === 0}
					/>
				</form>
			</DialogContent>
		</Dialog>
	);
}
