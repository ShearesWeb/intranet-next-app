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
    selectedIds: Set<TId>;
    onSelectionChange: (id: TId) => void;
    idField?: keyof TData;
    searchColumn?: keyof TData;
    searchPlaceholder?: string;
    pageSize?: number;
    emptyMessage?: string;
}

export function SelectionTable<TData extends Record<string, any>, TId = number | string>({
    data,
    columns,
    selectedIds,
    onSelectionChange,
    idField = 'id' as keyof TData,
    searchColumn,
    searchPlaceholder = 'Search...',
    pageSize = 10,
    emptyMessage = 'No results.',
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
    const [rowSelection, setRowSelection] = React.useState({});
    const [pagination, setPagination] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize: pageSize,
    });

    // Build column definitions with auto-generated headers
    const tableColumns: ColumnDef<TData>[] = React.useMemo(() => {
        const cols: ColumnDef<TData>[] = [
            {
                id: 'select',
                header: ({ table }) => (
                    <Checkbox
                        checked={
                            table.getIsAllPageRowsSelected() ||
                            (table.getIsSomePageRowsSelected() && 'indeterminate')
                        }
                        onCheckedChange={(value) => {
                            table.toggleAllPageRowsSelected(!!value);
                            const visibleRows = table.getRowModel().rows;
                            visibleRows.forEach((row) => {
                                onSelectionChange(row.original[idField] as TId);
                            });
                        }}
                        aria-label="Select all"
                    />
                ),
                cell: ({ row }) => (
                    <Checkbox
                        checked={selectedIds.has(row.original[idField] as TId)}
                        onCheckedChange={(value) => {
                            row.toggleSelected(!!value);
                            onSelectionChange(row.original[idField] as TId);
                        }}
                        aria-label="Select row"
                        onClick={(e) => e.stopPropagation()}
                    />
                ),
                enableSorting: false,
                enableHiding: false,
            },
        ];

        columns.forEach((col) => {
            const enableSort = col.enableSorting !== false;
            cols.push({
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
            });
        });

        return cols;
    }, [columns, selectedIds, onSelectionChange, idField]);

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
        onRowSelectionChange: setRowSelection,
        onPaginationChange: setPagination,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            pagination,
        },
    });

    return (
        <div className="w-full space-y-4">
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
                            .map((column) => {
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                    >
                                        {column.id.replace(/_/g, ' ')}
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => {
                                const id = row.original[idField] as TId;
                                const isSelected = selectedIds.has(id);
                                return (
                                    <TableRow
                                        key={row.id}
                                        data-state={isSelected && 'selected'}
                                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? 'bg-blue-50' : ''
                                            }`}
                                        onClick={() => {
                                            row.toggleSelected(!isSelected);
                                            onSelectionChange(id);
                                        }}
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
                <div className="flex-1 text-sm text-muted-foreground">
                    {selectedIds.size} of {table.getFilteredRowModel().rows.length} row(s) selected.
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
                    <div className="text-sm text-muted-foreground">
                        Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                    </div>
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
