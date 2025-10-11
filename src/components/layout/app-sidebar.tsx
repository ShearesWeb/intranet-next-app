"use client"

import * as React from "react"
import {
    FileUser,
    Volleyball,
    House,
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
import { Avatar, AvatarImage } from "@radix-ui/react-avatar"

const data = {
    navMain: [
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
                    title: "View My CCAs",
                    url: "/dashboard/mycca",
                },
                {
                    title: "Manage Members",
                    url: "/dashboard/mycca/manageMembers",
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
                },
            ],
        },
    ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
                <NavMain items={data.navMain} />
            </SidebarContent>
            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    )
}
