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
import { AUTHORIZED_CHAIR_ROLES, ChairRole } from "@/lib/lead-auth-service"

type NavItem = {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    adminOnly?: boolean
    jcrcOnly?: boolean
    chairOnly?: boolean
    featureFlag?: string
    items?: {
        title: string
        url: string
        adminOnly?: boolean
        jcrcOnly?: boolean
        chairOnly?: boolean
        featureFlag?: string
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
        title: "Manage CCAs",
        url: "/dashboard/managecca",
        isActive: true,
        icon: Volleyball,
    },
    {
        title: "CCA Allocation",
        url: "/dashboard/ccaAllocation",
        icon: FileUser,
        isActive: true,
        items: [
            {
                title: "Apply For CCAs",
                url: "/dashboard/ccaAllocation/rank",
            },
            {
                title: "Rank CCA Applicants",
                url: "/dashboard/ccaAllocation/rankApplicants",
                chairOnly: true,
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
        items: [
            {
                title: "Guide and FAQ",
                url: "/dashboard/holidaySubsidy/guide",
            },
            {
                title: "JCRC Approvals",
                url: "/dashboard/holidaySubsidy/approvals",
                jcrcOnly: true,
            },
        ],
    },
]

export const buildNavItems = (user?: User | null) => {
    const isChair = user?.appointments?.some(appt => 
        AUTHORIZED_CHAIR_ROLES.includes((appt.position_type || '').toLowerCase() as ChairRole)
    ) || user?.is_admin || false;

    const allowItem = (item: { adminOnly?: boolean; jcrcOnly?: boolean; chairOnly?: boolean }) => {
        if (item.adminOnly && item.jcrcOnly) {
            return Boolean(user?.is_admin || user?.is_jcrc)
        }
        if (item.adminOnly) return Boolean(user?.is_admin)
        if (item.jcrcOnly) return Boolean(user?.is_jcrc)
        if (item.chairOnly) return Boolean(isChair)
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
