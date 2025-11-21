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
import { cn } from '@/lib/utils';

export interface SimpleTableColumn<TData> {
    accessorKey: keyof TData;
    header: string;
    cell?: (value: any, row: TData) => React.ReactNode;
    enableSorting?: boolean;
    hidden?: boolean;
}

interface SimpleTableProps<TData> {
    data: TData[];
    columns: SimpleTableColumn<TData>[];
    searchColumn?: keyof TData;
    searchPlaceholder?: string;
    pageSize?: number;
    emptyMessage?: string;
    className?: string;
    tableContainerClassName?: string;
    tableClassName?: string;
    tablePadding?: string;
}

export function SimpleTable<TData extends Record<string, any>>({
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
}: SimpleTableProps<TData>) {
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

    // Build column definitions
    const tableColumns: ColumnDef<TData>[] = React.useMemo(() => {
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
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
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
