"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { AppLayout } from "@/components/layout/app-layout";
import { SimpleTable, type SimpleTableColumn } from "@/components/table/simple-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";

import { type SubsidyStatus, type SubsidyDeclaration, type DeclarationSection } from "../../declaration/[ccaName]/types";

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
    reason: string | null;
    subsidy_status: SubsidyStatus;
    cca_positions?: { id: number; name: string; position_type: string } | null;
};

type UpdateInput = { subsidyId: number; status: SubsidyStatus };

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

const statusVariant: Record<SubsidyStatus, "default" | "secondary" | "destructive"> = {
    pending: "secondary",
    approved: "default",
    rejected: "destructive",
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
        const statusOrder: SubsidyStatus[] = ["pending", "approved", "rejected"];

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
                justification: subsidy.reason || "",
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
                        <Button variant="default" size="sm" type="button" onClick={() => updateStatus(row, "approved")}>
                            Approve
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => updateStatus(row, "rejected")}
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
                            onClick={() => updateStatus(row, "rejected")}
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
                        <Button variant="default" size="sm" type="button" onClick={() => updateStatus(row, "approved")}>
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
            pending: pendingColumns,
            approved: approvedColumns,
            rejected: rejectedColumns,
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
                        <Link href="/dashboard/holidaySubsidy/approvals">
                            <Button variant="outline">← Back to approvals</Button>
                        </Link>
                        <Button onClick={handleSave} disabled={!hasChanges || saving}>
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
                    <div className="grid gap-6">
                        {sections.map((section) => (
                            <Card key={section.title} className="border shadow-sm">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>{section.title}</CardTitle>
                                    {section.key === "pending" && hasChanges && (
                                        <span className="text-sm text-muted-foreground">Unsaved changes</span>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <SimpleTable
                                        data={section.data}
                                        columns={columnsBySection[section.key]}
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
