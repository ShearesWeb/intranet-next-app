"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ListChecks } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { SimpleTable, type SimpleTableColumn } from "@/components/table/simple-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";

interface CcaApprovalRow {
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
                    <Link href={`/dashboard/holidaySubsidy/declaration/${encodeURIComponent(row.name)}`}>
                        Approve pending declarations
                        <ListChecks className="h-4 w-4" />
                    </Link>
                </Button>
                <Button asChild size="sm" className="gap-2">
                    <Link href={`/dashboard/holidaySubsidy/weekly`}>
                        Approve pending weekly commitments
                        <ShieldCheck className="h-4 w-4" />
                    </Link>
                </Button>
            </div>
        ),
    },
];

const mockRows: CcaApprovalRow[] = [
    { name: "Sheares Basketball", pendingDeclarations: 3, pendingWeekly: 2 },
    { name: "Sheares Band", pendingDeclarations: 1, pendingWeekly: 0 },
    { name: "Sheares Dance", pendingDeclarations: 5, pendingWeekly: 4 },
];

export default function HolidaySubsidyApprovalsPage() {
    const { user } = useAuth();
    const [rows, setRows] = useState<CcaApprovalRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        // TODO: replace with API call to fetch CCAs with pending subsidy activity for JCRC
        setRows(mockRows);
        setLoading(false);
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
                <div className="flex items-center justify-center py-12">
                    <Spinner className="h-8 w-8" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="flex flex-col gap-4 p-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold">Holiday Subsidy Approvals</h1>
                    <p className="text-muted-foreground text-sm">
                        Review CCAs that have submitted subsidy declarations or weekly commitments and proceed to approve
                        them.
                    </p>
                </div>

                <SimpleTable
                    data={rows}
                    columns={columns}
                    searchColumn="name"
                    searchPlaceholder="Search CCA..."
                    pageSize={10}
                    emptyMessage="No CCAs with subsidy declarations yet."
                    tableContainerClassName="rounded-lg border bg-card/40 overflow-hidden"
                    tableClassName="min-w-full [&_th]:px-5 [&_td]:px-5"
                />
            </div>
        </AppLayout>
    );
}
