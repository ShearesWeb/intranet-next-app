"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { AppLayout } from "@/components/layout/app-layout";
import { SimpleTable, type SimpleTableColumn } from "@/components/table/simple-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";

import { SubsidyStatus, type SubsidyDeclaration, type DeclarationSection } from "@/types/holiday-subsidy";
import { HOLIDAY_WEEK_OPTIONS } from "@/lib/holiday-subsidy-weeks";

type ApprovalPayload = {
    ccaName: string;
    positions: { id: number; name: string; position_type: string }[];
    subsidies: SubsidyFromApi[];
};

type SubsidyFromApi = {
    id: number;
    position_id: number;
    week_id: number;
    hours: number;
    justification: string | null;
    subsidy_status: SubsidyStatus;
    cca_positions?: { id: number; name: string; position_type: string } | null;
};

type UpdateInput = { subsidyId: number; status: SubsidyStatus };

const WEEK_OPTIONS = HOLIDAY_WEEK_OPTIONS;

const statusVariant: Record<SubsidyStatus, "default" | "secondary" | "destructive"> = {
    [SubsidyStatus.PENDING]: "secondary",
    [SubsidyStatus.APPROVED]: "default",
    [SubsidyStatus.REJECTED]: "destructive",
};

export default function HolidaySubsidyApprovalDetailsPage() {
    const params = useParams();
    const { user } = useAuth();
    const ccaIdParam = params?.ccaId;
    const ccaId = typeof ccaIdParam === "string" ? ccaIdParam : "";

    const [ccaName, setCcaName] = useState("");
    const [declarations, setDeclarations] = useState<SubsidyDeclaration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingChanges, setPendingChanges] = useState<Record<number, SubsidyStatus>>({});
    const [saving, setSaving] = useState(false);

    const weekLabel = useCallback((weekId: number) => {
        const week = WEEK_OPTIONS.find((w) => w.id === weekId);
        return week?.label || `Week ${weekId}`;
    }, []);

    const formatStatus = useCallback((status: SubsidyStatus) => {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }, []);

    const sections = useMemo((): DeclarationSection[] => {
        const statusOrder: SubsidyStatus[] = [SubsidyStatus.PENDING, SubsidyStatus.APPROVED, SubsidyStatus.REJECTED];

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
                    <div className="flex flex-col items-start gap-1">
                        <span className="font-semibold leading-tight">{value}</span>
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
                    <div className="text-sm text-muted-foreground whitespace-pre-line break-words max-w-[320px] max-h-32 overflow-y-auto pr-1 line-clamp-3">
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
        (subsidy: SubsidyFromApi): SubsidyDeclaration => {
            const position = subsidy.cca_positions;

            return {
                id: subsidy.id,
                positionId: subsidy.position_id,
                positionName: position?.name || "Unknown Position",
                positionType: position?.position_type || "",
                weekId: subsidy.week_id,
                hours: subsidy.hours,
                justification: subsidy.justification || "",
                status: subsidy.subsidy_status,
            };
        },
        []
    );

    useEffect(() => {
        if (!ccaId) return;

        let isMounted = true;
        setLoading(true);
        setError(null);

        fetch(`/api/holidaySubsidy/approvals/${ccaId}`)
            .then(async (res) => {
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Failed to fetch subsidy approvals");
                }

                return data as ApprovalPayload;
            })
            .then((data) => {
                if (!isMounted) return;

                setCcaName(data.ccaName);
                setDeclarations((data.subsidies || []).map((subsidy) => mapSubsidyToDeclaration(subsidy)));
                setPendingChanges({});
            })
            .catch((err) => {
                if (!isMounted) return;
                setError(err instanceof Error ? err.message : "Failed to load subsidy approvals");
            })
            .finally(() => {
                if (!isMounted) return;
                setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [ccaId, mapSubsidyToDeclaration]);

    const hasChanges = Object.keys(pendingChanges).length > 0;

    // Warn user before leaving page with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = "";
                return "";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasChanges]);

    const updateStatus = useCallback((declaration: SubsidyDeclaration, status: SubsidyStatus) => {
        setDeclarations((prev) => prev.map((item) => (item.id === declaration.id ? { ...item, status } : item)));
        setPendingChanges((prev) => ({ ...prev, [declaration.id]: status }));
    }, []);

    const handleSave = useCallback(async () => {
        if (!hasChanges || !ccaId) return;

        setSaving(true);
        setError(null);

        try {
            const updates: UpdateInput[] = Object.entries(pendingChanges).map(([subsidyId, status]) => ({
                subsidyId: Number(subsidyId),
                status,
            }));

            const response = await fetch(`/api/holidaySubsidy/approvals/${ccaId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to save approvals");
            }

            const updated: SubsidyFromApi[] = data.updated || [];
            const updatedMap = new Map(updated.map((item) => [item.id, item.subsidy_status] as const));

            setDeclarations((prev) =>
                prev.map((decl) =>
                    updatedMap.has(decl.id) ? { ...decl, status: updatedMap.get(decl.id) as SubsidyStatus } : decl
                )
            );
            setPendingChanges({});
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save approvals");
        } finally {
            setSaving(false);
        }
    }, [ccaId, hasChanges, pendingChanges]);

    const pendingColumns = useMemo<SimpleTableColumn<SubsidyDeclaration>[]>(
        () => [
            ...commonColumns,
            {
                accessorKey: "actions" as keyof SubsidyDeclaration,
                header: "Actions",
                enableSorting: false,
                cell: (_value, row) => (
                    <div className="flex justify-start gap-2">
                        <Button variant="default" size="sm" type="button" onClick={() => updateStatus(row, SubsidyStatus.APPROVED)}>
                            Approve
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => updateStatus(row, SubsidyStatus.REJECTED)}
                        >
                            Reject
                        </Button>
                    </div>
                ),
            },
        ],
        [commonColumns, updateStatus]
    );

    const approvedColumns = useMemo<SimpleTableColumn<SubsidyDeclaration>[]>(
        () => [
            ...commonColumns,
            {
                accessorKey: "actions" as keyof SubsidyDeclaration,
                header: "Actions",
                enableSorting: false,
                cell: (_value, row) => (
                    <div className="flex justify-start gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => updateStatus(row, SubsidyStatus.REJECTED)}
                        >
                            Reject
                        </Button>
                    </div>
                ),
            },
        ],
        [commonColumns, updateStatus]
    );

    const rejectedColumns = useMemo<SimpleTableColumn<SubsidyDeclaration>[]>(
        () => [
            ...commonColumns,
            {
                accessorKey: "actions" as keyof SubsidyDeclaration,
                header: "Actions",
                enableSorting: false,
                cell: (_value, row) => (
                    <div className="flex justify-start gap-2">
                        <Button variant="default" size="sm" type="button" onClick={() => updateStatus(row, SubsidyStatus.APPROVED)}>
                            Approve
                        </Button>
                    </div>
                ),
            },
        ],
        [commonColumns, updateStatus]
    );

    const columnsBySection: Record<SubsidyStatus, SimpleTableColumn<SubsidyDeclaration>[]> = useMemo(
        () => ({
            [SubsidyStatus.PENDING]: pendingColumns,
            [SubsidyStatus.APPROVED]: approvedColumns,
            [SubsidyStatus.REJECTED]: rejectedColumns,
        }),
        [approvedColumns, pendingColumns, rejectedColumns]
    );

    if (!user?.is_jcrc) {
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
                <LoadingSpinner message="Loading subsidy approvals..." />
            </AppLayout>
        );
    }

    if (!ccaId) {
        return null;
    }

    return (
        <AppLayout>
            <div className="flex flex-col space-y-6 p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold">JCRC Holiday Subsidy Approvals - {ccaName || `CCA #${ccaId}`}</h1>
                        <p className="text-muted-foreground">
                            Review, approve, or reject subsidy declarations for this CCA.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Button
                            variant="outline"
                            onClick={(e) => {
                                if (hasChanges && !confirm("You have unsaved changes. Leave without saving?")) {
                                    e.preventDefault();
                                } else {
                                    window.location.href = "/dashboard/holidaySubsidy/approvals";
                                }
                            }}
                        >
                            ← Back to approvals
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                            className="px-6 shadow-md font-semibold gap-2 disabled:opacity-50 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                        >
                            {saving ? "Saving..." : hasChanges ? "Save all changes" : "No changes"}
                        </Button>
                    </div>
                </div>

                <Separator />

                {error ? (
                    <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : (
                    <Tabs defaultValue={SubsidyStatus.PENDING} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            {sections.map((section) => (
                                <TabsTrigger key={section.key} value={section.key}>
                                    {section.key.charAt(0).toUpperCase() + section.key.slice(1)} ({section.data.length})
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        {sections.map((section) => (
                            <TabsContent key={section.key} value={section.key} className="mt-4">
                                <Card className="border shadow-sm">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle>{section.title}</CardTitle>
                                        {section.key === SubsidyStatus.PENDING && hasChanges && (
                                            <span className="text-sm text-muted-foreground">Unsaved changes</span>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        <SimpleTable
                                            data={section.data}
                                            columns={columnsBySection[section.key]}
                                            searchColumn="positionName"
                                            searchPlaceholder="Search position..."
                                            pageSize={10}
                                            emptyMessage="No declarations found."
                                            tableContainerClassName="rounded-md border bg-card/30 overflow-hidden"
                                            tableClassName="[&_th]:px-5 [&_td]:px-5"
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        ))}
                    </Tabs>
                )}
            </div >
        </AppLayout >
    );
}
