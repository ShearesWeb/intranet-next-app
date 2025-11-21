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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type DeclarationStatus = "Pending" | "Approved" | "Rejected";

type Declaration = {
    position: string;
    week: string;
    hours: string;
    justification: string;
    status: DeclarationStatus;
};

const mockDeclarations: Record<Lowercase<DeclarationStatus>, Declaration[]> = {
    pending: [
        {
            position: "Swim Team Member",
            week: "Week 1",
            hours: "4",
            justification: "Training on Wed/Fri",
            status: "Pending",
        },
        {
            position: "Choir Vocalist",
            week: "Week 2",
            hours: "3",
            justification: "Sectional practice and rehearsal",
            status: "Pending",
        },
    ],
    approved: [
        {
            position: "Drama Crew",
            week: "Week 1",
            hours: "5",
            justification: "Stage setup and blocking",
            status: "Approved",
        },
        {
            position: "Badminton Captain",
            week: "Week 3",
            hours: "6",
            justification: "Inter-hall scrimmage prep",
            status: "Approved",
        },
    ],
    rejected: [
        {
            position: "Photography Lead",
            week: "Week 2",
            hours: "2",
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
        () => [
            { title: "Pending Declarations", data: mockDeclarations.pending },
            { title: "Approved Declarations", data: mockDeclarations.approved },
            { title: "Rejected Declarations", data: mockDeclarations.rejected },
        ],
        []
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

                <Separator />

                <div className="grid gap-6">
                    {sections.map((section) => (
                        <Card key={section.title} className="border shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>{section.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[22%]">Position</TableHead>
                                                <TableHead className="w-[12%]">Week</TableHead>
                                                <TableHead className="w-[14%]">Requested Hours</TableHead>
                                                <TableHead className="w-[30%]">Justification</TableHead>
                                                <TableHead className="w-[12%]">Status</TableHead>
                                                <TableHead className="text-right w-[10%]">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {section.data.map((row, index) => (
                                                <TableRow key={`${section.title}-${index}`}>
                                                    <TableCell className="font-semibold">{row.position}</TableCell>
                                                    <TableCell>{row.week}</TableCell>
                                                    <TableCell>{row.hours} hrs</TableCell>
                                                    <TableCell className="max-w-[280px]">
                                                        <div className="truncate text-sm text-muted-foreground">
                                                            {row.justification}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={statusVariant[row.status]}>
                                                            {row.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="outline" size="sm">
                                                                    Actions
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem>View</DropdownMenuItem>
                                                                <DropdownMenuItem>Edit</DropdownMenuItem>
                                                                <DropdownMenuItem className="text-destructive">
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
