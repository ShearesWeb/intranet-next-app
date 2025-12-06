"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ListChecks } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { SimpleTable, type SimpleTableColumn } from "@/components/table/simple-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/context/AuthContext";

interface CcaApprovalRow {
    id: number;
    name: string;
    pendingDeclarations: number;
    pendingWeekly: number;
}

const columns: SimpleTableColumn<CcaApprovalRow>[] = [
    {
        accessorKey: "name",
        header: "CCA",
        cell: value => <span className="font-semibold text-sm md:text-base">{value}</span>,
    },
    {
        accessorKey: "pendingDeclarations",
        header: "Pending Declarations",
        cell: value => <span className="text-sm md:text-base font-medium">{value}</span>,
    },
    {
        accessorKey: "pendingWeekly",
        header: "Pending Weekly Commitments",
        cell: value => <span className="text-sm md:text-base font-medium">{value}</span>,
    },
    {
        accessorKey: "actions" as keyof CcaApprovalRow,
        header: "Actions",
        enableSorting: false,
        cell: (_value, row) => (
            <div className="flex flex-col lg:flex-row gap-2 justify-start w-full">
                <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link href={`/dashboard/holidaySubsidy/approvals/${row.id}`}>
                        Approve pending declarations
                        <ListChecks className="h-4 w-4" />
                    </Link>
                </Button>
                <Button asChild size="sm" className="gap-2">
                    <Link href={`/dashboard/holidaySubsidy/approvals/weekly/${row.id}`}>
                        Approve pending weekly commitments
                        <ShieldCheck className="h-4 w-4" />
                    </Link>
                </Button>
            </div>
        ),
    },
];

export default function HolidaySubsidyApprovalsPage() {
    const { user } = useAuth();
    const [rows, setRows] = useState<CcaApprovalRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                const ccas = data.ccas as Array<{ 
                    id: number; 
                    name: string; 
                    pendingDeclarations: number;
                    pendingWeekly: number;
                }>;

                setRows(
                    (ccas || []).map(({ id, name, pendingDeclarations, pendingWeekly }) => ({
                        id,
                        name,
                        pendingDeclarations,
                        pendingWeekly,
                    }))
                );
            } catch (err) {
                console.error(err);
                setError("Unable to load subsidy approvals right now. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

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
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold">Holiday Subsidy Approvals</h1>
                    <p className="text-muted-foreground text-sm">
                        Review all CCAs and see how many subsidy declarations or weekly commitments are pending approval.
                    </p>
                </div>

                {error ? (
                    <Card>
                        <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
                    </Card>
                ) : (
                    <SimpleTable
                        data={rows}
                        columns={columns}
                        searchColumn="name"
                        searchPlaceholder="Search CCA..."
                        pageSize={10}
                        emptyMessage="No CCAs available."
                        tableContainerClassName="rounded-lg border bg-card/40 overflow-hidden"
                        tableClassName="min-w-full [&_th]:px-5 [&_td]:px-5"
                    />
                )}
            </div>
        </AppLayout>
    );
}
