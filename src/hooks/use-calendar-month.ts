"use client";

import { useCallback, useMemo, useState } from "react";
import { getMonthRange, todayKey } from "@/lib/date";

/** Month navigation + selected-day state shared by the calendar pages. */
export function useCalendarMonth() {
	const [year, setYear] = useState(() => new Date().getFullYear());
	const [month, setMonth] = useState(() => new Date().getMonth());
	const [selectedDate, setSelectedDate] = useState<string>(() => todayKey());

	const changeMonth = useCallback((y: number, m: number) => {
		setYear(y);
		setMonth(m);
	}, []);

	const monthRange = useMemo(() => getMonthRange(year, month), [year, month]);

	return { year, month, selectedDate, setSelectedDate, changeMonth, monthRange };
}
