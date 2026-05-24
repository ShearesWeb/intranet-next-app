"use client";

import { type Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex + 1;

  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <div className="text-xs font-medium text-muted-foreground tabular-nums">
        Page {currentPage} of {pageCount}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="h-8 px-3 text-xs"
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="h-8 px-3 text-xs"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
