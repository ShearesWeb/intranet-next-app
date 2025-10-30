'use client';

import * as React from 'react';
import { GripVertical } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export interface OrderingTableColumn<TData> {
    accessorKey: keyof TData;
    header: string;
    cell?: (value: any, row: TData, index: number) => React.ReactNode;
}

interface OrderingTableProps<TData> {
    data: TData[];
    columns: OrderingTableColumn<TData>[];
    onReorder: (newData: TData[]) => void;
    showRankColumn?: boolean;
    emptyMessage?: string;
}

export function OrderingTable<TData extends Record<string, any>>({
    data,
    columns,
    onReorder,
    showRankColumn = true,
    emptyMessage = 'No items to order.',
}: OrderingTableProps<TData>) {
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.toString());
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();

        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const newData = [...data];
        const [draggedItem] = newData.splice(draggedIndex, 1);
        newData.splice(dropIndex, 0, draggedItem);

        onReorder(newData);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const allColumns = React.useMemo(() => {
        const cols: OrderingTableColumn<TData>[] = [];

        if (showRankColumn) {
            cols.push({
                accessorKey: '__rank' as keyof TData,
                header: 'Rank',
                cell: (_value: any, _row: TData, index: number) => (
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
        return (
            <div className="rounded-md border">
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell className="h-24 text-center">{emptyMessage}</TableCell>
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
                        <TableHead className="w-12"></TableHead>
                        {allColumns.map((col, idx) => (
                            <TableHead key={idx} className="font-semibold">
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row, rowIndex) => {
                        const isDragging = draggedIndex === rowIndex;
                        const isDragOver = dragOverIndex === rowIndex;

                        return (
                            <TableRow
                                key={rowIndex}
                                draggable
                                onDragStart={(e) => handleDragStart(e, rowIndex)}
                                onDragOver={(e) => handleDragOver(e, rowIndex)}
                                onDragLeave={handleDragLeave}
                                onDragEnd={handleDragEnd}
                                onDrop={(e) => handleDrop(e, rowIndex)}
                                className={`cursor-move transition-all ${isDragging
                                    ? 'opacity-50 bg-muted'
                                    : isDragOver
                                        ? 'border-t-2 border-primary bg-blue-50'
                                        : 'hover:bg-muted/50'
                                    }`}
                            >
                                <TableCell className="w-12">
                                    <div className="cursor-grab active:cursor-grabbing">
                                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                </TableCell>
                                {allColumns.map((col, colIndex) => {
                                    const value = col.accessorKey === '__rank' ? null : row[col.accessorKey];
                                    return (
                                        <TableCell key={colIndex}>
                                            {col.cell
                                                ? col.cell(value, row, rowIndex)
                                                : <div>{value as React.ReactNode}</div>
                                            }
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
