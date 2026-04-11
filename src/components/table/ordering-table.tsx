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
    cell?: (value: unknown, row: TData, index: number) => React.ReactNode;
}

interface OrderingTableProps<TData> {
    data: TData[];
    columns: OrderingTableColumn<TData>[];
    onReorder: (newData: TData[]) => void;
    showRankColumn?: boolean;
    emptyMessage?: string;
}

export function OrderingTable<TData extends object>({
    data,
    columns,
    onReorder,
    showRankColumn = true,
    emptyMessage = 'No items to order.',
}: OrderingTableProps<TData>) {
    const DROP_COMMIT_DELAY_MS = 140;
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
    const [isDropPending, setIsDropPending] = React.useState(false);
    const [dropAnimation, setDropAnimation] = React.useState<{
        index: number;
        direction: 'up' | 'down';
    } | null>(null);
    const commitTimerRef = React.useRef<number | null>(null);
    const dropAnimationTimerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        return () => {
            if (commitTimerRef.current !== null) {
                window.clearTimeout(commitTimerRef.current);
            }
            if (dropAnimationTimerRef.current !== null) {
                window.clearTimeout(dropAnimationTimerRef.current);
            }
        };
    }, []);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));

        // Build a custom drag image so pickup feels immediate and more "poppy".
        const sourceRow = e.currentTarget as HTMLTableRowElement;
        const dragPreview = sourceRow.cloneNode(true) as HTMLTableRowElement;
        dragPreview.style.position = 'absolute';
        dragPreview.style.top = '-9999px';
        dragPreview.style.left = '-9999px';
        dragPreview.style.width = `${sourceRow.getBoundingClientRect().width}px`;
        dragPreview.style.background = 'hsl(var(--background))';
        dragPreview.style.opacity = '0.95';
        dragPreview.style.transform = 'scale(1.03)';
        dragPreview.style.boxShadow = '0 16px 38px rgba(2, 132, 199, 0.25)';
        dragPreview.style.border = '1px solid hsl(var(--primary) / 0.35)';
        dragPreview.style.borderRadius = '10px';
        document.body.appendChild(dragPreview);
        e.dataTransfer.setDragImage(dragPreview, 24, 24);

        requestAnimationFrame(() => {
            document.body.removeChild(dragPreview);
        });
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
        if (isDropPending) return;
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();

        if (draggedIndex === null || draggedIndex === dropIndex) {
            setIsDropPending(false);
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const newData = [...data];
        const [draggedItem] = newData.splice(draggedIndex, 1);
        newData.splice(dropIndex, 0, draggedItem);

        const direction = dropIndex > draggedIndex ? 'down' : 'up';
        setIsDropPending(true);
        setDragOverIndex(dropIndex);

        if (commitTimerRef.current !== null) {
            window.clearTimeout(commitTimerRef.current);
        }
        commitTimerRef.current = window.setTimeout(() => {
            onReorder(newData);
            setDropAnimation({ index: dropIndex, direction });
            setDraggedIndex(null);
            setDragOverIndex(null);
            setIsDropPending(false);

            if (dropAnimationTimerRef.current !== null) {
                window.clearTimeout(dropAnimationTimerRef.current);
            }
            dropAnimationTimerRef.current = window.setTimeout(() => {
                setDropAnimation(null);
            }, 380);
        }, DROP_COMMIT_DELAY_MS);

        // Keep drag preview state briefly so rows stay shifted before snapping in.
    };

    const allColumns = React.useMemo(() => {
        const cols: OrderingTableColumn<TData>[] = [];

        if (showRankColumn) {
            cols.push({
                accessorKey: '__rank' as keyof TData,
                header: 'Rank',
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
                        const isDropAnimatedRow = dropAnimation?.index === rowIndex;
                        const shiftDown =
                            draggedIndex !== null &&
                            dragOverIndex !== null &&
                            draggedIndex < dragOverIndex &&
                            rowIndex > draggedIndex &&
                            rowIndex <= dragOverIndex;
                        const shiftUp =
                            draggedIndex !== null &&
                            dragOverIndex !== null &&
                            draggedIndex > dragOverIndex &&
                            rowIndex < draggedIndex &&
                            rowIndex >= dragOverIndex;
                        const dropAnimationStyle: React.CSSProperties | undefined = isDropAnimatedRow
                            ? {
                                animation: dropAnimation.direction === 'down'
                                    ? 'ordering-drop-down 360ms cubic-bezier(0.22,1,0.36,1)'
                                    : 'ordering-drop-up 360ms cubic-bezier(0.22,1,0.36,1)',
                            }
                            : undefined;

                        return (
                            <TableRow
                                key={rowIndex}
                                draggable={!isDropPending}
                                onDragStart={(e) => handleDragStart(e, rowIndex)}
                                onDragOver={(e) => handleDragOver(e, rowIndex)}
                                onDragLeave={handleDragLeave}
                                onDragEnd={handleDragEnd}
                                onDrop={(e) => handleDrop(e, rowIndex)}
                                style={dropAnimationStyle}
                                className={`cursor-move select-none transform-gpu transition-[transform,opacity,box-shadow,background-color,border-color] duration-120 ease-[cubic-bezier(0.22,1,0.36,1)] ${isDragging
                                    ? 'opacity-95 scale-[1.01] bg-primary/10 shadow-[0_16px_38px_rgba(2,132,199,0.24)] ring-2 ring-primary/55'
                                    : isDragOver
                                        ? 'border-t-4 border-primary bg-primary/20 shadow-[inset_0_4px_0_0_hsl(var(--primary)),0_0_0_1px_hsl(var(--primary)/0.35)]'
                                        : isDropAnimatedRow
                                            ? 'bg-primary/20 ring-1 ring-primary/45'
                                        : shiftDown
                                            ? 'translate-y-2 bg-primary/[0.08]'
                                            : shiftUp
                                                ? '-translate-y-2 bg-primary/[0.08]'
                                                : 'hover:bg-muted/60'
                                    }`}
                            >
                                <TableCell className="w-12">
                                    <div className="cursor-grab active:cursor-grabbing">
                                        <GripVertical
                                            className={`h-5 w-5 transition-colors duration-100 ${isDragging || isDragOver ? 'text-primary' : 'text-muted-foreground'}`}
                                        />
                                    </div>
                                </TableCell>
                                {allColumns.map((col, colIndex) => {
                                    const value = col.accessorKey === '__rank'
                                        ? null
                                        : (row as Record<keyof TData, unknown>)[col.accessorKey];
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
            <style jsx>{`
                @keyframes ordering-drop-down {
                    0% {
                        transform: translateY(-18px) scale(1.02);
                        box-shadow: 0 18px 42px rgba(2, 132, 199, 0.28);
                    }
                    62% {
                        transform: translateY(3px) scale(1.008);
                        box-shadow: 0 10px 24px rgba(2, 132, 199, 0.2);
                    }
                    100% {
                        transform: translateY(0) scale(1);
                        box-shadow: 0 0 0 rgba(2, 132, 199, 0);
                    }
                }

                @keyframes ordering-drop-up {
                    0% {
                        transform: translateY(18px) scale(1.02);
                        box-shadow: 0 18px 42px rgba(2, 132, 199, 0.28);
                    }
                    62% {
                        transform: translateY(-3px) scale(1.008);
                        box-shadow: 0 10px 24px rgba(2, 132, 199, 0.2);
                    }
                    100% {
                        transform: translateY(0) scale(1);
                        box-shadow: 0 0 0 rgba(2, 132, 199, 0);
                    }
                }
            `}</style>
        </div>
    );
}
