"use client";

import React, { useCallback, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectionTable, type SelectionTableColumn } from "@/components/table/selection-table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
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
};

const weekMeta = [
  { id: 1, label: "Week 1", range: "4 Dec - 10 Dec" },
  { id: 2, label: "Week 2", range: "11 Dec - 17 Dec" },
  { id: 3, label: "Week 3", range: "18 Dec - 24 Dec" },
  { id: 4, label: "Week 4", range: "25 Dec - 31 Dec" },
  { id: 5, label: "Week 5", range: "1 Jan - 7 Jan" },
  { id: 6, label: "Week 6", range: "8 Jan - 14 Jan" },
];

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
  },
];

export default function WeeklyCommitmentPage() {
  const [weekIndex, setWeekIndex] = useState(0);
  const [rows, setRows] = useState<WeeklyRow[]>(mockRows);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const weekInfo = weekMeta[weekIndex];

  const handleChange = useCallback((id: number, key: keyof WeeklyRow, value: string | number) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Changes saved successfully!");
      setHasUnsavedChanges(false);
    } catch {
      toast.error("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleWeekChange = (newIndex: number) => {
    if (hasUnsavedChanges) {
      if (confirm("You have unsaved changes. Do you want to discard them?")) {
        setWeekIndex(newIndex);
        setHasUnsavedChanges(false);
        setSelected(new Set());
      }
    } else {
      setWeekIndex(newIndex);
      setSelected(new Set());
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
              placeholder="Enter justification for hours worked..."
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
              placeholder="Add any additional remarks..."
            />
          </div>
        ),
      },
    ],
    [handleChange]
  );

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
            <Link href="/dashboard/holidaySubsidy">
              <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4" />
                Back to CCAs
              </Button>
            </Link>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-6 shadow-md font-semibold gap-2 disabled:opacity-50 w-full sm:w-auto"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Week Selection Tabs */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Select Week</h2>
          
          <Tabs
            value={weekMeta[weekIndex].label}
            onValueChange={(val) => {
              const idx = weekMeta.findIndex((w) => w.label === val);
              if (idx >= 0) handleWeekChange(idx);
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
            <CardTitle className="text-xl">Member Commitments - {weekInfo.label}</CardTitle>
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
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
