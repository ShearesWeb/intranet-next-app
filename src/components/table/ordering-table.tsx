"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDragReorder } from "@/components/table/use-drag-reorder";

export interface OrderingTableColumn<TData> {
  accessorKey: keyof TData;
  header: string;
  cell?: (value: unknown, row: TData, index: number) => React.ReactNode;
}

interface OrderingTableProps<TData> {
  data: TData[];
  columns: OrderingTableColumn<TData>[];
  onReorder?: (newData: TData[]) => void;
  showRankColumn?: boolean;
  emptyMessage?: string;
  draggable?: boolean;
}

export function OrderingTable<TData extends object>({
  data,
  columns,
  onReorder,
  showRankColumn = true,
  emptyMessage = "No items to order.",
  draggable = true,
}: OrderingTableProps<TData>) {
  const {
    draggedIndex,
    dragOverIndex,
    dropAnimation,
    getDragHandlers,
    getRowShift,
  } = useDragReorder(data, onReorder);

  const allColumns = React.useMemo(() => {
    const cols: OrderingTableColumn<TData>[] = [];

    if (showRankColumn) {
      cols.push({
        accessorKey: "__rank" as keyof TData,
        header: "Rank",
        cell: (_value: unknown, _row: TData, index: number) => (
          <div className="flex">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">
              {index + 1}
            </div>
          </div>
        ),
      });
    }

    return [...cols, ...columns];
  }, [columns, showRankColumn]);

  if (data.length === 0) {
    const colSpan = allColumns.length + (draggable ? 1 : 0);
    return (
      <div className="rounded-md border">
        <Table>
          <TableBody>
            <TableRow>
              <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {draggable && <TableHead className="w-12"></TableHead>}
            {allColumns.map((col, idx) => (
              <TableHead key={idx} className="font-semibold">
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => {
            const isDragging = draggable && draggedIndex === rowIndex;
            const isDragOver = draggable && dragOverIndex === rowIndex;
            const isDropAnimatedRow = draggable && dropAnimation?.index === rowIndex;
            const shift = draggable ? getRowShift(rowIndex) : null;
            const dropAnimationStyle: React.CSSProperties | undefined = isDropAnimatedRow
              ? {
                  animation:
                    dropAnimation!.direction === "down"
                      ? "ordering-drop-down 360ms cubic-bezier(0.22,1,0.36,1)"
                      : "ordering-drop-up 360ms cubic-bezier(0.22,1,0.36,1)",
                }
              : undefined;

            const dragHandlers = draggable ? getDragHandlers(rowIndex) : {};

            return (
              <TableRow
                key={rowIndex}
                {...dragHandlers}
                style={dropAnimationStyle}
                className={`select-none transform-gpu transition-[transform,opacity,box-shadow,background-color,border-color] duration-120 ease-[cubic-bezier(0.22,1,0.36,1)] ${draggable ? "cursor-move" : ""} ${
                  isDragging
                    ? "opacity-95 scale-[1.01] bg-primary/10 shadow-[0_16px_38px_rgba(234,88,12,0.24)] ring-2 ring-primary/55"
                    : isDragOver
                      ? "border-t-4 border-primary bg-primary/20 shadow-[inset_0_4px_0_0_hsl(var(--primary)),0_0_0_1px_hsl(var(--primary)/0.35)]"
                      : isDropAnimatedRow
                        ? "bg-primary/20 ring-1 ring-primary/45"
                        : shift === "down"
                          ? "translate-y-2 bg-primary/[0.08]"
                          : shift === "up"
                            ? "-translate-y-2 bg-primary/[0.08]"
                            : "hover:bg-muted/60"
                }`}
              >
                {draggable && (
                  <TableCell className="w-12">
                    <div className="cursor-grab active:cursor-grabbing">
                      <GripVertical
                        className={`h-5 w-5 transition-colors duration-100 ${isDragging || isDragOver ? "text-primary" : "text-muted-foreground"}`}
                      />
                    </div>
                  </TableCell>
                )}
                {allColumns.map((col, colIndex) => {
                  const value =
                    col.accessorKey === "__rank"
                      ? null
                      : (row as Record<keyof TData, unknown>)[col.accessorKey];
                  return (
                    <TableCell key={colIndex}>
                      {col.cell ? (
                        col.cell(value, row, rowIndex)
                      ) : (
                        <div>{value as React.ReactNode}</div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
