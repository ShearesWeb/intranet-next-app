"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FacilityScheduleCard } from "@/components/facilities/facility-schedule-card";
import { ManageApprovals } from "@/components/facilities/manage-approvals";
import { FacilitySchedule, Facility } from "@/types/facilities";
import { Shield, Building2 } from "lucide-react";

export default function AdminFacilitiesPage() {
	const { user } = useAuth();
	const [facilities, setFacilities] = useState<Facility[]>([]);
	const [schedules, setSchedules] = useState<FacilitySchedule[]>([]);
	const [loading, setLoading] = useState(true);

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

	const managedFacilities = useMemo(
		() => facilities.filter((f) => f.type === "sheares"),
		[facilities],
	);

	async function saveScheduleGrid(facilityId: number, days: number[], hours: number[]) {
		const response = await fetch("/api/facilities/schedules", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ facility_id: facilityId, days, hours }),
		});
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.error ?? "Failed to update availability");

		const updated = (payload.data ?? []) as FacilitySchedule[];
		setSchedules((current) => [
			...current.filter((schedule) => schedule.facility_id !== facilityId),
			...updated,
		]);
	}

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
				description="Control bookable facility availability and approve bookings"
			/>

			<Tabs defaultValue="scheduling">
				<TabsList>
					<TabsTrigger value="scheduling">Scheduling</TabsTrigger>
					<TabsTrigger value="approvals">Approvals</TabsTrigger>
				</TabsList>

				<TabsContent value="scheduling">
					<div className="mb-5">
						<h2 className="text-lg font-semibold">Facility availability</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Choose which facilities, days, and times residents can book. Changes are shared with
							every facilities manager.
						</p>
					</div>

					{loading ? (
						<div className="space-y-4">
							<Skeleton className="h-72 w-full rounded-2xl" />
							<Skeleton className="h-72 w-full rounded-2xl" />
						</div>
					) : managedFacilities.length === 0 ? (
						<EmptyState
							icon={Building2}
							title="No facilities"
							description="The Sheares facility catalog is empty."
						/>
					) : (
						<div className="space-y-4">
							{managedFacilities.map((facility) => (
								<FacilityScheduleCard
									key={facility.id}
									facility={facility}
									schedules={schedules.filter((schedule) => schedule.facility_id === facility.id)}
									onSave={saveScheduleGrid}
								/>
							))}
						</div>
					)}
				</TabsContent>

				{/* Approvals */}
				<TabsContent value="approvals">
					<ManageApprovals />
				</TabsContent>
			</Tabs>
		</div>
	);
}
