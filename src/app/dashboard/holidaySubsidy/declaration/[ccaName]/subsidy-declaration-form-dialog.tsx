"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

import {
    PositionOption,
    SubsidyDeclaration,
    SubsidyFromApi,
    WeekOption,
} from "./types";

export type SubsidyDeclarationFormDialogProps = {
    ccaName: string;
    positions: PositionOption[];
    weekOptions: WeekOption[];
    open: boolean;
    editingDeclaration: SubsidyDeclaration | null;
    onOpenChange: (open: boolean) => void;
    onSubmitSuccess: (declaration: SubsidyDeclaration, isEdit: boolean) => void;
    mapSubsidyToDeclaration: (
        subsidy: SubsidyFromApi,
        overrideMap?: Map<number, PositionOption>
    ) => SubsidyDeclaration;
};

export function SubsidyDeclarationFormDialog({
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
        [positions, weekOptions]
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

            if (
                !formState.positionId ||
                !formState.weekId ||
                formState.hours === "" ||
                Number(formState.hours) <= 0 ||
                !formState.justification.trim()
            ) {
                setFormError("All fields are required and hours must be greater than 0.");
                setSubmitting(false);
                return;
            }

            try {
                const response = await fetch(
                    `/api/holidaySubsidy/declarations/${encodeURIComponent(ccaName)}`,
                    {
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
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to submit declaration");
                }

                if (data.subsidy) {
                    const overrideMap = new Map<number, PositionOption>(
                        positions.map((position) => [position.id, position])
                    );
                    onSubmitSuccess(
                        mapSubsidyToDeclaration(data.subsidy as SubsidyFromApi, overrideMap),
                        Boolean(editingDeclaration)
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
            ccaName,
            editingDeclaration,
            formState.hours,
            formState.justification,
            formState.positionId,
            formState.weekId,
            mapSubsidyToDeclaration,
            onOpenChange,
            onSubmitSuccess,
            positions,
            resetForm,
        ]
    );

    const weekOptionsMemo = useMemo(() => weekOptions, [weekOptions]);
    const positionOptionsMemo = useMemo(() => positions, [positions]);

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
                        Fill in the details for your subsidy request.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">CCA</label>
                        <Input value={ccaName} disabled />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">CCA Position</label>
                        <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={formState.positionId}
                            onChange={(e) =>
                                setFormState((prev) => ({
                                    ...prev,
                                    positionId: Number(e.target.value),
                                }))
                            }
                            disabled={positionOptionsMemo.length === 0}
                        >
                            {positionOptionsMemo.map((position) => (
                                <option key={position.id} value={position.id}>
                                    {position.name} ({position.position_type})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Week</label>
                        <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={formState.weekId}
                            onChange={(e) =>
                                setFormState((prev) => ({
                                    ...prev,
                                    weekId: Number(e.target.value),
                                }))
                            }
                        >
                            {weekOptionsMemo.map((week) => (
                                <option key={week.id} value={week.id}>
                                    {week.label}
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
                            onChange={(e) =>
                                setFormState((prev) => ({
                                    ...prev,
                                    hours: e.target.value,
                                }))
                            }
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Justification</label>
                        <Textarea
                            placeholder="Briefly describe the activities and time spent."
                            value={formState.justification}
                            onChange={(e) =>
                                setFormState((prev) => ({
                                    ...prev,
                                    justification: e.target.value,
                                }))
                            }
                            required
                        />
                    </div>

                    {formError ? (
                        <Alert variant="destructive">
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    ) : null}

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary" disabled={submitting}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={submitting || positionOptionsMemo.length === 0}>
                            {submitting
                                ? editingDeclaration
                                    ? "Updating..."
                                    : "Submitting..."
                                : editingDeclaration
                                    ? "Update Declaration"
                                    : "Submit Declaration"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
