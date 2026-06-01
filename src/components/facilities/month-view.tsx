"use client";

import { type FacilityBooking, BOOKING_TYPE_CONFIG } from "@/types/facilities";
import { cn } from "@/lib/utils";

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface MonthViewProps {
	currentDate: Date;
	bookings: FacilityBooking[];
	onDateClick: (date: Date) => void;
	onBookingClick: (booking: FacilityBooking) => void;
}

function formatDateKey(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isToday(d: Date): boolean {
	const t = new Date();
	return (
		d.getDate() === t.getDate() &&
		d.getMonth() === t.getMonth() &&
		d.getFullYear() === t.getFullYear()
	);
}

function getMonthGrid(year: number, month: number): Date[] {
	const first = new Date(year, month, 1);
	let startDay = first.getDay() - 1;
	if (startDay < 0) startDay = 6;
	const start = new Date(year, month, 1 - startDay);
	return Array.from(
		{ length: 42 },
		(_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
	);
}

function formatTimeShort(time: string): string {
	const h = parseInt(time.split(":")[0]);
	if (h === 0) return "12a";
	if (h === 12) return "12p";
	return h > 12 ? `${h - 12}p` : `${h}a`;
}

export function MonthView({ currentDate, bookings, onDateClick, onBookingClick }: MonthViewProps) {
	const grid = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
	const month = currentDate.getMonth();

	const byDate = new Map<string, FacilityBooking[]>();
	for (const b of bookings) {
		const arr = byDate.get(b.booked_date) ?? [];
		arr.push(b);
		byDate.set(b.booked_date, arr);
	}

	return (
		<div>
			<div className="grid grid-cols-7 border-b border-border">
				{DAY_HEADERS.map((d) => (
					<div
						key={d}
						className="py-2.5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-widest"
					>
						{d}
					</div>
				))}
			</div>

			<div className="grid grid-cols-7">
				{grid.map((date, i) => {
					const key = formatDateKey(date);
					const dayBookings = byDate.get(key) ?? [];
					const inMonth = date.getMonth() === month;
					const today = isToday(date);
					const isWeekend = i % 7 >= 5;
					const MAX_PILLS = 3;

					return (
						<button
							key={i}
							type="button"
							className={cn(
								"relative min-h-[88px] sm:min-h-[110px] border-b border-r border-border/60 p-1.5 text-left transition-colors",
								"hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
								!inMonth && "bg-muted/30",
								isWeekend && inMonth && "bg-muted/10",
								i % 7 === 0 && "border-l border-border/60",
							)}
							onClick={() => onDateClick(date)}
						>
							<span
								className={cn(
									"inline-flex items-center justify-center text-sm leading-none",
									today &&
										"rounded-full bg-primary text-primary-foreground w-7 h-7 font-bold shadow-sm",
									!today && inMonth && "font-medium text-foreground",
									!today && !inMonth && "text-muted-foreground/40",
								)}
							>
								{date.getDate()}
							</span>

							<div className="mt-1 space-y-0.5">
								{dayBookings.slice(0, MAX_PILLS).map((b) => {
									const cfg = BOOKING_TYPE_CONFIG[b.type];
									return (
										<div
											key={b.id}
											role="button"
											tabIndex={0}
											className="group w-full rounded-[4px] px-1 py-[3px] text-[10.5px] sm:text-[11px] leading-tight truncate border-l-[3px] cursor-pointer transition-all hover:shadow-sm"
											style={{
												backgroundColor: `${cfg.color}14`,
												borderLeftColor: cfg.color,
											}}
											onClick={(e) => {
												e.stopPropagation();
												onBookingClick(b);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.stopPropagation();
													onBookingClick(b);
												}
											}}
										>
											<span className="font-semibold" style={{ color: cfg.color }}>
												{formatTimeShort(b.time_from)}
											</span>
											<span className="hidden sm:inline text-foreground/70 ml-1">{b.activity}</span>
										</div>
									);
								})}
								{dayBookings.length > MAX_PILLS && (
									<span className="block text-[10px] text-muted-foreground pl-1 font-medium">
										+{dayBookings.length - MAX_PILLS} more
									</span>
								)}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
