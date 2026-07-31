"use client";

import { MonthGrid, type MonthGridDot } from "@/components/shared/month-grid";
import { CalendarDeclaration, SUBSIDY_DOT_CONFIG, type SubsidyDotType } from "@/types/declarations";

interface SubsidyMonthGridProps {
	year: number;
	month: number;
	selectedDate: string | null;
	declarations: CalendarDeclaration[];
	onSelectDate: (date: string) => void;
	onChangeMonth: (year: number, month: number) => void;
}

function getDotType(decl: CalendarDeclaration): SubsidyDotType {
	if (decl.status === "pending") return "pending";
	if (decl.status === "rejected") return "rejected";
	if (decl.member_count > 0 && decl.pending_member_count === 0) return "approved-complete";
	return "approved-needs-members";
}

const LEGEND = (
	Object.entries(SUBSIDY_DOT_CONFIG) as [SubsidyDotType, { label: string; color: string }][]
).map(([, cfg]) => ({ label: cfg.label, color: cfg.color }));

export function SubsidyMonthGrid({
	year,
	month,
	selectedDate,
	declarations,
	onSelectDate,
	onChangeMonth,
}: SubsidyMonthGridProps) {
	const declsByDate = new Map<string, CalendarDeclaration[]>();
	for (const d of declarations) {
		const list = declsByDate.get(d.day) ?? [];
		list.push(d);
		declsByDate.set(d.day, list);
	}

	function getDots(dateKey: string): MonthGridDot[] {
		const dayDecls = declsByDate.get(dateKey) ?? [];
		const types = new Set<SubsidyDotType>();
		for (const d of dayDecls) {
			types.add(getDotType(d));
		}
		return [...types].map((type) => ({ key: type, color: SUBSIDY_DOT_CONFIG[type].color }));
	}

	return (
		<MonthGrid
			year={year}
			month={month}
			selectedDate={selectedDate}
			getDots={getDots}
			onSelectDate={onSelectDate}
			onChangeMonth={onChangeMonth}
			ringDatesWithDots
			legend={LEGEND}
		/>
	);
}
