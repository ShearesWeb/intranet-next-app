"use client";

import { useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { redirect, useParams } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { SimpleTable, type SimpleTableColumn } from "@/components/table/simple-table";
import Link from "next/link";

type DeclarationStatus = "Pending" | "Approved" | "Rejected";

type Declaration = {
    position: string;
    positionType: string;
    week: string;
    hours: number;
    justification: string;
    status: DeclarationStatus;
};

type DeclarationSection = {
    key: Lowercase<DeclarationStatus>;
    title: string;
    data: Declaration[];
};

const mockDeclarations: Record<Lowercase<DeclarationStatus>, Declaration[]> = {
    pending: [
        {
            position: "Swim Team Member",
            positionType: "member",
            week: "Week 1",
            hours: 4,
            justification: "Training on Wed/Fri",
            status: "Pending",
        },
        {
            position: "Choir Vocalist",
            positionType: "subcomm",
            week: "Week 2",
            hours: 3,
            justification: "Sectional practice and rehearsal",
            status: "Pending",
        },
    ],
    approved: [
        {
            position: "Drama Crew",
            positionType: "crew",
            week: "Week 1",
            hours: 5,
            justification: "Stage setup and blocking",
            status: "Approved",
        },
        {
            position: "Badminton Captain",
            positionType: "lead",
            week: "Week 3",
            hours: 6,
            justification: "Inter-hall scrimmage prep",
            status: "Approved",
        },
    ],
    rejected: [
        {
            position: "Photography Lead",
            positionType: "lead",
            week: "Week 2",
            hours: 2,
            justification: "Photo walk coverage",
            status: "Rejected",
        },
    ],
};

const statusVariant: Record<DeclarationStatus, "default" | "secondary" | "destructive"> = {
    Pending: "secondary",
    Approved: "default",
    Rejected: "destructive",
};

const weeks = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];

export default function SubsidyDeclarationPage() {
    const params = useParams();
    const ccaNameParam = params?.ccaName;
    const ccaName = typeof ccaNameParam === "string" ? decodeURIComponent(ccaNameParam) : "";

    if (!ccaName) {
        redirect("/dashboard/holidaySubsidy");
        return null;
    }

    const titleSuffix = ` - ${ccaName}`;

    const sections = useMemo(
        (): DeclarationSection[] => [
            { key: "pending", title: "Pending Declarations", data: mockDeclarations.pending },
            { key: "approved", title: "Approved Declarations", data: mockDeclarations.approved },
            { key: "rejected", title: "Rejected Declarations", data: mockDeclarations.rejected },
        ],
        []
    );

    const commonColumns = useMemo<SimpleTableColumn<Declaration>[]>(
        () => [
            {
                accessorKey: "position",
                header: "Position",
                cell: (value: string) => <span className="font-semibold">{value}</span>,
                enableSorting: true,
            },
            {
                accessorKey: "positionType",
                header: "Position Type",
                cell: (value: string) => <PositionTypeBadge value={value} />,
                enableSorting: false,
            },
            {
                accessorKey: "week",
                header: "Week",
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
                cell: (value: DeclarationStatus) => (
                    <Badge variant={statusVariant[value]}>
                        {value}
                    </Badge>
                ),
                enableSorting: false,
            },
        ],
        []
    );

    const pendingColumns = useMemo<SimpleTableColumn<Declaration>[]>(
        () => [
            ...commonColumns,
            {
                accessorKey: "actions" as keyof Declaration,
                header: "Actions",
                enableSorting: false,
                cell: (_, row) => (
                    <div className="flex justify-start gap-2">
                        <Button variant="outline" size="sm">
                            Edit
                        </Button>
                        <Button variant="destructive" size="sm">
                            Delete
                        </Button>
                    </div>
                ),
            },
        ],
        [commonColumns]
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
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="px-4 py-3">Declare New Subsidy</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        New Subsidy Declaration{titleSuffix}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Fill in the details for your subsidy request. This is a static preview.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 pt-2">
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-foreground">CCA</label>
                                        <Input value={ccaName} disabled />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-foreground">
                                            CCA Position
                                        </label>
                                        <Input placeholder="e.g., Swim Team Member" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-foreground">
                                            Week
                                        </label>
                                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                            {weeks.map((week) => (
                                                <option key={week}>{week}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-foreground">
                                            Hours
                                        </label>
                                        <Input type="number" min={0} placeholder="e.g., 4" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-foreground">
                                            Justification
                                        </label>
                                        <Textarea placeholder="Briefly describe the activities and time spent." />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="secondary">Cancel</Button>
                                    </DialogClose>
                                    <Button>Submit Declaration</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <Separator />

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
                                    searchColumn="position"
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
            </div>
        </AppLayout>
    );
}
