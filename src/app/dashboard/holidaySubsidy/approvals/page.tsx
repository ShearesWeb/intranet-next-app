"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, X, Info } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { SimpleTable, type SimpleTableColumn } from "@/components/table/simple-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/context/AuthContext";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WEEK_OPTIONS } from "@/lib/constants/holiday-subsidy";
import type {
    SubsidyStatus,
    SubsidyDeclarationWithCCA,
    SubsidyWithCCAInfo,
} from "@/types/holiday-subsidy";

export default function HolidaySubsidyApprovalsPage() {
    const { user } = useAuth();
    const [declarations, setDeclarations] = useState<SubsidyDeclarationWithCCA[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingChanges, setPendingChanges] = useState<Record<number, SubsidyStatus>>({});
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

    const weekLabel = useCallback((weekId: number) => {
        const week = WEEK_OPTIONS.find((w) => w.id === weekId);
        return week?.label || `Week ${weekId}`;
    }, []);

    const mapApiToDeclaration = useCallback((subsidy: SubsidyWithCCAInfo): SubsidyDeclarationWithCCA => {
        const position = subsidy.cca_positions;
        const cca = position?.ccas;

        return {
            id: subsidy.id,
            positionId: subsidy.position_id,
            positionName: position?.name || "Unknown Position",
            positionType: position?.position_type || "",
            weekId: subsidy.week_id,
            hours: subsidy.hours,
            justification: subsidy.justification || "",
            status: subsidy.subsidy_status,
            ccaId: position?.cca_id || 0,
            ccaName: cca?.name || "Unknown CCA",
        };
    }, []);

    useEffect(() => {
        const loadData = async () => {
            try {
                setError(null);
                setLoading(true);

                const response = await fetch("/api/holidaySubsidy/approvals");

                if (!response.ok) {
                    throw new Error("Failed to load approvals");
                }

                const data = await response.json();
                const apiDeclarations = data.declarations as SubsidyWithCCAInfo[];

                setDeclarations((apiDeclarations || []).map(mapApiToDeclaration));
            } catch (err) {
                console.error(err);
                setError("Unable to load subsidy approvals right now. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [mapApiToDeclaration]);

    const updateStatus = useCallback((declaration: SubsidyDeclarationWithCCA, status: SubsidyStatus) => {
        setSuccessMessage(null);
        setDeclarations((prev) => prev.map((item) => (item.id === declaration.id ? { ...item, status } : item)));
        setPendingChanges((prev) => ({ ...prev, [declaration.id]: status }));
    }, []);

    const toggleSelectItem = useCallback((id: number) => {
        setSelectedItems((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    const selectAllItems = useCallback((items: SubsidyDeclarationWithCCA[]) => {
        setSelectedItems(new Set(items.map((item) => item.id)));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedItems(new Set());
        setIsEditMode(false);
    }, []);

    const moveSelectedToPending = useCallback(() => {
        setSuccessMessage(null);
        selectedItems.forEach((id) => {
            const declaration = declarations.find((d) => d.id === id);
            if (declaration) {
                updateStatus(declaration, "pending");
            }
        });
        clearSelection();
    }, [selectedItems, declarations, updateStatus, clearSelection]);

    const handleSave = useCallback(async () => {
        if (Object.keys(pendingChanges).length === 0) return;

        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const updates = Object.entries(pendingChanges).map(([subsidyId, status]) => ({
                subsidyId: Number(subsidyId),
                status,
            }));

            const response = await fetch("/api/holidaySubsidy/approvals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to save approvals");
            }

            const updated: SubsidyWithCCAInfo[] = data.updated || [];
            const updatedMap = new Map(updated.map((item) => [item.id, item.subsidy_status]));

            // Update declarations with new statuses
            setDeclarations((prev) =>
                prev.map((decl) => {
                    const newStatus = updatedMap.get(decl.id);
                    return newStatus ? { ...decl, status: newStatus } : decl;
                })
            );

            setPendingChanges({});
            setSuccessMessage(`Successfully processed ${updates.length} declaration(s)!`);

            // Clear success message after 5 seconds
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save approvals");
        } finally {
            setSaving(false);
        }
    }, [pendingChanges]);

    // Separate declarations by status
    const pendingDeclarations = useMemo(
        () => declarations.filter((d) => d.status === "pending"),
        [declarations]
    );

    const approvedDeclarations = useMemo(
        () => declarations.filter((d) => d.status === "approved"),
        [declarations]
    );

    const rejectedDeclarations = useMemo(
        () => declarations.filter((d) => d.status === "rejected"),
        [declarations]
    );

    const commonColumns = useMemo<SimpleTableColumn<SubsidyDeclarationWithCCA>[]>(
        () => [
            {
                accessorKey: "ccaName",
                header: "CCA",
                cell: (value: string) => <span className="font-semibold text-sm">{value}</span>,
                enableSorting: true,
            },
            {
                accessorKey: "positionName",
                header: "Position",
                cell: (value: string, row) => (
                    <div className="flex flex-col items-start gap-1">
                        <span className="font-medium text-sm leading-tight">{value}</span>
                        <PositionTypeBadge value={row.positionType} />
                    </div>
                ),
                enableSorting: false,
            },
            {
                accessorKey: "weekId",
                header: "Week",
                cell: (value: number) => <span className="text-sm">{weekLabel(value)}</span>,
                enableSorting: true,
            },
            {
                accessorKey: "hours",
                header: "Hours",
                cell: (value: number) => <span className="text-sm font-medium">{value} hrs</span>,
                enableSorting: true,
            },
            {
                accessorKey: "justification",
                header: "Justification",
                cell: (value: string) => (
                    <div className="text-xs text-muted-foreground whitespace-pre-line break-words max-w-[280px] max-h-24 overflow-y-auto pr-1 line-clamp-3">
                        {value || "No justification provided"}
                    </div>
                ),
                enableSorting: false,
            },
        ],
        [weekLabel]
    );

    const pendingColumns = useMemo<SimpleTableColumn<SubsidyDeclarationWithCCA>[]>(
        () => [
            ...commonColumns,
            {
                accessorKey: "status",
                header: "Status",
                cell: (value: SubsidyStatus, row) => {
                    const isPending = pendingChanges[row.id];
                    const displayStatus = isPending || value;
                    const variant =
                        displayStatus === "approved"
                            ? "default"
                            : displayStatus === "rejected"
                              ? "destructive"
                              : "secondary";

                    return (
                        <Badge variant={variant} className="capitalize">
                            {displayStatus}
                            {isPending && " *"}
                        </Badge>
                    );
                },
                enableSorting: false,
            },
            {
                accessorKey: "actions" as keyof SubsidyDeclarationWithCCA,
                header: "Actions",
                enableSorting: false,
                cell: (_value, row) => (
                    <div className="flex gap-2 justify-start">
                        <Button
                            variant={row.status === "approved" || pendingChanges[row.id] === "approved" ? "default" : "outline"}
                            size="sm"
                            type="button"
                            onClick={() => updateStatus(row, "approved")}
                            className="gap-1"
                        >
                            <Check className="h-3 w-3" />
                            Approve
                        </Button>
                        <Button
                            variant={row.status === "rejected" || pendingChanges[row.id] === "rejected" ? "destructive" : "outline"}
                            size="sm"
                            type="button"
                            onClick={() => updateStatus(row, "rejected")}
                            className="gap-1"
                        >
                            <X className="h-3 w-3" />
                            Reject
                        </Button>
                    </div>
                ),
            },
        ],
        [commonColumns, pendingChanges, updateStatus]
    );

    const approvedColumns = useMemo<SimpleTableColumn<SubsidyDeclarationWithCCA>[]>(
        () => {
            const baseColumns: SimpleTableColumn<SubsidyDeclarationWithCCA>[] = [
                ...commonColumns,
                {
                    accessorKey: "status",
                    header: "Status",
                    cell: (value: SubsidyStatus, row: SubsidyDeclarationWithCCA) => {
                        const isPending = pendingChanges[row.id];
                        if (isPending) {
                            const variant = isPending === "rejected" ? "destructive" : "secondary";
                            return (
                                <Badge variant={variant} className="capitalize">
                                    {isPending} *
                                </Badge>
                            );
                        }
                        return (
                            <Badge variant="default" className="capitalize">
                                Approved
                            </Badge>
                        );
                    },
                    enableSorting: false,
                },
            ];

            if (isEditMode) {
                return [
                    {
                        accessorKey: "select" as keyof SubsidyDeclarationWithCCA,
                        header: () => (
                            <input
                                type="checkbox"
                                checked={approvedDeclarations.length > 0 && approvedDeclarations.every((d) => selectedItems.has(d.id))}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        selectAllItems(approvedDeclarations);
                                    } else {
                                        clearSelection();
                                    }
                                }}
                                className="cursor-pointer"
                            />
                        ),
                        cell: (_value: unknown, row: SubsidyDeclarationWithCCA) => (
                            <input
                                type="checkbox"
                                checked={selectedItems.has(row.id)}
                                onChange={() => toggleSelectItem(row.id)}
                                className="cursor-pointer"
                            />
                        ),
                        enableSorting: false,
                    },
                    ...baseColumns,
                ];
            }

            return baseColumns;
        },
        [commonColumns, pendingChanges, isEditMode, selectedItems, approvedDeclarations, toggleSelectItem, selectAllItems, clearSelection]
    );

    const rejectedColumns = useMemo<SimpleTableColumn<SubsidyDeclarationWithCCA>[]>(
        () => {
            const baseColumns: SimpleTableColumn<SubsidyDeclarationWithCCA>[] = [
                ...commonColumns,
                {
                    accessorKey: "status",
                    header: "Status",
                    cell: (value: SubsidyStatus, row: SubsidyDeclarationWithCCA) => {
                        const isPending = pendingChanges[row.id];
                        if (isPending) {
                            const variant = isPending === "approved" ? "default" : "secondary";
                            return (
                                <Badge variant={variant} className="capitalize">
                                    {isPending} *
                                </Badge>
                            );
                        }
                        return (
                            <Badge variant="destructive" className="capitalize">
                                Rejected
                            </Badge>
                        );
                    },
                    enableSorting: false,
                },
            ];

            if (isEditMode) {
                return [
                    {
                        accessorKey: "select" as keyof SubsidyDeclarationWithCCA,
                        header: () => (
                            <input
                                type="checkbox"
                                checked={rejectedDeclarations.length > 0 && rejectedDeclarations.every((d) => selectedItems.has(d.id))}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        selectAllItems(rejectedDeclarations);
                                    } else {
                                        clearSelection();
                                    }
                                }}
                                className="cursor-pointer"
                            />
                        ),
                        cell: (_value: unknown, row: SubsidyDeclarationWithCCA) => (
                            <input
                                type="checkbox"
                                checked={selectedItems.has(row.id)}
                                onChange={() => toggleSelectItem(row.id)}
                                className="cursor-pointer"
                            />
                        ),
                        enableSorting: false,
                    },
                    ...baseColumns,
                ];
            }

            return baseColumns;
        },
        [commonColumns, pendingChanges, isEditMode, selectedItems, rejectedDeclarations, toggleSelectItem, selectAllItems, clearSelection]
    );

    const hasChanges = Object.keys(pendingChanges).length > 0;
    const isAuthorized = Boolean(user?.is_jcrc);

    if (!isAuthorized) {
        return (
            <AppLayout>
                <div className="flex flex-col gap-4 p-6 max-w-3xl">
                    <h1 className="text-2xl font-bold">Holiday Subsidy Approvals</h1>
                    <Card>
                        <CardContent className="p-6 space-y-2">
                            <div className="text-lg font-semibold">JCRC access only</div>
                            <p className="text-sm text-muted-foreground">
                                This page is restricted to JCRC members responsible for approving subsidy declarations and
                                weekly commitments.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    if (loading) {
        return (
            <AppLayout>
                <LoadingSpinner message="Loading approvals..." />
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="flex flex-col gap-4 p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <h1 className="text-2xl font-bold">Holiday Subsidy Approvals</h1>
                    <Button onClick={handleSave} disabled={!hasChanges || saving} size="lg">
                        {saving ? "Saving..." : hasChanges ? `Save ${Object.keys(pendingChanges).length} change(s)` : "No changes"}
                    </Button>
                </div>

                {successMessage && (
                    <Alert className="border-green-200 bg-green-50">
                        <Check className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
                    </Alert>
                )}

                {error && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertDescription className="text-red-800">{error}</AlertDescription>
                    </Alert>
                )}

                {hasChanges && (
                    <Alert className="border-blue-200 bg-blue-50">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800">
                            You have unsaved changes. Items marked with * will be updated when you click Save.
                        </AlertDescription>
                    </Alert>
                )}

                <Tabs defaultValue="pending" className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-3">
                        <TabsTrigger value="pending">
                            Pending ({pendingDeclarations.length})
                        </TabsTrigger>
                        <TabsTrigger value="approved">
                            Approved ({approvedDeclarations.length})
                        </TabsTrigger>
                        <TabsTrigger value="rejected">
                            Rejected ({rejectedDeclarations.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="mt-4">
                    <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Pending Declarations</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <SimpleTable
                                    data={pendingDeclarations}
                                    columns={pendingColumns}
                                    searchColumn="ccaName"
                                    searchPlaceholder="Search by CCA name, position, or justification..."
                                    pageSize={20}
                                    emptyMessage="No pending subsidy declarations to review."
                                    tableContainerClassName="rounded-lg overflow-hidden"
                                    tableClassName="[&_th]:px-4 [&_td]:px-4 [&_th]:py-3 [&_td]:py-3"
                                />
                            </CardContent>
                    </Card>
                    </TabsContent>

                    <TabsContent value="approved" className="mt-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">Approved Declarations</CardTitle>
                                    {isEditMode ? (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={moveSelectedToPending}
                                                disabled={selectedItems.size === 0}
                                            >
                                                Move to Pending ({selectedItems.size})
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={clearSelection}>
                                                Cancel
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                                            Edit
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                    <SimpleTable
                                    data={approvedDeclarations}
                                    columns={approvedColumns}
                                    searchColumn="ccaName"
                                    searchPlaceholder="Search by CCA name, position, or justification..."
                                    pageSize={20}
                                    emptyMessage="No approved declarations yet."
                                    tableContainerClassName="rounded-lg overflow-hidden"
                                    tableClassName="[&_th]:px-4 [&_td]:px-4 [&_th]:py-3 [&_td]:py-3"
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="rejected" className="mt-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">Rejected Declarations</CardTitle>
                                    {isEditMode ? (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={moveSelectedToPending}
                                                disabled={selectedItems.size === 0}
                                            >
                                                Move to Pending ({selectedItems.size})
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={clearSelection}>
                                                Cancel
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                                            Edit
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <SimpleTable
                                    data={rejectedDeclarations}
                                    columns={rejectedColumns}
                                    searchColumn="ccaName"
                                    searchPlaceholder="Search by CCA name, position, or justification..."
                                    pageSize={20}
                                    emptyMessage="No rejected declarations."
                                    tableContainerClassName="rounded-lg overflow-hidden"
                                    tableClassName="[&_th]:px-4 [&_td]:px-4 [&_th]:py-3 [&_td]:py-3"
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
