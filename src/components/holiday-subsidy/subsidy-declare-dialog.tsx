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
import { formatDisplayDate } from "@/lib/date";

import type { CalendarDeclaration, PositionOption } from "@/types/declarations";

type CcaOption = { id: number; name: string };

export interface SubsidyDeclareDialogProps {
	chairCcas: CcaOption[];
	positionsByCca: Map<number, PositionOption[]>;
	date: string;
	open: boolean;
	editing: CalendarDeclaration | null;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

export function SubsidyDeclareDialog({
	chairCcas,
	positionsByCca,
	date,
	open,
	editing,
	onOpenChange,
	onSuccess,
}: SubsidyDeclareDialogProps) {
	const defaultCcaId = chairCcas[0]?.id ?? 0;
	const [selectedCcaId, setSelectedCcaId] = useState(defaultCcaId);
	const positions = positionsByCca.get(selectedCcaId) ?? [];

	const [formState, setFormState] = useState({
		positionId: positions[0]?.id ?? 0,
		hours: "",
		justification: "",
	});
	const [formError, setFormError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const resetForm = useCallback(() => {
		const ccaId = editing?.cca_id ?? defaultCcaId;
		setSelectedCcaId(ccaId);
		const ccaPositions = positionsByCca.get(ccaId) ?? [];
		setFormState({
			positionId: ccaPositions[0]?.id ?? 0,
			hours: "",
			justification: "",
		});
		setFormError(null);
	}, [defaultCcaId, editing, positionsByCca]);

	useEffect(() => {
		if (!open) {
			resetForm();
			return;
		}

		if (editing) {
			setSelectedCcaId(editing.cca_id);
			setFormState({
				positionId: editing.position_id,
				hours: editing.hours.toString(),
				justification: editing.justification ?? "",
			});
			setFormError(null);
		} else {
			resetForm();
		}
	}, [editing, open, resetForm]);

	useEffect(() => {
		const ccaPositions = positionsByCca.get(selectedCcaId) ?? [];
		setFormState((prev) => ({ ...prev, positionId: ccaPositions[0]?.id ?? 0 }));
	}, [selectedCcaId, positionsByCca]);

	const handleSubmit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setFormError(null);
			setSubmitting(true);

			const validationError = validateDeclarationForm(formState);
			if (validationError) {
				setFormError(validationError);
				setSubmitting(false);
				return;
			}

			try {
				const response = await fetch(`/api/holiday-subsidy/declarations/${selectedCcaId}`, {
					method: editing ? "PATCH" : "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						positionId: formState.positionId,
						day: date,
						hours: Number(formState.hours),
						justification: formState.justification,
					}),
				});

				const json = await response.json();

				if (!response.ok) {
					throw new Error(json.error || "Failed to submit declaration");
				}

				onOpenChange(false);
				onSuccess();
			} catch (err) {
				setFormError(err instanceof Error ? err.message : "Failed to submit declaration");
			} finally {
				setSubmitting(false);
			}
		},
		[selectedCcaId, date, editing, formState, onOpenChange, onSuccess],
	);

	const selectedCcaName = chairCcas.find((c) => c.id === selectedCcaId)?.name ?? "";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{editing ? "Edit Subsidy Declaration" : "Declare Subsidy"}</DialogTitle>
					<DialogDescription>{formatDisplayDate(date, { year: "numeric" })}</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4 pt-2">
					<SubsidyFormField label="CCA">
						{chairCcas.length > 1 && !editing ? (
							<SubsidyFormSelect
								value={selectedCcaId}
								onChange={(e) => setSelectedCcaId(Number(e.target.value))}
							>
								{chairCcas.map((cca) => (
									<option key={cca.id} value={cca.id}>
										{cca.name}
									</option>
								))}
							</SubsidyFormSelect>
						) : (
							<Input value={selectedCcaName} disabled />
						)}
					</SubsidyFormField>
					<SubsidyDeclarationFields
						positions={positions}
						values={formState}
						onChange={(patch) => setFormState((prev) => ({ ...prev, ...patch }))}
					/>

					<SubsidyDeclarationFormFooter
						formError={formError}
						submitting={submitting}
						isEdit={Boolean(editing)}
						submitDisabled={positions.length === 0}
						editLabel="Update"
					/>
				</form>
			</DialogContent>
		</Dialog>
	);
}
