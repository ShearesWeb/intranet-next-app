"use client";

import * as React from "react";
import { FileUser, Volleyball, House, CalendarDays, Wallet, LucideIcon } from "lucide-react";

import { NavMain } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { Avatar, AvatarImage } from "../ui/avatar";
import { useAuth } from "@/lib/auth/auth-context";
import { AuthenticatedUser } from "@/types/user";
import { checkCcaAuthorizationFromProfile } from "@/lib/cca/cca-chair-access";
import { CoreServiceKey, isFeatureFlaggedItemEnabled } from "@/lib/feature-flags";

type NavItem = {
	title: string;
	url: string;
	icon: LucideIcon;
	isActive?: boolean;
	jcrcOnly?: boolean;
	chairOnly?: boolean;
	featureFlag?: CoreServiceKey;
	items?: {
		title: string;
		url: string;
		jcrcOnly?: boolean;
		chairOnly?: boolean;
		featureFlag?: CoreServiceKey;
	}[];
};

const navOptions: NavItem[] = [
	{
		title: "Dashboard",
		url: "/dashboard",
		icon: House,
		isActive: true,
	},
	{
		title: "Facilities",
		url: "/dashboard/facilities/guide",
		icon: CalendarDays,
		isActive: true,
		featureFlag: "facilities",
		items: [
			{
				// Deliberately not chairOnly. Residents get a read-only availability
				// calendar here; only chairs see claim actions inside it.
				title: "Book Facilities",
				url: "/dashboard/facilities",
				featureFlag: "facilities",
			},
			{
				title: "Manage Facilities",
				url: "/dashboard/facilities/admin",
				jcrcOnly: true,
				featureFlag: "facilities",
			},
		],
	},
	{
		title: "My CCAs",
		url: "/dashboard/my-cca",
		isActive: true,
		icon: Volleyball,
		items: [
			{
				// Deliberately unflagged. This page hosts Manage Members as well as the
				// parked ranking editor, so gating it on `memberRanking` would take a
				// chair's only route into member management down with it.
				title: "Manage Members",
				url: "/dashboard/my-cca/admin",
				chairOnly: true,
			},
		],
	},
	{
		title: "CCA Allocation",
		url: "/dashboard/cca-allocation",
		icon: FileUser,
		isActive: true,
		featureFlag: "ccaApplications",
		items: [
			{
				title: "My CCA Preferences",
				url: "/dashboard/cca-allocation/rank",
				featureFlag: "ccaApplications",
			},
			{
				title: "Chair Preferences",
				url: "/dashboard/cca-allocation/rank-applicants",
				chairOnly: true,
				featureFlag: "ccaApplications",
			},
		],
	},
	{
		title: "Holiday Subsidy",
		url: "/dashboard/holiday-subsidy",
		icon: Wallet,
		isActive: true,
		featureFlag: "holidaySubsidy",
		items: [
			{
				title: "Subsidy Declarations",
				url: "/dashboard/holiday-subsidy/declarations",
				chairOnly: true,
				featureFlag: "holidaySubsidy",
			},
			{
				title: "Approvals",
				url: "/dashboard/holiday-subsidy/approvals",
				jcrcOnly: true,
				featureFlag: "holidaySubsidy",
			},
		],
	},
];

export const buildNavItems = (user?: AuthenticatedUser | null) => {
	const authResult = checkCcaAuthorizationFromProfile({ requestingUser: user });
	const isChair = Boolean(authResult.ok && authResult.data.hasChairAccess);

	const allowItem = (item: {
		jcrcOnly?: boolean;
		chairOnly?: boolean;
		featureFlag?: CoreServiceKey;
	}) => {
		if (!isFeatureFlaggedItemEnabled(item)) return false;
		if (item.jcrcOnly) return Boolean(user?.is_jcrc);
		if (item.chairOnly) return isChair;
		return true;
	};

	return navOptions.filter(allowItem).map((item) => ({
		...item,
		items: item.items?.filter(allowItem),
	}));
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { user } = useAuth();

	const navItems = buildNavItems(user);

	return (
		<Sidebar variant="inset" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link href="/dashboard">
								<Avatar className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 shadow-sm">
									<AvatarImage src="/images/shweb-logo.png" />
								</Avatar>
								<div className="grid flex-1 text-left leading-tight">
									<span className="truncate font-bold tracking-tight">Sheares Intranet</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={navItems} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
		</Sidebar>
	);
}
