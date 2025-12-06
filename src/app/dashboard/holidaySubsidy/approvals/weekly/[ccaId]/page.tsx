"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectionTable, type SelectionTableColumn } from "@/components/table/selection-table";
import { ArrowLeft, Check, X, Info, AlertCircle } from "lucide-react";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { HOLIDAY_WEEKS } from "@/lib/holiday-subsidy-weeks";

type WeeklyRow = {
  id: string; // Composite ID: "user_id-position_id"
  user_id: number;
  position_id: number;
  name: string;
  email: string;
  role: string;
  type: string;
  hours: number;
  justification: string;
  remarks: string;
  status: "pending" | "approved" | "rejected";
};

export default function WeeklyCommitmentApprovalPage() {
  const params = useParams();
  const ccaIdParam = params?.ccaId;
  const ccaId = typeof ccaIdParam === "string" ? ccaIdParam : "";

  const [weekIndex, setWeekIndex] = useState(0);
  const [rows, setRows] = useState<WeeklyRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ccaName, setCcaName] = useState("");

  // Fetch CCA name
  useEffect(() => {
    if (!ccaId) return;

    let isMounted = true;

    fetch(`/api/holidaySubsidy/approvals/${ccaId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch CCA details");
        }
        return data;
      })
      .then((data) => {
        if (!isMounted) return;
        setCcaName(data.ccaName || "Unknown CCA");
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Error fetching CCA name:", err);
        setCcaName("Unknown CCA");
      });

    return () => {
      isMounted = false;
    };
  }, [ccaId]);

  const weekInfo = HOLIDAY_WEEKS[weekIndex];

  // Fetch weekly submissions data
  useEffect(() => {
    const fetchData = async () => {
      if (!ccaId) {
        setError("CCA ID is required");
        setIsLoadingData(false);
        return;
      }

      setIsLoadingData(true);
      setError(null);

      try {
        const response = await fetch(`/api/holidaySubsidy/approvals/weekly/${ccaId}/${weekInfo.id}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to load data");
        }

        const data = await response.json();
        setRows(data.submissions || []);
      } catch (err) {
        console.error("Error fetching weekly approval data:", err);
        setError(err instanceof Error ? err.message : "Failed to load approval data");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [ccaId, weekInfo.id]);

  const handleApprove = async () => {
    if (selected.size === 0) {
      toast.error("Please select at least one member to approve.");
      return;
    }

    setLoading(true);
    try {
      // Prepare updates array
      const updates = rows
        .filter((row) => selected.has(row.id))
        .map((row) => ({
          user_id: row.user_id,
          position_id: row.position_id,
          status: "approved" as const,
        }));

      const response = await fetch(`/api/holidaySubsidy/approvals/weekly/${ccaId}/${weekInfo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to approve");
      }

      // Update UI
      setRows((prev) =>
        prev.map((row) => {
          if (selected.has(row.id)) {
            return { ...row, status: "approved" as const };
          }
          return row;
        })
      );

      toast.success(`Approved ${selected.size} member(s).`);
      setSelected(new Set());
    } catch (err) {
      console.error("Error approving:", err);
      toast.error(err instanceof Error ? err.message : "Failed to approve. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (selected.size === 0) {
      toast.error("Please select at least one member to reject.");
      return;
    }

    setLoading(true);
    try {
      // Prepare updates array
      const updates = rows
        .filter((row) => selected.has(row.id))
        .map((row) => ({
          user_id: row.user_id,
          position_id: row.position_id,
          status: "rejected" as const,
        }));

      const response = await fetch(`/api/holidaySubsidy/approvals/weekly/${ccaId}/${weekInfo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reject");
      }

      // Update UI
      setRows((prev) =>
        prev.map((row) => {
          if (selected.has(row.id)) {
            return { ...row, status: "rejected" as const };
          }
          return row;
        })
      );

      toast.success(`Rejected ${selected.size} member(s).`);
      setSelected(new Set());
    } catch (err) {
      console.error("Error rejecting:", err);
      toast.error(err instanceof Error ? err.message : "Failed to reject. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const columns: SelectionTableColumn<WeeklyRow>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Member",
        cell: (_value, row) => (
          <div className="flex flex-col min-w-[120px]">
            <span className="font-semibold text-sm leading-tight">{row.name}</span>
            <span className="text-xs text-muted-foreground">{row.email}</span>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: (value) => (
          <div className="min-w-[80px]">
            <PositionTypeBadge value={String(value)} className="text-xs" />
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: (value) => (
          <div className="min-w-[85px]">
            <PositionTypeBadge value={String(value)} className="text-xs" />
          </div>
        ),
      },
      {
        accessorKey: "hours",
        header: "Hours",
        cell: (_value, row) => (
          <div className="flex items-center gap-1 min-w-[60px]">
            <span className="font-semibold text-sm">{row.hours}</span>
            <span className="text-xs text-muted-foreground">hrs</span>
          </div>
        ),
      },
      {
        accessorKey: "justification",
        header: "Justification",
        cell: (_value, row) => (
          <div className="min-w-[150px] max-w-[200px]">
            <p className="text-xs line-clamp-2">{row.justification}</p>
          </div>
        ),
      },
      {
        accessorKey: "remarks",
        header: "Remarks",
        cell: (_value, row) => (
          <div className="min-w-[150px] max-w-[200px]">
            <p className="text-xs line-clamp-2">{row.remarks}</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (value) => {
          const status = String(value);
          const colorClass =
            status === "approved" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
              status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";

          return (
            <div className="min-w-[75px]">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colorClass}`}>
                {status}
              </span>
            </div>
          );
        },
      },
    ],
    []
  );

  // TODO: Re-enable JCRC authorization check after testing
  // The API route handles authorization for now

  const breadcrumbOverride = ccaName ? [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Holiday Subsidy", href: "/dashboard/holidaySubsidy" },
    { name: "JCRC Approvals", href: "/dashboard/holidaySubsidy/approvals" },
    { name: ccaName, href: `/dashboard/holidaySubsidy/approvals/weekly/${ccaId}` },
  ] : undefined;

  return (
    <AppLayout breadcrumbOverride={breadcrumbOverride}>
      <div className="flex flex-col space-y-6 p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Weekly Commitment Approval{ccaName && ` - ${ccaName}`}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base">
              Review and approve weekly hours committed by CCA members during the holiday period.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href="/dashboard/holidaySubsidy/approvals">
              <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4" />
                Back to Approvals
              </Button>
            </Link>
          </div>
        </div>

        {/* Week Selection Tabs */}
        <div className="space-y-3">
          <Tabs
            value={HOLIDAY_WEEKS[weekIndex].label}
            onValueChange={(val) => {
              const idx = HOLIDAY_WEEKS.findIndex((w) => w.label === val);
              if (idx >= 0) {
                setWeekIndex(idx);
                setSelected(new Set());
              }
            }}
          >
            <TabsList className="flex flex-wrap gap-2 bg-transparent p-1 border-0 h-auto">
              {HOLIDAY_WEEKS.map((week, idx) => {
                const active = idx === weekIndex;
                return (
                  <TabsTrigger
                    key={week.id}
                    value={week.label}
                    className="flex flex-col items-start gap-1 px-4 py-3 rounded-lg border data-[state=inactive]:bg-background data-[state=inactive]:text-foreground data-[state=inactive]:border-border data-[state=inactive]:hover:border-primary/50 data-[state=inactive]:hover:bg-accent data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:shadow-sm data-[state=active]:ring-2 data-[state=active]:ring-primary/20 transition-all"
                  >
                    <span className="text-sm font-semibold">{week.label}</span>
                    <span className={`text-[11px] ${active ? 'text-primary/80' : 'text-muted-foreground'}`}>
                      {week.range}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Main Table Card */}
        <Card className="border shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-xl">Member Commitments - {weekInfo.label}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <Info className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {selected.size > 0 ? (
                      <span className="font-semibold text-foreground">
                        {selected.size} member(s) selected
                      </span>
                    ) : (
                      "Select members to approve or reject their weekly commitment submissions"
                    )}
                  </span>
                </CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  onClick={handleReject}
                  disabled={loading || selected.size === 0}
                  variant="outline"
                  size="lg"
                  className="gap-2 flex-1 sm:flex-initial border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                >
                  <X className="h-4 w-4" />
                  Reject Selected
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={loading || selected.size === 0}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white gap-2 flex-1 sm:flex-initial"
                >
                  <Check className="h-4 w-4" />
                  Approve Selected
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-sm text-muted-foreground">Loading submissions...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-2 text-center max-w-md">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                  <p className="text-sm font-semibold">Failed to load data</p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-2 text-center max-w-md">
                  <Info className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-semibold">No submissions yet</p>
                  <p className="text-xs text-muted-foreground">
                    There are no pending subsidy declarations for this week.
                  </p>
                </div>
              </div>
            ) : (
              <SelectionTable<WeeklyRow, string>
                data={rows}
                columns={columns}
                selectionEnabled
                selectedIds={selected}
                onSelectionChange={(id) => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) {
                      next.delete(id);
                    } else {
                      next.add(id);
                    }
                    return next;
                  });
                }}
                idField="id"
                searchColumn="name"
                searchPlaceholder="Search members by name..."
                pageSize={10}
                emptyMessage="No members found for this week."
                tableContainerClassName="border-muted"
                tablePadding="[&_th]:px-3 [&_td]:px-3 py-2"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

