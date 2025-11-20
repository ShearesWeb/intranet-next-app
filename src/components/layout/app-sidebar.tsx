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
    featureFlag?: string
    items?: {
        title: string
        url: string
        adminOnly?: boolean
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
        url: "/dashboard/mycca",
        isActive: true,
        icon: Volleyball,
        items: [
            {
                title: "My CCAs",
                url: "/dashboard/mycca",
            },
        ],
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
        items: [
            {
                title: "Subsidy Declaration",
                url: "/dashboard/holidaySubsidy/declaration",
            },
            {
                title: "Guide and FAQ",
                url: "/dashboard/holidaySubsidy/guide",
            },
        ],
    },
]

export const buildNavItems = (user?: { is_admin?: boolean } | null) =>
    navOptions
        .filter(item => !item.adminOnly || user?.is_admin)
        .map(item => ({
            ...item,
            items: item.items?.filter(sub => !sub.adminOnly || user?.is_admin),
        }));

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
