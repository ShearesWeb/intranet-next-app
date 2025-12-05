"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { SubsidyDeclarationFormDialog } from "./subsidy-declaration-form-dialog";
import {
    DeclarationSection,
    PositionOption,
    SubsidyDeclaration,
    SubsidyFromApi,
    SubsidyStatus,
    WeekOption,
} from "./types";
import { ArrowLeft } from "lucide-react";
import { HOLIDAY_WEEK_OPTIONS } from "@/lib/holiday-subsidy-weeks";

const WEEK_OPTIONS: WeekOption[] = HOLIDAY_WEEK_OPTIONS;

const statusVariant: Record<SubsidyStatus, "default" | "secondary" | "destructive"> = {
    [SubsidyStatus.PENDING]: "secondary",
    [SubsidyStatus.APPROVED]: "default",
    [SubsidyStatus.REJECTED]: "destructive",
};

export default function SubsidyDeclarationPage() {
    const params = useParams();
    const ccaNameParam = params?.ccaName;
    const ccaName = typeof ccaNameParam === "string" ? decodeURIComponent(ccaNameParam) : "";

    const router = useRouter();

    const [positions, setPositions] = useState<PositionOption[]>([]);
    const [declarations, setDeclarations] = useState<SubsidyDeclaration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingDeclaration, setEditingDeclaration] = useState<SubsidyDeclaration | null>(null);

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
                justification: subsidy.justification || "",
                status: subsidy.subsidy_status,
            };
        },
        [positionMap]
    );

    useEffect(() => {
        if (!ccaName) {
            router.replace("/dashboard/holidaySubsidy");
        }
    }, [ccaName, router]);

    useEffect(() => {
        if (!ccaName) return;

        let isMounted = true;
        setLoading(true);
        setError(null);

        fetch(`/api/holidaySubsidy/declarations/${encodeURIComponent(ccaName)}`)
            .then(async (res) => {
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Failed to fetch subsidy declarations");
                }

                return data as { positions?: PositionOption[]; subsidies?: SubsidyFromApi[] };
            })
            .then((data) => {
                if (!isMounted) return;

                const positionsData = data.positions ?? [];
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
                        justification: subsidy.justification || "",
                        status: subsidy.subsidy_status,
                    };
                };

                setPositions(positionsData);

                setDeclarations((data.subsidies || []).map((subsidy: SubsidyFromApi) => mapFromApi(subsidy)));
            })
            .catch((err) => {
                if (!isMounted) return;
                setError(err instanceof Error ? err.message : "Failed to load subsidy declarations");
            })
            .finally(() => {
                if (!isMounted) return;
                setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [ccaName]);

    if (!ccaName) {
        return null;
    }

    const handleDialogOpenChange = useCallback(
        (open: boolean) => {
            setDialogOpen(open);
            if (!open) setEditingDeclaration(null);
        },
        []
    );

    const openCreateDialog = useCallback(() => {
        setEditingDeclaration(null);
        setDialogOpen(true);
    }, []);

    const openEditDialog = useCallback(
        (declaration: SubsidyDeclaration) => {
            setEditingDeclaration(declaration);
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
                setError(err instanceof Error ? err.message : "Failed to delete declaration");
            }
        },
        [ccaName]
    );

    const handleDeclarationSaved = useCallback(
        (declaration: SubsidyDeclaration, isEdit: boolean) => {
            setDeclarations((prev) =>
                isEdit ? prev.map((item) => (item.id === declaration.id ? declaration : item)) : [declaration, ...prev]
            );
        },
        []
    );

    const columnsForStatus = useCallback(
        (status: SubsidyStatus): SimpleTableColumn<SubsidyDeclaration>[] => {
            if (status === SubsidyStatus.PENDING) {
                return [
                    ...commonColumns,
                    {
                        accessorKey: "actions" as keyof SubsidyDeclaration,
                        header: "Actions",
                        enableSorting: false,
                        cell: (_value, row) => (
                            <div className="flex justify-start gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() => openEditDialog(row)}
                                >
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
                ];
            }

            if (status === SubsidyStatus.REJECTED) {
                return [
                    ...commonColumns,
                    {
                        accessorKey: "actions" as keyof SubsidyDeclaration,
                        header: "Actions",
                        enableSorting: false,
                        cell: (_value, row) => (
                            <div className="flex justify-start gap-2">
                                <Button size="sm" type="button" onClick={() => openEditDialog(row)}>
                                    Edit & Resubmit
                                </Button>
                            </div>
                        ),
                    },
                ];
            }

            if (status === SubsidyStatus.APPROVED) {
                return [
                    ...commonColumns,
                    {
                        accessorKey: "actions" as keyof SubsidyDeclaration,
                        header: "Actions",
                        enableSorting: false,
                        cell: (_value, row) => (
                            <div className="flex justify-start gap-2">
                                <Button size="sm" type="button" onClick={() => openEditDialog(row)}>
                                    Edit & Resubmit
                                </Button>
                            </div>
                        ),
                    },
                ];
            }

            return commonColumns;
        },
        [commonColumns, handleDelete, openEditDialog]
    );

    return (
        <AppLayout>
            <div className="flex flex-col space-y-6 p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold">
                            Subsidy Declaration - {ccaName}
                        </h1>
                        <p className="text-muted-foreground">
                            Submit and track your weekly subsidy declarations.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/dashboard/holidaySubsidy">
                            <Button variant="outline" className="px-4 py-3" >
                                <ArrowLeft className="h-4 w-4" />
                                Back to CCAs
                            </Button>
                        </Link>
                        <Button className="px-4 py-3" onClick={openCreateDialog}>
                            Declare New Subsidy
                        </Button>
                        <SubsidyDeclarationFormDialog
                            ccaName={ccaName}
                            positions={positions}
                            weekOptions={WEEK_OPTIONS}
                            open={dialogOpen}
                            editingDeclaration={editingDeclaration}
                            onOpenChange={handleDialogOpenChange}
                            onSubmitSuccess={handleDeclarationSaved}
                            mapSubsidyToDeclaration={mapSubsidyToDeclaration}
                        />
                    </div>
                </div>

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
                                    </CardHeader>
                                    <CardContent>
                                        <SimpleTable
                                            data={section.data}
                                            columns={columnsForStatus(section.key)}
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
