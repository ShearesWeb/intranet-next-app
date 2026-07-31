"use client";

import { cn } from "@/lib/utils";
import {
	WEEKDAY_HEADERS,
	formatDateKey,
	getDaysInMonth,
	getFirstDayOfMonth,
	getMonthLabel,
	todayKey,
} from "@/lib/date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MonthGridDot {
	key: string;
	color: string;
}

interface MonthGridLegendItem {
	label: string;
	color: string;
}

interface MonthGridProps {
	year: number;
	month: number;
	selectedDate: string | null;
	/** Colored dots to render under a given "YYYY-MM-DD" cell. */
	getDots: (dateKey: string) => MonthGridDot[];
	onSelectDate: (date: string) => void;
	onChangeMonth: (year: number, month: number) => void;
	/** Ring days that have dots, so populated days stand out (subsidy calendar). */
	ringDatesWithDots?: boolean;
	legend?: MonthGridLegendItem[];
}

export function MonthGrid({
	year,
	month,
	selectedDate,
	getDots,
	onSelectDate,
	onChangeMonth,
	ringDatesWithDots = false,
	legend,
}: MonthGridProps) {
	const daysInMonth = getDaysInMonth(year, month);
	const firstDay = getFirstDayOfMonth(year, month);
	const today = todayKey();

	function prevMonth() {
		const m = month === 0 ? 11 : month - 1;
		const y = month === 0 ? year - 1 : year;
		onChangeMonth(y, m);
	}

	function nextMonth() {
		const m = month === 11 ? 0 : month + 1;
		const y = month === 11 ? year + 1 : year;
		onChangeMonth(y, m);
	}

	const cells: (number | null)[] = [];
	for (let i = 0; i < firstDay; i++) cells.push(null);
	for (let d = 1; d <= daysInMonth; d++) cells.push(d);

	return (
		<div className="w-full">
			<div className="mb-3 flex items-center justify-between">
				<Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<span className="text-sm font-semibold">{getMonthLabel(year, month)}</span>
				<Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
					<ChevronRight className="h-4 w-4" />
				</Button>
			</div>

			<div className="grid grid-cols-7 gap-px">
				{WEEKDAY_HEADERS.map((wd) => (
					<div key={wd} className="py-1 text-center text-[10px] font-medium text-muted-foreground">
						{wd}
					</div>
				))}

				{cells.map((day, i) => {
					if (day === null) {
						return <div key={`empty-${i}`} className="aspect-square" />;
					}

					const dateKey = formatDateKey(year, month, day);
					const isToday = dateKey === today;
					const isSelected = dateKey === selectedDate;
					const dots = getDots(dateKey);
					const hasDots = dots.length > 0;

					return (
						<button
							key={dateKey}
							onClick={() => onSelectDate(dateKey)}
							aria-pressed={isSelected}
							className={cn(
								"flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md text-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
								isSelected && "bg-primary font-semibold text-primary-foreground shadow-sm",
								!isSelected &&
									isToday &&
									"bg-primary/10 font-bold text-primary ring-1 ring-inset ring-primary/40",
								!isSelected && !isToday && hasDots && "hover:bg-accent",
								!isSelected &&
									!isToday &&
									!hasDots &&
									"text-muted-foreground/50 hover:bg-accent/50",
								ringDatesWithDots &&
									!isSelected &&
									!isToday &&
									hasDots &&
									"ring-1 ring-inset ring-primary/20 hover:ring-primary/40",
							)}
						>
							<span className="text-xs">{day}</span>
							{hasDots && (
								<div className="mt-0.5 flex gap-0.5">
									{dots.map((dot) => (
										<span
											key={dot.key}
											className="h-1.5 w-1.5 rounded-full"
											style={{ backgroundColor: dot.color }}
										/>
									))}
								</div>
							)}
						</button>
					);
				})}
			</div>

			{legend && legend.length > 0 && (
				<div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
					{legend.map((item) => (
						<div key={item.label} className="flex items-center gap-1">
							<span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
							<span className="text-[10px] text-muted-foreground">{item.label}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
