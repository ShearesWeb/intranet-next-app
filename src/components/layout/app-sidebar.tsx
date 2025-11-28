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
import { usePhaseInfo } from "@/hooks/usePhaseInfo"

type NavItem = {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    adminOnly?: boolean
    jcrcOnly?: boolean
    featureFlag?: string
    items?: {
        title: string
        url: string
        adminOnly?: boolean
        jcrcOnly?: boolean
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
        title: "My CCAs",
        url: "/dashboard/mycca",
        isActive: true,
        icon: Volleyball,
    },
    {
        title: "CCA Allocation",
        url: "/dashboard/rank",
        icon: FileUser,
        isActive: true,
        items: [
            {
                title: "Apply For CCAs",
                url: "/dashboard/rank",
            },
            {
                title: "Rank CCA Applicants",
                url: "/dashboard/rankApplicants",
                adminOnly: true,
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
                title: "Chair Declaration",
                url: "/dashboard/holidaySubsidy?view=declaration",
                adminOnly: true,
            },
            {
                title: "JCRC Approvals",
                url: "/dashboard/holidaySubsidy/approvals",
                jcrcOnly: true,
            },
        ],
    },
]

export const buildNavItems = (user?: { is_admin?: boolean; is_jcrc?: boolean } | null) => {
    const allowItem = (item: { adminOnly?: boolean; jcrcOnly?: boolean }) => {
        if (item.adminOnly && item.jcrcOnly) {
            return Boolean(user?.is_admin || user?.is_jcrc)
        }
        if (item.adminOnly) return Boolean(user?.is_admin)
        if (item.jcrcOnly) return Boolean(user?.is_jcrc)
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
    const { phaseInfo } = usePhaseInfo();

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
