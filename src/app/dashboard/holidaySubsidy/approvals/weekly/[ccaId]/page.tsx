"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectionTable, type SelectionTableColumn } from "@/components/table/selection-table";
import { ArrowLeft, Check, X, Info } from "lucide-react";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

type WeeklyRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  type: string;
  hours: number;
  justification: string;
  remarks: string;
  status: "pending" | "accepted" | "rejected";
};

const weekMeta = [
  { id: 1, label: "Week 1", range: "4 Dec - 10 Dec" },
  { id: 2, label: "Week 2", range: "11 Dec - 17 Dec" },
  { id: 3, label: "Week 3", range: "18 Dec - 24 Dec" },
  { id: 4, label: "Week 4", range: "25 Dec - 31 Dec" },
  { id: 5, label: "Week 5", range: "1 Jan - 7 Jan" },
  { id: 6, label: "Week 6", range: "8 Jan - 14 Jan" },
];

// Mock data for now
const mockRows: WeeklyRow[] = [
  {
    id: 1,
    name: "Alice Tan",
    email: "alice.tan@sheares.sg",
    role: "Member",
    type: "subcomm",
    hours: 4,
    justification: "Training on Wed/Fri",
    remarks: "On time, full attendance",
    status: "pending",
  },
  {
    id: 2,
    name: "Ben Lim",
    email: "ben.lim@sheares.sg",
    role: "Vice",
    type: "maincomm",
    hours: 5,
    justification: "Planning session + dry run",
    remarks: "Lead warm-up",
    status: "pending",
  },
  {
    id: 3,
    name: "Charmaine Ong",
    email: "charmaine.ong@sheares.sg",
    role: "Member",
    type: "blockcomm",
    hours: 3,
    justification: "Thursday scrimmage",
    remarks: "Missed Monday, informed",
    status: "pending",
  },
];

export default function WeeklyCommitmentApprovalPage() {
  const params = useParams();
  const { user } = useAuth();
  const ccaIdParam = params?.ccaId;
  const ccaId = typeof ccaIdParam === "string" ? ccaIdParam : "";
  
  const [weekIndex, setWeekIndex] = useState(0);
  const [rows, setRows] = useState<WeeklyRow[]>(mockRows);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
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

  const weekInfo = weekMeta[weekIndex];

  const handleApprove = async () => {
    if (selected.size === 0) {
      toast.error("Please select at least one member to approve.");
      return;
    }

    setLoading(true);
    try {
      // TODO: API call to approve selected members
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setRows((prev) =>
        prev.map((row) => {
          if (selected.has(row.id)) {
            return { ...row, status: "accepted" as const };
          }
          return row;
        })
      );

      toast.success(`Approved ${selected.size} member(s).`);
      setSelected(new Set());
    } catch {
      toast.error("Failed to approve. Please try again.");
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
      // TODO: API call to reject selected members
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
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
    } catch {
      toast.error("Failed to reject. Please try again.");
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
            status === "accepted" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
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

  // Check if user is JCRC
  if (!user?.is_jcrc) {
    return (
      <AppLayout>
        <div className="flex flex-col gap-4 p-6 max-w-3xl">
          <h1 className="text-2xl font-bold">Weekly Commitment Approval</h1>
          <Card>
            <CardContent className="p-6 space-y-2">
              <div className="text-lg font-semibold">JCRC access only</div>
              <p className="text-sm text-muted-foreground">
                This page is restricted to JCRC members responsible for approving weekly commitments.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
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
          <h2 className="text-lg font-semibold">Select Week</h2>
          
          <Tabs
            value={weekMeta[weekIndex].label}
            onValueChange={(val) => {
              const idx = weekMeta.findIndex((w) => w.label === val);
              if (idx >= 0) {
                setWeekIndex(idx);
                setSelected(new Set());
              }
            }}
          >
            <TabsList className="flex flex-wrap gap-2 bg-transparent p-1 border-0 h-auto">
              {weekMeta.map((week, idx) => {
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
            <SelectionTable<WeeklyRow, number>
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
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

