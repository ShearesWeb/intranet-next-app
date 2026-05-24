"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DataTableToolbar } from "@/components/table/data-table-toolbar";
import { DataTablePagination } from "@/components/table/data-table-pagination";

/** Re-export ColumnDef for convenience so consumers only need one import. */
export type { ColumnDef as DataTableColumnDef } from "@tanstack/react-table";

interface DataTableProps<TData, TId = number | string> {
  data: TData[];
  columns: ColumnDef<TData>[];
  searchColumn?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: string;
  className?: string;
  tableContainerClassName?: string;
  tableClassName?: string;
  tablePadding?: string;
  /** Initial column visibility. Keys are column accessor keys. */
  initialColumnVisibility?: VisibilityState;
  /** Enable row selection with checkboxes. */
  selectable?: boolean;
  selectedIds?: Set<TId>;
  onSelectionChange?: (id: TId) => void;
  idField?: keyof TData;
}

export function DataTable<TData extends object, TId = number | string>({
  data,
  columns,
  searchColumn,
  searchPlaceholder = "Search...",
  pageSize = 10,
  emptyMessage = "No results.",
  className,
  tableContainerClassName,
  tableClassName,
  tablePadding = "[&_th]:px-5 [&_td]:px-5 py-3",
  initialColumnVisibility,
  selectable = false,
  selectedIds,
  onSelectionChange,
  idField = "id" as keyof TData,
}: DataTableProps<TData, TId>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    () => initialColumnVisibility ?? {},
  );
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const selectionActive = selectable || (!!selectedIds && !!onSelectionChange);

  const tableColumns = React.useMemo(() => {
    if (!selectionActive) return columns;

    const selectCol: ColumnDef<TData> = {
      id: "select",
      header: ({ table }) => {
        const visibleRows = table.getRowModel().rows;
        const allSelected =
          visibleRows.length > 0 &&
          visibleRows.every((row) => selectedIds?.has(row.original[idField] as TId));
        const someSelected = visibleRows.some((row) =>
          selectedIds?.has(row.original[idField] as TId),
        );
        return (
          <Checkbox
            checked={allSelected || (someSelected && "indeterminate")}
            onCheckedChange={(value) => {
              if (!onSelectionChange || !selectedIds) return;
              visibleRows.forEach((row) => {
                const rowId = row.original[idField] as TId;
                const currentlySelected = selectedIds.has(rowId);
                if (value && !currentlySelected) {
                  onSelectionChange(rowId);
                } else if (!value && currentlySelected) {
                  onSelectionChange(rowId);
                }
              });
            }}
            aria-label="Select all"
          />
        );
      },
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds?.has(row.original[idField] as TId)}
          onCheckedChange={() => {
            const rowId = row.original[idField] as TId;
            onSelectionChange?.(rowId);
          }}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };

    return [selectCol, ...columns];
  }, [columns, selectionActive, selectedIds, onSelectionChange, idField]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
  });

  return (
    <div className={cn("w-full flex flex-col gap-4", className)}>
      <DataTableToolbar
        table={table}
        searchColumn={searchColumn}
        searchPlaceholder={searchPlaceholder}
      />

      <div className={cn("rounded-lg border overflow-x-auto shadow-sm", tableContainerClassName)}>
        <Table className={cn(tablePadding, tableClassName)}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const id = row.original[idField] as TId;
                const isSelected = selectionActive && selectedIds?.has(id);
                const rowClickable = selectionActive && !!onSelectionChange;

                return (
                  <TableRow
                    key={row.id}
                    data-state={isSelected && "selected"}
                    className={cn(
                      "transition-colors hover:bg-muted/50",
                      isSelected && "bg-orange-50",
                      rowClickable && "cursor-pointer",
                    )}
                    onClick={
                      rowClickable
                        ? (event) => {
                            const target = event.target as HTMLElement;
                            if (
                              target.closest(
                                'input, textarea, button, select, [role="textbox"], [contenteditable="true"]',
                              )
                            ) {
                              return;
                            }
                            onSelectionChange?.(id);
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />
    </div>
  );
}
