"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Building2, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { FacilityAvailability } from "@/components/facilities/facility-availability";
import { FacilityRequests } from "@/components/facilities/facility-requests";
import { FacilityTabs } from "@/components/facilities/facility-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";
import { isHiddenFacility } from "@/lib/facilities/bookable-types";
import { ApprovalsPayload, pendingRequestCount } from "@/lib/facilities/request-view";
import { Facility, FacilitySchedule } from "@/types/facilities";

type ManageTab = "requests" | "availability";

const NO_APPROVALS: ApprovalsPayload = { pending: [], confirmed: [] };

export default function AdminFacilitiesPage() {
	const { user } = useAuth();
	const [tab, setTab] = useState<ManageTab>("requests");
	const allowed = Boolean(user?.is_jcrc);

	const { data: facilityData, loading: facilitiesLoading } = useApiQuery<Facility[]>(
		"/api/facilities/catalog",
		{ initialData: [], enabled: allowed },
	);
	const {
		data: scheduleData,
		loading: schedulesLoading,
		refetch: refetchSchedules,
	} = useApiQuery<FacilitySchedule[]>("/api/facilities/schedules", {
		initialData: [],
		enabled: allowed,
		toastOnError: true,
		errorMessage: "Failed to load availability",
	});
	const {
		data: approvalData,
		loading: approvalsLoading,
		refetch: refetchApprovals,
	} = useApiQuery<ApprovalsPayload>("/api/facilities/approvals", {
		initialData: NO_APPROVALS,
		enabled: allowed,
		toastOnError: true,
		errorMessage: "Failed to load requests",
	});

	const approvals = approvalData ?? NO_APPROVALS;
	const managedFacilities = useMemo(
		() =>
			(facilityData ?? []).filter(
				(facility) => facility.type === "sheares" && !isHiddenFacility(facility),
			),
		[facilityData],
	);

	const refreshAll = useCallback(
		() => Promise.all([refetchSchedules(), refetchApprovals()]),
		[refetchSchedules, refetchApprovals],
	);

	// A refetch keeps the current view on screen. Only the first load gets a skeleton.
	const hasLoaded = useRef(false);
	if (allowed && !facilitiesLoading && !schedulesLoading && !approvalsLoading) {
		hasLoaded.current = true;
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
		<div className="flex flex-col gap-5 p-4 md:p-6">
			<PageHeader
				title="Manage Facilities"
				description={
					tab === "requests"
						? "Approve, decline or revoke CCA bookings for the next 4 weeks."
						: "Set which hours each Sheares venue is open for CCA requests. Shared with every JCRC facilities manager."
				}
			/>
			<FacilityTabs
				tabs={[
					{ key: "requests", label: "Requests", count: pendingRequestCount(approvals) },
					{ key: "availability", label: "Availability" },
				]}
				active={tab}
				onChange={setTab}
			/>

			{!hasLoaded.current ? (
				<Skeleton className="h-96 w-full rounded-xl" />
			) : tab === "requests" ? (
				<FacilityRequests approvals={approvals} onChanged={refetchApprovals} />
			) : managedFacilities.length === 0 ? (
				<EmptyState
					icon={Building2}
					title="No facilities"
					description="The Sheares facility catalog is empty."
				/>
			) : (
				<FacilityAvailability
					facilities={managedFacilities}
					schedules={scheduleData ?? []}
					approvals={approvals}
					onChanged={refreshAll}
				/>
			)}
		</div>
	);
}
