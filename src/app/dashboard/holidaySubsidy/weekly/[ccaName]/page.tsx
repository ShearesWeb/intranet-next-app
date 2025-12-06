"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SelectionTable, type SelectionTableColumn } from "@/components/table/selection-table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { toast } from "sonner";
import { getEditableWeekIds, HOLIDAY_WEEKS } from "@/lib/holiday-subsidy-weeks";

type WeeklyRow = {
  id: number;
  user_id: number;
  position_id: number;
  name: string;
  email: string;
  role: string;
  type: string;
  hours: number;
  justification: string;
  remarks: string;
  has_approved_subsidy: boolean;
  submitted: boolean;
};

export default function WeeklyCommitmentPage() {
  const params = useParams();
  const ccaName = params?.ccaName as string || "";

  const [editableWeekIds, setEditableWeekIds] = useState<number[]>(() => getEditableWeekIds(new Date()));
  const [weekIndex, setWeekIndex] = useState(() => {
    const initialIndex = HOLIDAY_WEEKS.findIndex((week) => editableWeekIds.includes(week.id));
    return initialIndex >= 0 ? initialIndex : 0;
  });
  const [rows, setRows] = useState<WeeklyRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekInfo = HOLIDAY_WEEKS[weekIndex];
  const isWeekOpen = editableWeekIds.includes(weekInfo.id);

  useEffect(() => {
    const interval = setInterval(() => {
      setEditableWeekIds(getEditableWeekIds(new Date()));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setWeekIndex((currentIndex) => {
      if (editableWeekIds.includes(HOLIDAY_WEEKS[currentIndex]?.id)) {
        return currentIndex;
      }

      const nextIndex = HOLIDAY_WEEKS.findIndex((week) => editableWeekIds.includes(week.id));
      return nextIndex >= 0 ? nextIndex : currentIndex;
    });
  }, [editableWeekIds]);

  // Fetch data when component mounts or week changes
  useEffect(() => {
    const fetchData = async () => {
      if (!ccaName) {
        setError("CCA name is required");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        if (!isWeekOpen) {
          setRows([]);
          setHasUnsavedChanges(false);
          setSelected(new Set());
          setDirtyRows(new Set());
          setIsLoading(false);
          return;
        }

        const response = await fetch(`/api/holidaySubsidy/weekly/${encodeURIComponent(ccaName)}/${weekInfo.id}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to load data");
        }

        const data = await response.json();
        const fetchedRows: WeeklyRow[] = data.members || [];
        setRows(fetchedRows);
        setSelected(new Set(fetchedRows.filter((member) => member.submitted).map((member) => member.id)));
        setDirtyRows(new Set());
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Error fetching weekly data:", err);
        setError(err instanceof Error ? err.message : "Failed to load weekly commitment data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [ccaName, editableWeekIds, weekInfo.id]);

  // Warn user before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleChange = useCallback((id: number, key: keyof WeeklyRow, value: string | number) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    setDirtyRows((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const { canSave, hasPendingChanges } = useMemo(() => {
    const selectedDirtyOrNew = rows.some(
      (row) => selected.has(row.id) && (dirtyRows.has(row.id) || !row.submitted)
    );
    const deselectedSubmitted = rows.some((row) => !selected.has(row.id) && row.submitted);
    const anyDirty = rows.some((row) => dirtyRows.has(row.id));

    return {
      canSave: selectedDirtyOrNew || deselectedSubmitted,
      hasPendingChanges: selectedDirtyOrNew || anyDirty || deselectedSubmitted,
    };
  }, [rows, selected, dirtyRows]);

  useEffect(() => {
    setHasUnsavedChanges(hasPendingChanges);
  }, [hasPendingChanges]);

  const handleSave = async () => {
    if (!ccaName) {
      toast.error("CCA name is required");
      return;
    }

    const selectedDirtyRows = rows.filter(
      (row) => selected.has(row.id) && (dirtyRows.has(row.id) || !row.submitted)
    );
    const deselectedSubmittedRows = rows.filter((row) => !selected.has(row.id) && row.submitted);

    if (selectedDirtyRows.length === 0 && deselectedSubmittedRows.length === 0) {
      toast.error("No changes to save. Select members or update their details.");
      return;
    }

    setIsSaving(true);
    try {
      // Prepare declarations data
      const declarations = selectedDirtyRows.map((row) => ({
        user_id: row.user_id,
        position_id: row.position_id,
        hours: row.hours,
        justification: row.justification,
        remarks: row.remarks,
      }));
      const deletions = deselectedSubmittedRows.map((row) => ({
        user_id: row.user_id,
        position_id: row.position_id,
      }));

      const response = await fetch(`/api/holidaySubsidy/weekly/${encodeURIComponent(ccaName)}/${weekInfo.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ declarations, deletions }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      const data = await response.json();
      toast.success(data.message || "Changes saved successfully!");
      const updatedRows = rows.map((row) => {
        const wasSaved = selectedDirtyRows.some(
          (saved) => saved.user_id === row.user_id && saved.position_id === row.position_id
        );
        const wasDeleted = deselectedSubmittedRows.some(
          (del) => del.user_id === row.user_id && del.position_id === row.position_id
        );

        if (wasDeleted) {
          return { ...row, submitted: false, status: null };
        }

        if (wasSaved) {
          return { ...row, submitted: true };
        }

        return row;
      });
      setRows(updatedRows);

      const remainingDirtyRows = (() => {
        const next = new Set(dirtyRows);
        selectedDirtyRows.forEach((row) => next.delete(row.id));
        return next;
      })();
      setDirtyRows(remainingDirtyRows);
      setHasUnsavedChanges(remainingDirtyRows.size > 0);
    } catch (err) {
      console.error("Error saving:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleWeekChange = (newIndex: number) => {
    if (!editableWeekIds.includes(HOLIDAY_WEEKS[newIndex]?.id)) {
      toast.error("Weekly declarations are closed for this week.");
      return;
    }

    if (hasUnsavedChanges) {
      if (confirm("You have unsaved changes. Do you want to discard them?")) {
        setWeekIndex(newIndex);
        setHasUnsavedChanges(false);
        setSelected(new Set());
        setDirtyRows(new Set());
      }
    } else {
      setWeekIndex(newIndex);
      setSelected(new Set());
      setDirtyRows(new Set());
    }
  };

  const columns: SelectionTableColumn<WeeklyRow>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Member",
        cell: (_value, row) => (
          <div className="flex flex-col min-w-[180px]">
            <span className="font-semibold text-sm md:text-base leading-tight">{row.name}</span>
            <span className="text-xs text-muted-foreground mt-0.5">{row.email}</span>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: (value) => (
          <div className="min-w-[100px]">
            <PositionTypeBadge value={String(value)} />
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: (value) => (
          <div className="min-w-[110px]">
            <PositionTypeBadge value={String(value)} />
          </div>
        ),
      },
      {
        accessorKey: "hours",
        header: "Hours",
        cell: (_value, row) => (
          <div className="flex items-center gap-2 min-w-[100px]">
            <Input
              type="number"
              min={0}
              max={168}
              step={0.5}
              className="w-20 text-center font-semibold"
              value={row.hours === 0 ? "" : row.hours}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => handleChange(row.id, "hours", e.target.value === "" ? 0 : Number(e.target.value))}
              placeholder="0"
              disabled={!row.has_approved_subsidy || !isWeekOpen}
            />
            <span className="text-xs text-muted-foreground">hrs</span>
          </div>
        ),
      },
      {
        accessorKey: "justification",
        header: "Justification",
        cell: (_value, row) => (
          <div className="min-w-[250px] max-w-[400px]">
            <Textarea
              className="min-h-[70px] resize-none text-sm"
              value={row.justification}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => handleChange(row.id, "justification", e.target.value)}
              placeholder={row.has_approved_subsidy ? "Enter justification for hours worked..." : "No approved subsidy"}
              disabled={!row.has_approved_subsidy || !isWeekOpen}
            />
          </div>
        ),
      },
      {
        accessorKey: "remarks",
        header: "Remarks",
        cell: (_value, row) => (
          <div className="min-w-[250px] max-w-[400px]">
            <Textarea
              className="min-h-[70px] resize-none text-sm"
              value={row.remarks}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => handleChange(row.id, "remarks", e.target.value)}
              placeholder={row.has_approved_subsidy ? "Add any additional remarks..." : "No approved subsidy"}
              disabled={!row.has_approved_subsidy || !isWeekOpen}
            />
          </div>
        ),
      },
    ],
    [handleChange]
  );

  if (isLoading) {
    return (
      <AppLayout>
        <LoadingSpinner message="Loading weekly commitment data..." />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col gap-4 p-6 max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold">Weekly Commitment Declaration</h1>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Link href="/dashboard/holidaySubsidy">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to CCAs
            </Button>
          </Link>
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
              Weekly Commitment Declaration
            </h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base">
              Record and manage weekly hours committed by your CCA members during the holiday period.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="lg"
              className="gap-2 w-full sm:w-auto"
              onClick={(e) => {
                if (hasUnsavedChanges && !confirm("You have unsaved changes. Leave without saving?")) {
                  e.preventDefault();
                } else {
                  window.location.href = "/dashboard/holidaySubsidy";
                }
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to CCAs
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !isWeekOpen || !canSave}
              size="lg"
              className="px-6 shadow-md font-semibold gap-2 disabled:opacity-50 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {!isWeekOpen && (
          <Alert variant="destructive" className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription>
              Weekly declarations are closed for {weekInfo.label}. You can only submit for the current
              week or the previous week until Tuesday 23:59.
            </AlertDescription>
          </Alert>
        )}

        {/* Week Selection Tabs */}
        <div className="space-y-3">
          <Tabs
            value={HOLIDAY_WEEKS[weekIndex].label}
            onValueChange={(val) => {
              const idx = HOLIDAY_WEEKS.findIndex((w) => w.label === val);
              if (idx >= 0) handleWeekChange(idx);
            }}
          >
            <TabsList className="flex flex-wrap gap-2 bg-transparent p-1 border-0 h-auto">
              {HOLIDAY_WEEKS.map((week, idx) => {
                const active = idx === weekIndex;
                return (
                  <TabsTrigger
                    key={week.id}
                    value={week.label}
                    disabled={!editableWeekIds.includes(week.id)}
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
            <CardTitle className="text-xl">Member Commitments - {weekInfo.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <SelectionTable<WeeklyRow, number>
              data={rows}
              columns={columns}
              selectionEnabled={isWeekOpen}
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
                setHasUnsavedChanges(true);
              }}
              idField="id"
              searchColumn="name"
              searchPlaceholder="Search members by name..."
              pageSize={10}
              emptyMessage="No members with approved subsidies for this week."
              tableContainerClassName="border-muted"
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
