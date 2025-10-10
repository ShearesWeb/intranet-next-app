"use client"

import * as React from "react"
import {
    BookOpen,
    FileUser,
    BriefcaseBusiness,
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
import { useAuth } from "@/context/AuthContext"

const data = {
    navMain: [
        {
            title: "Your Applications",
            url: "/app/dashboard",
            icon: FileUser,
            isActive: true,
        },
        {
            title: "Jobs",
            url: "/app/open-roles",
            isActive: true,
            icon: BriefcaseBusiness,
            items: [
                {
                    title: "Open Roles",
                    url: "/app/open-roles",
                },
            ],
        },
        {
            title: "About",
            url: "/app/hiring-process",
            icon: BookOpen,
            isActive: true,
            items: [
                {
                    title: "Hiring Process",
                    url: "/app/hiring-process",
                },
                {
                    title: "FAQ",
                    url: "/app/faq",
                },
            ],
        },
    ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { user } = useAuth();

    return (
        <Sidebar variant="inset" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard/home">
                                <Avatar className="flex size-8 items-center justify-center rounded-md">
                                    <AvatarImage src="/images/shweb-logo.png" />
                                </Avatar>
                                <div className="grid flex-1 text-left leading-tight">
                                    <span className="truncate font-medium">Sheares Web Intranet</span>
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
