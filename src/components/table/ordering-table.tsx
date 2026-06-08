"use client";

import * as React from "react";
import { GripVertical, ArrowUpToLine, ArrowDownToLine, Search } from "lucide-react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
	/** Show a search box that filters visible rows (opt-in). Filtering is view-only
	 * and disables reordering while active so a filtered drag can't corrupt order. */
	searchable?: boolean;
	searchPlaceholder?: string;
	/** Show per-row move-to-top / move-to-bottom buttons for fast reordering of long
	 * lists without dragging (opt-in). */
	showMoveControls?: boolean;
}

export function OrderingTable<TData extends object>({
	data,
	columns,
	onReorder,
	showRankColumn = true,
	emptyMessage = "No items to order.",
	draggable = true,
	searchable = false,
	searchPlaceholder = "Search...",
	showMoveControls = false,
}: OrderingTableProps<TData>) {
	const { draggedIndex, dragOverIndex, dropAnimation, getDragHandlers, getRowShift } =
		useDragReorder(data, onReorder);

	const [query, setQuery] = React.useState("");
	const isFiltering = searchable && query.trim() !== "";

	// While filtering, reordering is ambiguous (rows are hidden), so disable it.
	const dragEnabled = draggable && !isFiltering;
	const moveEnabled = showMoveControls && !isFiltering;
	const hasControlsCol = dragEnabled || showMoveControls;

	const moveTo = React.useCallback(
		(from: number, to: number) => {
			if (!onReorder || from === to) return;
			const next = [...data];
			const [item] = next.splice(from, 1);
			next.splice(to, 0, item);
			onReorder(next);
		},
		[data, onReorder],
	);

	// Keep the true index from `data` so rank numbers and drag/move operate on the
	// real order even when the view is filtered.
	const visibleRows = React.useMemo(() => {
		const indexed = data.map((row, index) => ({ row, index }));
		if (!isFiltering) return indexed;
		const q = query.trim().toLowerCase();
		return indexed.filter(({ row }) =>
			Object.values(row as Record<string, unknown>).some(
				(v) => typeof v === "string" && v.toLowerCase().includes(q),
			),
		);
	}, [data, isFiltering, query]);

	const allColumns = React.useMemo(() => {
		const cols: OrderingTableColumn<TData>[] = [];

		if (showRankColumn) {
			cols.push({
				accessorKey: "__rank" as keyof TData,
				header: "Rank",
				cell: (_value: unknown, _row: TData, index: number) => (
					<div className="flex">
						<div className="flex items-center justify-center size-9 rounded-full bg-gradient-to-br from-primary to-orange-600 text-primary-foreground font-bold text-sm shadow-sm">
							{index + 1}
						</div>
					</div>
				),
			});
		}

		return [...cols, ...columns];
	}, [columns, showRankColumn]);

	const searchBox = searchable ? (
		<div className="relative">
			<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder={searchPlaceholder}
				className="pl-8"
			/>
		</div>
	) : null;

	if (data.length === 0) {
		const colSpan = allColumns.length + (hasControlsCol ? 1 : 0);
		return (
			<div className="flex flex-col gap-3">
				{searchBox}
				<div className="rounded-lg border overflow-x-auto shadow-sm">
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
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{searchBox}
			{isFiltering && (
				<p className="text-xs text-muted-foreground">
					Showing {visibleRows.length} of {data.length}. Clear search to reorder.
				</p>
			)}
			<div className="rounded-lg border overflow-x-auto shadow-sm">
				<Table>
					<TableHeader>
						<TableRow>
							{hasControlsCol && <TableHead className="w-12"></TableHead>}
							{allColumns.map((col, idx) => (
								<TableHead key={idx} className="font-semibold">
									{col.header}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{visibleRows.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={allColumns.length + (hasControlsCol ? 1 : 0)}
									className="h-24 text-center text-muted-foreground"
								>
									No matches.
								</TableCell>
							</TableRow>
						) : (
							visibleRows.map(({ row, index: rowIndex }) => {
								const isDragging = dragEnabled && draggedIndex === rowIndex;
								const isDragOver = dragEnabled && dragOverIndex === rowIndex;
								const isDropAnimatedRow = dragEnabled && dropAnimation?.index === rowIndex;
								const shift = dragEnabled ? getRowShift(rowIndex) : null;
								const dropAnimationStyle: React.CSSProperties | undefined = isDropAnimatedRow
									? {
											animation:
												dropAnimation!.direction === "down"
													? "ordering-drop-down 360ms cubic-bezier(0.22,1,0.36,1)"
													: "ordering-drop-up 360ms cubic-bezier(0.22,1,0.36,1)",
										}
									: undefined;

								const dragHandlers = dragEnabled ? getDragHandlers(rowIndex) : {};

								return (
									<TableRow
										key={rowIndex}
										{...dragHandlers}
										style={dropAnimationStyle}
										className={`group select-none transform-gpu transition-[transform,opacity,box-shadow,background-color,border-color] duration-120 ease-[cubic-bezier(0.22,1,0.36,1)] ${dragEnabled ? "cursor-move" : ""} ${
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
										{hasControlsCol && (
											<TableCell className="w-12">
												<div className="flex items-center gap-1">
													{dragEnabled && (
														<div className="cursor-grab active:cursor-grabbing">
															<GripVertical
																className={`size-5 transition-all duration-100 ${isDragging || isDragOver ? "scale-125 text-primary" : "text-muted-foreground group-hover:scale-125 group-hover:text-primary"}`}
															/>
														</div>
													)}
													{showMoveControls && (
														<div className="flex flex-col">
															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="h-5 w-5 text-muted-foreground hover:text-primary"
																disabled={!moveEnabled || rowIndex === 0}
																onClick={() => moveTo(rowIndex, 0)}
																title="Move to top"
															>
																<ArrowUpToLine className="h-3.5 w-3.5" />
															</Button>
															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="h-5 w-5 text-muted-foreground hover:text-primary"
																disabled={!moveEnabled || rowIndex === data.length - 1}
																onClick={() => moveTo(rowIndex, data.length - 1)}
																title="Move to bottom"
															>
																<ArrowDownToLine className="h-3.5 w-3.5" />
															</Button>
														</div>
													)}
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
							})
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
