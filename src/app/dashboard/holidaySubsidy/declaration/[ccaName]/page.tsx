"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { redirect, useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { SimpleTable, type SimpleTableColumn } from "@/components/table/simple-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const WEEK_OPTIONS = [
    { id: 1, label: "Week 1 (Dec 4 - Dec 10)" },
    { id: 2, label: "Week 2 (Dec 11 - Dec 17)" },
    { id: 3, label: "Week 3 (Dec 18 - Dec 24)" },
    { id: 4, label: "Week 4 (Dec 25 - Dec 31)" },
    { id: 5, label: "Week 5 (Jan 1 - Jan 7)" },
    { id: 6, label: "Week 6 (Jan 8 - Jan 14)" },
    { id: 7, label: "Week 7 (Jan 15 - Jan 21)" },
    { id: 8, label: "Week 8 (Jan 22 - Jan 28)" },
    { id: 9, label: "Week 9 (Jan 29 - Feb 4)" },
    { id: 10, label: "Week 10 (Feb 5 - Feb 11)" },
];

type SubsidyStatus = "pending" | "approved" | "rejected" | "partial";

type SubsidyDeclaration = {
    id: number;
    positionId: number;
    positionName: string;
    positionType: string;
    weekId: number;
    hours: number;
    justification: string;
    status: SubsidyStatus;
};

type DeclarationSection = {
    key: SubsidyStatus;
    title: string;
    data: SubsidyDeclaration[];
};

type PositionOption = {
    id: number;
    name: string;
    position_type: string;
};

type SubsidyFromApi = {
    id: number;
    position_id: number;
    week_id: number;
    hours: number;
    reason: string | null;
    subsidy_status: SubsidyStatus;
    cca_positions?: {
        id: number;
        name: string;
        position_type: string;
    } | null;
};

const statusVariant: Record<SubsidyStatus, "default" | "secondary" | "destructive"> = {
    pending: "secondary",
    approved: "default",
    rejected: "destructive",
    partial: "default",
};

export default function SubsidyDeclarationPage() {
    const params = useParams();
    const ccaNameParam = params?.ccaName;
    const ccaName = typeof ccaNameParam === "string" ? decodeURIComponent(ccaNameParam) : "";

    if (!ccaName) {
        redirect("/dashboard/holidaySubsidy");
        return null;
    }

    const titleSuffix = ` - ${ccaName}`;

    const [positions, setPositions] = useState<PositionOption[]>([]);
    const [declarations, setDeclarations] = useState<SubsidyDeclaration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingDeclaration, setEditingDeclaration] = useState<SubsidyDeclaration | null>(null);
    const [formState, setFormState] = useState({
        positionId: 0,
        weekId: WEEK_OPTIONS[0].id,
        hours: "",
        justification: "",
    });

    const positionMap = useMemo(
        () =>
            positions.reduce((acc, position) => {
                acc.set(position.id, position);
                return acc;
            }, new Map<number, PositionOption>()),
        [positions]
    );

    const weekLabel = useCallback((weekId: number) => {
        const week = WEEK_OPTIONS.find((w) => w.id === weekId);
        return week?.label || `Week ${weekId}`;
    }, []);

    const formatStatus = useCallback((status: SubsidyStatus) => {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }, []);

    const sections = useMemo((): DeclarationSection[] => {
        const statusOrder: SubsidyStatus[] = ["pending", "approved", "partial", "rejected"];

        return statusOrder.map((status) => ({
            key: status,
            title: `${formatStatus(status)} Declarations`,
            data: declarations.filter((declaration) => declaration.status === status),
        }));
    }, [declarations, formatStatus]);

    const commonColumns = useMemo<SimpleTableColumn<SubsidyDeclaration>[]>(
        () => [
            {
                accessorKey: "positionName",
                header: "Position",
                cell: (value: string, row) => (
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold">{value}</span>
                        <PositionTypeBadge value={row.positionType} />
                    </div>
                ),
                enableSorting: false,
            },
            {
                accessorKey: "weekId",
                header: "Week",
                cell: (value: number) => weekLabel(value),
                enableSorting: true,
            },
            {
                accessorKey: "hours",
                header: "Requested Hours",
                cell: (value: number) => `${value} hrs`,
                enableSorting: true,
            },
            {
                accessorKey: "justification",
                header: "Justification",
                cell: (value: string) => (
                    <div className="text-sm text-muted-foreground line-clamp-2 max-w-[320px]">
                        {value}
                    </div>
                ),
                enableSorting: false,
            },
            {
                accessorKey: "status",
                header: "Status",
                cell: (value: SubsidyStatus) => (
                    <Badge variant={statusVariant[value]}>
                        {formatStatus(value)}
                    </Badge>
                ),
                enableSorting: false,
            },
        ],
        [formatStatus, weekLabel]
    );

    const mapSubsidyToDeclaration = useCallback(
        (subsidy: SubsidyFromApi, overrideMap?: Map<number, PositionOption>): SubsidyDeclaration => {
            const map = overrideMap ?? positionMap;
            const position = subsidy.cca_positions || map.get(subsidy.position_id);

            return {
                id: subsidy.id,
                positionId: subsidy.position_id,
                positionName: position?.name || "Unknown Position",
                positionType: position?.position_type || "",
                weekId: subsidy.week_id,
                hours: subsidy.hours,
                justification: subsidy.reason || "",
                status: subsidy.subsidy_status,
            };
        },
        [positionMap]
    );

    useEffect(() => {
        if (!ccaName) return;

        setLoading(true);
        setError(null);

        fetch(`/api/holidaySubsidy/declarations/${encodeURIComponent(ccaName)}`)
            .then(async (res) => {
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Failed to fetch subsidy declarations");
                }

                return data;
            })
            .then((data) => {
                const positionsData = (data.positions || []) as PositionOption[];
                const positionsMap = positionsData.reduce((acc, position) => {
                    acc.set(position.id, position);
                    return acc;
                }, new Map<number, PositionOption>());

                const mapFromApi = (subsidy: SubsidyFromApi): SubsidyDeclaration => {
                    const position = subsidy.cca_positions || positionsMap.get(subsidy.position_id);

                    return {
                        id: subsidy.id,
                        positionId: subsidy.position_id,
                        positionName: position?.name || "Unknown Position",
                        positionType: position?.position_type || "",
                        weekId: subsidy.week_id,
                        hours: subsidy.hours,
                        justification: subsidy.reason || "",
                        status: subsidy.subsidy_status,
                    };
                };

                setPositions(positionsData);

                setDeclarations((data.subsidies || []).map((subsidy: SubsidyFromApi) => mapFromApi(subsidy)));

                if (positionsData.length > 0) {
                    resetForm(positionsData);
                }
            })
            .catch((err) => {
                setError(err.message || "Failed to load subsidy declarations");
            })
            .finally(() => setLoading(false));
    }, [ccaName, mapSubsidyToDeclaration, resetForm]);

    const resetForm = useCallback(
        (nextPositions?: PositionOption[]) => {
            const availablePositions = nextPositions ?? positions;
            setFormState({
                positionId: availablePositions[0]?.id ?? 0,
                weekId: WEEK_OPTIONS[0].id,
                hours: "",
                justification: "",
            });
            setFormError(null);
            setEditingDeclaration(null);
        },
        [positions]
    );

    const handleDialogOpenChange = useCallback(
        (open: boolean) => {
            setDialogOpen(open);
            if (!open) {
                resetForm();
            }
        },
        [resetForm]
    );

    const openCreateDialog = useCallback(() => {
        resetForm();
        setDialogOpen(true);
    }, [resetForm]);

    const openEditDialog = useCallback(
        (declaration: SubsidyDeclaration) => {
            setEditingDeclaration(declaration);
            setFormState({
                positionId: declaration.positionId,
                weekId: declaration.weekId,
                hours: declaration.hours.toString(),
                justification: declaration.justification,
            });
            setFormError(null);
            setDialogOpen(true);
        },
        []
    );

    const handleDelete = useCallback(
        async (declaration: SubsidyDeclaration) => {
            if (!confirm("Are you sure you want to delete this declaration?")) return;

            try {
                const response = await fetch(
                    `/api/holidaySubsidy/declarations/${encodeURIComponent(ccaName)}`,
                    {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ subsidyId: declaration.id }),
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to delete declaration");
                }

                setDeclarations((prev) => prev.filter((item) => item.id !== declaration.id));
            } catch (err) {
                setFormError(err instanceof Error ? err.message : "Failed to delete declaration");
            }
        },
        [ccaName]
    );

    const pendingColumns = useMemo<SimpleTableColumn<SubsidyDeclaration>[]>(
        () => [
            ...commonColumns,
            {
                accessorKey: "actions" as keyof SubsidyDeclaration,
                header: "Actions",
                enableSorting: false,
                cell: (_value, row) => (
                    <div className="flex justify-start gap-2">
                        <Button variant="outline" size="sm" type="button" onClick={() => openEditDialog(row)}>
                            Edit
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => handleDelete(row)}
                        >
                            Delete
                        </Button>
                    </div>
                ),
            },
        ],
        [commonColumns, handleDelete, openEditDialog]
    );

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
                            reason: formState.justification,
                        }),
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to submit declaration");
                }

                if (data.subsidy) {
                    setDeclarations((prev) => {
                        const mapped = mapSubsidyToDeclaration(data.subsidy);

                        if (editingDeclaration) {
                            return prev.map((decl) => (decl.id === mapped.id ? mapped : decl));
                        }

                        return [mapped, ...prev];
                    });
                }
                setDialogOpen(false);
                setEditingDeclaration(null);
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
            resetForm,
        ]
    );

    return (
        <AppLayout>
            <div className="flex flex-col space-y-6 p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold">
                            Subsidy Declaration{titleSuffix}
                        </h1>
                        <p className="text-muted-foreground">
                            Submit and track your weekly subsidy declarations.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/dashboard/holidaySubsidy">
                            <Button variant="outline">
                                ← Back to CCAs
                            </Button>
                        </Link>
                        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
                            <DialogTrigger asChild>
                                <Button className="px-4 py-3" onClick={openCreateDialog}>
                                    Declare New Subsidy
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        {editingDeclaration
                                            ? "Edit Subsidy Declaration"
                                            : `New Subsidy Declaration${titleSuffix}`}
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
                                            disabled={positions.length === 0}
                                        >
                                            {positions.map((position) => (
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
                                            {WEEK_OPTIONS.map((week) => (
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
                                        <Button type="submit" disabled={submitting || positions.length === 0}>
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
                    </div>
                </div>

                <Separator />

                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <Spinner className="w-8 h-8" />
                    </div>
                ) : error ? (
                    <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : positions.length === 0 ? (
                    <Card className="bg-gray-50 border-2 border-dashed border-gray-300">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
                            <p className="text-lg font-semibold">No positions found for this CCA.</p>
                            <p className="text-sm text-muted-foreground">
                                Ensure you have chair access and positions are configured for this CCA.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-6">
                        {sections.map((section) => (
                            <Card key={section.title} className="border shadow-sm">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>{section.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <SimpleTable
                                        data={section.data}
                                        columns={section.key === "pending" ? pendingColumns : commonColumns}
                                        searchColumn="positionName"
                                        searchPlaceholder="Search position..."
                                        pageSize={5}
                                        emptyMessage="No declarations found."
                                        tableContainerClassName="rounded-md border bg-card/30 overflow-hidden"
                                        tableClassName="[&_th]:px-5 [&_td]:px-5"
                                    />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
