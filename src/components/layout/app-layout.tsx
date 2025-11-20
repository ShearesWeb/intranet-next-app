"use client";

import { Fragment, ReactNode, useMemo } from "react";
import { Separator } from "../ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../ui/sidebar";
import { AppSidebar, buildNavItems } from "./app-sidebar";
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface AppLayoutProps {
    children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    const pathname = usePathname();
    const { user } = useAuth();

    const navItems = useMemo(() => buildNavItems(user), [user]);

    const flattenedNav = useMemo(() => {
        const list: { title: string; url: string; parentUrl?: string }[] = [];
        navItems.forEach((item) => {
            list.push({ title: item.title, url: item.url });
            item.items?.forEach((sub) => {
                list.push({ title: sub.title, url: sub.url, parentUrl: item.url });
            });
        });
        return list;
    }, [navItems]);

    const breadcrumbTrail = useMemo(() => {
        if (!pathname) return [];
        const matches = flattenedNav.filter((entry) => pathname.startsWith(entry.url));
        if (!matches.length) return [];

        const bestMatch = matches.sort((a, b) => b.url.length - a.url.length)[0];

        // Build the trail from the matched item back to the root using parentUrl pointers
        const trail: { name: string; href: string }[] = [];
        let current: { title: string; url: string; parentUrl?: string } | undefined = bestMatch;
        while (current) {
            trail.unshift({ name: current.title, href: current.url });
            const parentUrl: string | undefined = current.parentUrl;
            current = parentUrl ? flattenedNav.find((entry) => entry.url === parentUrl) : undefined;
        }

        return trail;
    }, [pathname, flattenedNav]);

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-2 data-[orientation=vertical]:h-4"
                        />
                        <Breadcrumb>
                            <BreadcrumbList>
                                {breadcrumbTrail.map((seg, index) => {
                                    const isFirst = index === 0;
                                    const isLast = index === breadcrumbTrail.length - 1;
                                    const isSingle = breadcrumbTrail.length === 1;

                                    if (isSingle) {
                                        // only one item, no separators
                                        return (
                                            <BreadcrumbItem key={seg.href} className="hidden md:block">
                                                <BreadcrumbPage>{seg.name}</BreadcrumbPage>
                                            </BreadcrumbItem>
                                        );
                                    }

                                    if (isFirst) {
                                        return (
                                            <BreadcrumbItem key={seg.href} className="hidden md:block">
                                                <Link href={seg.href}>{seg.name}</Link>
                                            </BreadcrumbItem>
                                        );
                                    }

                                    if (isLast) {
                                        return (
                                            <Fragment key={seg.href}>
                                                <BreadcrumbSeparator />
                                                <BreadcrumbItem className="hidden md:block">
                                                    <BreadcrumbPage>{seg.name}</BreadcrumbPage>
                                                </BreadcrumbItem>
                                            </Fragment>
                                        );
                                    }

                                    // middle items
                                    return (
                                        <Fragment key={seg.href}>
                                            <BreadcrumbSeparator />
                                            <BreadcrumbItem className="hidden md:block">
                                                <Link href={seg.href}>{seg.name}</Link>
                                            </BreadcrumbItem>
                                        </Fragment>
                                    );
                                })}

                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>
                <div className="flex justify-center px-4 sm:px-6 md:px-8">
                    <section className="w-full">{children}</section>
                </div>
            </SidebarInset>


        </SidebarProvider >
    );
}
