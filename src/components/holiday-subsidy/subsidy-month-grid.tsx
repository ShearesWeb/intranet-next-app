"use client";

import { cn } from "@/lib/utils";
import { CalendarDeclaration, SUBSIDY_DOT_CONFIG, type SubsidyDotType } from "@/types/declarations";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubsidyMonthGridProps {
	year: number;
	month: number;
	selectedDate: string | null;
	declarations: CalendarDeclaration[];
	onSelectDate: (date: string) => void;
	onChangeMonth: (year: number, month: number) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
	return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
	return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number): string {
	return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthLabel(year: number, month: number): string {
	return new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getDotType(decl: CalendarDeclaration): SubsidyDotType {
	if (decl.status === "pending") return "pending";
	if (decl.status === "rejected") return "rejected";
	if (decl.member_count > 0 && decl.pending_member_count === 0) return "approved-complete";
	return "approved-needs-members";
}

export function SubsidyMonthGrid({
	year,
	month,
	selectedDate,
	declarations,
	onSelectDate,
	onChangeMonth,
}: SubsidyMonthGridProps) {
	const daysInMonth = getDaysInMonth(year, month);
	const firstDay = getFirstDayOfMonth(year, month);
	const today = new Date().toISOString().split("T")[0];

	const declsByDate = new Map<string, CalendarDeclaration[]>();
	for (const d of declarations) {
		const list = declsByDate.get(d.day) ?? [];
		list.push(d);
		declsByDate.set(d.day, list);
	}

	function getDotsForDate(dateKey: string): SubsidyDotType[] {
		const dayDecls = declsByDate.get(dateKey) ?? [];
		const types = new Set<SubsidyDotType>();
		for (const d of dayDecls) {
			types.add(getDotType(d));
		}
		return [...types];
	}

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
				{WEEKDAYS.map((wd) => (
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
					const dots = getDotsForDate(dateKey);
					const hasDecls = dots.length > 0;

					return (
						<button
							key={dateKey}
							onClick={() => onSelectDate(dateKey)}
							aria-pressed={isSelected}
							className={cn(
								"flex aspect-square flex-col items-center justify-center rounded-md text-sm transition-all duration-150 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
								isSelected && "bg-primary text-primary-foreground",
								!isSelected && isToday && "bg-primary/10 font-bold text-primary",
								!isSelected && !isToday && hasDecls && "hover:bg-accent",
								!isSelected &&
									!isToday &&
									!hasDecls &&
									"text-muted-foreground/50 hover:bg-accent/50",
								// Days with declarations get a subtle inset ring that strengthens on hover.
								!isSelected &&
									hasDecls &&
									"ring-1 ring-inset ring-primary/20 hover:ring-primary/40",
							)}
						>
							<span className="text-xs">{day}</span>
							{dots.length > 0 && (
								<div className="mt-0.5 flex gap-0.5">
									{dots.map((dotType) => (
										<span
											key={dotType}
											className="h-1.5 w-1.5 rounded-full"
											style={{ backgroundColor: SUBSIDY_DOT_CONFIG[dotType].color }}
										/>
									))}
								</div>
							)}
						</button>
					);
				})}
			</div>

			<div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
				{(
					Object.entries(SUBSIDY_DOT_CONFIG) as [SubsidyDotType, { label: string; color: string }][]
				).map(([key, cfg]) => (
					<div key={key} className="flex items-center gap-1">
						<span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
						<span className="text-[10px] text-muted-foreground">{cfg.label}</span>
					</div>
				))}
			</div>
		</div>
	);
}
