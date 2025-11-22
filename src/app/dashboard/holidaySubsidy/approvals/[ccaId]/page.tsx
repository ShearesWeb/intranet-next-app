"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";

export default function HolidaySubsidyApprovalDetailsPage() {
    const params = useParams();
    const { user } = useAuth();
    const ccaIdParam = params?.ccaId;
    const ccaId = typeof ccaIdParam === "string" ? ccaIdParam : "";

    if (!user?.is_jcrc) {
        return (
            <AppLayout>
                <div className="flex flex-col gap-4 p-6 max-w-3xl">
                    <h1 className="text-2xl font-bold">Holiday Subsidy Approvals</h1>
                    <Card>
                        <CardContent className="p-6 space-y-2">
                            <div className="text-lg font-semibold">JCRC access only</div>
                            <p className="text-sm text-muted-foreground">
                                This page will soon show pending declarations and weekly commitments for the selected CCA.
                                Access is limited to JCRC reviewers.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="flex flex-col gap-4 p-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold">Holiday Subsidy Approvals</h1>
                    <p className="text-muted-foreground text-sm">
                        Review and approve subsidy declarations for this CCA.
                    </p>
                </div>

                <Card className="max-w-4xl">
                    <CardHeader>
                        <CardTitle>CCA #{ccaId}</CardTitle>
                    </CardHeader>
                    <Separator />
                    <CardContent className="p-6 space-y-4">
                        <p className="text-sm text-muted-foreground">
                            This page will soon show pending declarations and weekly commitments for the selected CCA.
                            Use it to approve or reject submissions from chairs.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Button variant="outline" disabled>
                                Pending declarations (coming soon)
                            </Button>
                            <Button disabled>Pending weekly commitments (coming soon)</Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Linked from the approvals list so you can review items in one place once the workflows are
                            ready.
                        </div>
                        <Button asChild variant="secondary" className="mt-2">
                            <Link href="/dashboard/holidaySubsidy/approvals">Back to approvals</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
