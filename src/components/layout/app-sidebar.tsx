"use client"

import * as React from "react"
import {
    FileUser,
    Volleyball,
    House,
    LucideIcon,
} from "lucide-react"

import { NavMain } from "@/components/layout/nav-main"
import { NavUser } from "@/components/layout/nav-user"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { Avatar, AvatarImage } from "../ui/avatar"
import { useAuth } from "@/context/AuthContext"
import { User } from "@/types/User"
import { checkCcaAuthorization } from "@/lib/cca-chair-access"
import { CoreServiceKey, isCoreServiceEnabled, isFeatureFlaggedItemEnabled } from "@/lib/feature-flags"

type NavItem = {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    adminOnly?: boolean
    jcrcOnly?: boolean
    chairOnly?: boolean
    featureFlag?: CoreServiceKey
    items?: {
        title: string
        url: string
        adminOnly?: boolean
        jcrcOnly?: boolean
        chairOnly?: boolean
        featureFlag?: CoreServiceKey
    }[]
}

export const navOptions: NavItem[] = [
    {
        title: "Dashboard",
        url: "/dashboard",
        icon: House,
        isActive: true,
    },
    {
        title: "My CCAs",
        url: "/dashboard/mycca",
        isActive: true,
        icon: Volleyball,
        items: [
            {
                title: "CCA Admin",
                url: "/dashboard/mycca/admin",
                chairOnly: true,
                featureFlag: "memberRanking",
            },
        ],
    },
    {
        title: "CCA Allocation",
        url: "/dashboard/ccaAllocation",
        icon: FileUser,
        isActive: true,
        featureFlag: "ccaApplications",
        items: [
            {
                title: "Apply For CCAs",
                url: "/dashboard/ccaAllocation/rank",
                featureFlag: "ccaApplications",
            },
            {
                title: "Rank CCA Applicants",
                url: "/dashboard/ccaAllocation/rankApplicants",
                chairOnly: true,
                featureFlag: "ccaApplications",
            },
        ],
    },
    {
        title: "Holiday Subsidy",
        url: "/dashboard/holidaySubsidy",
        icon: FileUser,
        isActive: true,
        adminOnly: true,
        jcrcOnly: true,
        featureFlag: "holidaySubsidy",
        items: [
            {
                title: "Guide and FAQ",
                url: "/dashboard/holidaySubsidy/guide",
                featureFlag: "holidaySubsidy",
            },
            {
                title: "JCRC Approvals",
                url: "/dashboard/holidaySubsidy/approvals",
                jcrcOnly: true,
                featureFlag: "holidaySubsidy",
            },
        ],
    },
]

export const buildNavItems = (user?: User | null) => {
    const authResult = checkCcaAuthorization({ requestingUser: user });
    const isChair = Boolean(user?.is_admin || (authResult.ok && authResult.data.hasChairAccess));
    const hasMemberRankingAccess = isCoreServiceEnabled("memberRanking", {
        isJcrc: user?.is_jcrc,
    });

    const allowItem = (item: {
        adminOnly?: boolean;
        jcrcOnly?: boolean;
        chairOnly?: boolean;
        featureFlag?: CoreServiceKey;
    }) => {
        if (!isFeatureFlaggedItemEnabled(item, { isJcrc: user?.is_jcrc })) return false;
        if (item.adminOnly && item.jcrcOnly) {
            return Boolean(user?.is_admin || user?.is_jcrc)
        }
        if (item.adminOnly) return Boolean(user?.is_admin)
        if (item.jcrcOnly) return Boolean(user?.is_jcrc)
        if (item.chairOnly) {
            return Boolean(isChair || (item.featureFlag === "memberRanking" && hasMemberRankingAccess))
        }
        return true
    }

    return navOptions
        .filter(allowItem)
        .map(item => ({
            ...item,
            items: item.items?.filter(allowItem),
        }));
}

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
                                <Avatar className="flex size-8 items-center justify-center rounded-md">
                                    <AvatarImage src="/images/shweb-logo.png" />
                                </Avatar>
                                <div className="grid flex-1 text-left leading-tight">
                                    <span className="truncate font-bold">Sheares Intranet</span>
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
    )
}
