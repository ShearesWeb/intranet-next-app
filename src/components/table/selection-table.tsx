'use client';

import * as React from 'react';
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    PaginationState,
} from '@tanstack/react-table';
import { ChevronDown, Search, ArrowUpDown } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface SelectionTableColumn<TData> {
    accessorKey: keyof TData;
    header: string;
    cell?: (value: any, row: TData) => React.ReactNode;
    enableSorting?: boolean;
    hidden?: boolean;
}

interface SelectionTableProps<TData, TId = number | string> {
    data: TData[];
    columns: SelectionTableColumn<TData>[];
    searchColumn?: keyof TData;
    searchPlaceholder?: string;
    pageSize?: number;
    emptyMessage?: string;
    className?: string;
    tableContainerClassName?: string;
    tableClassName?: string;
    tablePadding?: string;
    selectionEnabled?: boolean;
    selectedIds?: Set<TId>;
    onSelectionChange?: (id: TId) => void;
    idField?: keyof TData;
}

export function SelectionTable<TData extends Record<string, any>, TId = number | string>({
    data,
    columns,
    searchColumn,
    searchPlaceholder = 'Search...',
    pageSize = 10,
    emptyMessage = 'No results.',
    className,
    tableContainerClassName,
    tableClassName,
    tablePadding = "[&_th]:px-5 [&_td]:px-5 py-3",
    selectionEnabled = false,
    selectedIds,
    onSelectionChange,
    idField = 'id' as keyof TData,
}: SelectionTableProps<TData, TId>) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => {
        const visibility: VisibilityState = {};
        columns.forEach((col) => {
            if (col.hidden) {
                visibility[col.accessorKey as string] = false;
            }
        });
        return visibility;
    });
    const [pagination, setPagination] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize,
    });

    // Enable selection if selection props are provided, or explicitly toggled on.
    const selectionActive = (!!selectedIds && !!onSelectionChange) || selectionEnabled;

    const baseColumns: ColumnDef<TData>[] = React.useMemo(() => {
        return columns.map((col) => {
            const enableSort = col.enableSorting !== false;
            return {
                accessorKey: col.accessorKey as string,
                header: ({ column }) => {
                    if (!enableSort) {
                        return <div className="font-semibold">{col.header}</div>;
                    }
                    return (
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">{col.header}</span>
                            <Button
                                variant="ghost"
                                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                                className="h-8 w-8 p-0"
                            >
                                <ArrowUpDown className="h-4 w-4" />
                            </Button>
                        </div>
                    );
                },
                cell: ({ row }) => {
                    const value = row.getValue(col.accessorKey as string);
                    if (col.cell) {
                        return col.cell(value, row.original);
                    }
                    return <div>{value as React.ReactNode}</div>;
                },
                enableSorting: enableSort,
            } as ColumnDef<TData>;
        });
    }, [columns]);

    const tableColumns = React.useMemo(() => {
        if (!selectionActive) return baseColumns;

        const selectCol: ColumnDef<TData> = {
            id: 'select',
            header: ({ table }) => {
                const visibleRows = table.getRowModel().rows;
                const allSelected =
                    visibleRows.length > 0 &&
                    visibleRows.every((row) => selectedIds?.has(row.original[idField] as TId));
                const someSelected =
                    visibleRows.some((row) => selectedIds?.has(row.original[idField] as TId));
                return (
                    <Checkbox
                        checked={allSelected || (someSelected && 'indeterminate')}
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

        return [selectCol, ...baseColumns];
    }, [baseColumns, selectionActive, selectedIds, onSelectionChange, idField]);

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
        <div className={cn("w-full space-y-4", className)}>
            {/* Toolbar */}
            <div className="flex items-center gap-2">
                {searchColumn && (
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={(table.getColumn(searchColumn as string)?.getFilterValue() as string) ?? ''}
                            onChange={(event) =>
                                table.getColumn(searchColumn as string)?.setFilterValue(event.target.value)
                            }
                            className="pl-9"
                        />
                    </div>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="ml-auto">
                            Columns <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    className="capitalize"
                                    checked={column.getIsVisible()}
                                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                >
                                    {column.id.replace(/_/g, ' ')}
                                </DropdownMenuCheckboxItem>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Table */}
            <div className={cn("rounded-md border overflow-hidden", tableContainerClassName)}>
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
                                        data-state={isSelected && 'selected'}
                                        className={cn(
                                            "transition-colors hover:bg-muted/50",
                                            isSelected && "bg-orange-50",
                                            rowClickable && "cursor-pointer"
                                        )}
                                        onClick={
                                            rowClickable
                                                ? (event) => {
                                                    const target = event.target as HTMLElement;
                                                    if (target.closest('input, textarea, button, select, [role="textbox"], [contenteditable="true"]')) {
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

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
