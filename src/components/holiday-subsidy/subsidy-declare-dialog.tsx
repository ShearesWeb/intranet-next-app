"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

function formatDisplayDate(dateStr: string): string {
	const d = new Date(dateStr + "T00:00:00");
	return d.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});
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

			if (
				!formState.positionId ||
				formState.hours === "" ||
				Number(formState.hours) <= 0 ||
				!formState.justification.trim()
			) {
				setFormError("All fields are required and hours must be greater than 0.");
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
					<DialogDescription>{formatDisplayDate(date)}</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4 pt-2">
					{chairCcas.length > 1 && !editing ? (
						<div className="space-y-1">
							<label className="text-sm font-medium text-foreground">CCA</label>
							<select
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								value={selectedCcaId}
								onChange={(e) => setSelectedCcaId(Number(e.target.value))}
							>
								{chairCcas.map((cca) => (
									<option key={cca.id} value={cca.id}>
										{cca.name}
									</option>
								))}
							</select>
						</div>
					) : (
						<div className="space-y-1">
							<label className="text-sm font-medium text-foreground">CCA</label>
							<Input value={selectedCcaName} disabled />
						</div>
					)}
					<div className="space-y-1">
						<label className="text-sm font-medium text-foreground">Position</label>
						<select
							className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							value={formState.positionId}
							onChange={(e) =>
								setFormState((prev) => ({ ...prev, positionId: Number(e.target.value) }))
							}
							disabled={positions.length === 0}
						>
							{positions.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name} ({p.position_type})
								</option>
							))}
						</select>
					</div>
					<div className="space-y-1">
						<label className="text-sm font-medium text-foreground">Hours</label>
						<Input
							type="number"
							min={0}
							step={0.5}
							placeholder="e.g., 4"
							value={formState.hours}
							onChange={(e) => setFormState((prev) => ({ ...prev, hours: e.target.value }))}
							required
						/>
					</div>
					<div className="space-y-1">
						<label className="text-sm font-medium text-foreground">Justification</label>
						<Textarea
							placeholder="Briefly describe the activities and time spent."
							value={formState.justification}
							onChange={(e) => setFormState((prev) => ({ ...prev, justification: e.target.value }))}
							required
						/>
					</div>

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
						<Button type="submit" disabled={submitting || positions.length === 0}>
							{submitting
								? editing
									? "Updating..."
									: "Submitting..."
								: editing
									? "Update"
									: "Submit Declaration"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
