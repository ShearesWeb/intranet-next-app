"use client";

import React, { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectionTable, type SelectionTableColumn } from "@/components/table/selection-table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Copy, Info } from "lucide-react";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

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

const tabs = [
  {
    name: "pnpm",
    value: "pnpm",
    content: "pnpm dlx shadcn@latest add tabs",
  },
  {
    name: "npm",
    value: "npm",
    content: "npx shadcn@latest add tabs",
  },
  {
    name: "yarn",
    value: "yarn",
    content: "npx shadcn@latest add tabs",
  },
  {
    name: "bun",
    value: "bun",
    content: "bunx --bun shadcn@latest add tabs",
  },
];

const weekMeta = [
  { label: "Week 1", range: "6 Dec - 12 Dec" },
  { label: "Week 2", range: "13 Dec - 19 Dec" },
  { label: "Week 3", range: "20 Dec - 26 Dec" },
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

  const weekInfo = weekMeta[weekIndex];

  const handleChange = (id: number, key: keyof WeeklyRow, value: string | number) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  const columns: SelectionTableColumn<WeeklyRow>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Member",
        cell: (_value, row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-sm md:text-base leading-tight">{row.name}</span>
            <span className="text-xs text-muted-foreground">{row.email}</span>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: (value) => <PositionTypeBadge value={String(value)} />,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: (value) => <PositionTypeBadge value={String(value)} />,
      },
      {
        accessorKey: "hours",
        header: "Hours",
        cell: (_value, row) => (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              className="w-24"
              value={row.hours}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => handleChange(row.id, "hours", Number(e.target.value) || 0)}
            />
          </div>
        ),
      },
      {
        accessorKey: "justification",
        header: "Justification",
        cell: (_value, row) => (
          <Textarea
            className="min-h-[60px]"
            value={row.justification}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onChange={(e) => {
              handleChange(row.id, "justification", e.target.value)
            }}
          />
        ),
      },
      {
        accessorKey: "remarks",
        header: "Remarks",
        cell: (_value, row) => (
          <Textarea
            className="min-h-[60px]"
            value={row.remarks}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => handleChange(row.id, "remarks", e.target.value)}
          />
        ),
      },
    ],
    []
  );

  return (
    <AppLayout>
      <div className="flex flex-col space-y-6 p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Weekly Commitment Declaration</h1>
            <p className="text-gray-600 mt-1">
              Update hours, justification, and remarks per member.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/holidaySubsidy">
              <Button variant="outline">
                ← Back to CCAs
              </Button>
            </Link>
          </div>
        </div>

        <Tabs
          value={weekMeta[weekIndex].label}
          onValueChange={(val) => {
            const idx = weekMeta.findIndex((w) => w.label === val);
            if (idx >= 0) setWeekIndex(idx);
          }}
        >
          <TabsList className="flex gap-2 bg-transparent p-1 border-0">
            {weekMeta.map((week) => {
              const active = week.label === weekMeta[weekIndex].label;
              return (
                <TabsTrigger
                  key={week.label}
                  value={week.label}
                  className="flex flex-col items-start gap-1 px-5 py-3 rounded-lg border data-[state=inactive]:bg-background data-[state=inactive]:text-foreground data-[state=inactive]:border-muted/60 data-[state=inactive]:hover:border-muted-foreground/60 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                >
                  <span className="text-sm font-semibold">{week.label}</span>
                  <span className={`text-[11px] ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                    {week.range}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <Card className="border shadow-sm">
          <CardHeader >
            <CardTitle>Committed Hours</CardTitle>
            <CardDescription className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Edit hours and remarks directly in the table.
              </div>
              <Button
                variant="default"
                className="bg-green-500 text-white hover:bg-green-400 px-6 py-4 shadow-md font-bold cursor-pointer"
              >
                Save Changes
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SelectionTable<WeeklyRow, number>
              data={rows}
              columns={columns}
              selectionEnabled
              selectedIds={selected}
              onSelectionChange={(id) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                })
              }
              idField="id"
              searchColumn="name"
              searchPlaceholder="Search members..."
              pageSize={5}
              emptyMessage="No members found."
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
