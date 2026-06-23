"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FacilityTypeBadges } from "@/components/facilities/facility-type-badges";
import { FacilityAddDialog } from "@/components/facilities/facility-add-dialog";
import { ScheduleWeek } from "@/components/facilities/schedule-week";
import { ScheduleClusterPanel } from "@/components/facilities/schedule-cluster-panel";
import {
	ScheduleSlotDialog,
	type SlotEditTarget,
} from "@/components/facilities/schedule-slot-dialog";
import { ManageConflicts } from "@/components/facilities/manage-conflicts";
import { buildWeek, type Cluster, type ScheduleSlot } from "@/lib/facilities/schedule-grid";
import {
	BookingSchedule,
	Facility,
	FacilityType,
	FACILITY_TYPE_CONFIG,
} from "@/types/facilities";
import { Shield, Plus, Building2 } from "lucide-react";

const TYPE_ORDER: FacilityType[] = ["sheares", "reboks", "nus", "external"];

export default function AdminFacilitiesPage() {
	const { user } = useAuth();
	const [type, setType] = useState<FacilityType>("reboks");
	const [facilities, setFacilities] = useState<Facility[]>([]);
	const [schedules, setSchedules] = useState<BookingSchedule[]>([]);
	const [loading, setLoading] = useState(true);
	const [addOpen, setAddOpen] = useState(false);
	const [slotOpen, setSlotOpen] = useState(false);
	const [editing, setEditing] = useState<SlotEditTarget | null>(null);
	const [selected, setSelected] = useState<{ day: number; cluster: Cluster } | null>(null);

	const fetchAll = useCallback(async () => {
		setLoading(true);
		try {
			const [fRes, sRes] = await Promise.all([
				fetch("/api/facilities/catalog"),
				fetch("/api/facilities/schedules"),
			]);
			if (fRes.ok) setFacilities((await fRes.json()).data ?? []);
			if (sRes.ok) setSchedules((await sRes.json()).data ?? []);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchAll();
	}, [fetchAll]);

	// Materialise non-reboks bookable slots when viewing a non-reboks schedule (JCRC session).
	useEffect(() => {
		if (type !== "reboks") {
			fetch("/api/facilities/bookings/materialize", { method: "POST" }).catch(() => undefined);
		}
	}, [type]);

	const facilitiesById = useMemo(() => {
		const m = new Map<number, Facility>();
		for (const f of facilities) m.set(f.id, f);
		return m;
	}, [facilities]);

	// Flatten schedules of the active type into ScheduleSlot[] for the week editor.
	const slots: ScheduleSlot[] = useMemo(() => {
		const out: ScheduleSlot[] = [];
		for (const s of schedules) {
			const f = facilitiesById.get(s.facility_id);
			if (!f || f.type !== type) continue;
			out.push({
				id: s.id,
				facility_id: s.facility_id,
				venue: f.venue,
				sub_venue: f.sub_venue,
				type: f.type,
				day_of_week: s.day_of_week,
				hour: s.hour,
				priority: s.priority,
				reboks_activity: s.reboks_activity,
			});
		}
		return out;
	}, [schedules, facilitiesById, type]);

	const activeFacilities = useMemo(() => facilities.filter((f) => f.active), [facilities]);
	const weekWaves = useMemo(() => buildWeek(slots).waves, [slots]);

	if (user && !user.is_jcrc) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<PageHeader title="Manage Facilities" />
				<EmptyState
					icon={Shield}
					title="Access Denied"
					description="Only JCRC members can manage facilities."
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="Manage Facilities"
				description="Add facilities, define booking schedules, and resolve conflicts"
			/>

			<Tabs defaultValue="schedules">
				<TabsList>
					<TabsTrigger value="facilities">Facilities</TabsTrigger>
					<TabsTrigger value="schedules">Schedules</TabsTrigger>
					<TabsTrigger value="conflicts">Conflicts</TabsTrigger>
				</TabsList>

				{/* Facilities */}
				<TabsContent value="facilities">
					<div className="mb-4 flex items-center justify-between gap-3">
						<h3 className="text-sm font-medium text-muted-foreground">All facilities</h3>
						<Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
							<Plus className="h-4 w-4" />
							Add facility
						</Button>
					</div>
					{loading ? (
						<Skeleton className="h-40 w-full" />
					) : facilities.length === 0 ? (
						<EmptyState icon={Building2} title="No facilities" description="Add one to get started." />
					) : (
						<div className="space-y-6">
							{TYPE_ORDER.filter((t) => facilities.some((f) => f.type === t)).map((t) => {
								const cfg = FACILITY_TYPE_CONFIG[t];
								const list = facilities.filter((f) => f.type === t);
								return (
									<div key={t}>
										<div className="mb-2 flex items-center gap-2">
											<span
												className="h-2.5 w-2.5 rounded-full"
												style={{ backgroundColor: cfg.color }}
											/>
											<h4 className="text-sm font-semibold">{cfg.label}</h4>
											<span className="text-xs text-muted-foreground">({list.length})</span>
										</div>
										<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
											{list.map((f) => (
												<div
													key={f.id}
													className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5"
												>
													<div className="min-w-0">
														<div className="truncate font-medium">{f.sub_venue}</div>
														{f.venue !== f.sub_venue && (
															<div className="truncate text-xs text-muted-foreground">{f.venue}</div>
														)}
													</div>
													{!f.active && (
														<Badge variant="secondary" className="shrink-0 text-[10px]">
															Inactive
														</Badge>
													)}
												</div>
											))}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</TabsContent>

				{/* Schedules */}
				<TabsContent value="schedules">
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
						<FacilityTypeBadges value={type} onChange={setType} />
						<Button
							size="sm"
							className="gap-1.5"
							onClick={() => {
								setSelected(null);
								setEditing(null);
								setSlotOpen(true);
							}}
						>
							<Plus className="h-4 w-4" />
							Add slot
						</Button>
					</div>

					{loading ? (
						<Skeleton className="h-48 w-full" />
					) : (
						<div className="space-y-4">
							<ScheduleWeek
								schedules={slots}
								onSelectCluster={(day, cluster) => setSelected({ day, cluster })}
							/>
							{selected && (
								<ScheduleClusterPanel
									day={selected.day}
									cluster={selected.cluster}
									schedules={slots}
									waves={weekWaves}
									onChanged={fetchAll}
									onAddSlot={() => {
										setEditing(null);
										setSlotOpen(true);
									}}
									onEditWindow={(day, w) => {
										setEditing({
											ids: w.ids,
											facilityId: w.facility_id,
											day,
											hours: w.hours,
											priority: w.priority,
											reboks_activity: w.reboks_activity,
										});
										setSlotOpen(true);
									}}
								/>
							)}
						</div>
					)}
				</TabsContent>

				{/* Conflicts */}
				<TabsContent value="conflicts">
					<ManageConflicts />
				</TabsContent>
			</Tabs>

			<FacilityAddDialog open={addOpen} onClose={() => setAddOpen(false)} onSuccess={fetchAll} />
			<ScheduleSlotDialog
				open={slotOpen}
				facilities={activeFacilities}
				defaultType={type}
				defaultDay={selected?.day}
				defaultHour={selected?.cluster.startHour}
				editing={editing}
				onClose={() => setSlotOpen(false)}
				onSuccess={fetchAll}
			/>
		</div>
	);
}
