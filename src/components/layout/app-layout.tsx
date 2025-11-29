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

const formatSegment = (segment: string) => {
    const cleaned = decodeURIComponent(segment).replace(/[\[\]]/g, "");
    const separated = cleaned.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    return separated
        .split(/[-_\s]/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

interface AppLayoutProps {
    children: ReactNode;
    breadcrumbOverride?: { name: string; href: string }[];
}

export function AppLayout({ children, breadcrumbOverride }: AppLayoutProps) {
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

    const navLookup = useMemo(() => {
        const map = new Map<string, { title: string; url: string; parentUrl?: string }>();
        for (const item of flattenedNav) map.set(item.url, item);
        return map;
    }, [flattenedNav]);

    const pathParts = useMemo(() => (pathname ? pathname.split("/").filter(Boolean) : []), [pathname]);

    const breadcrumbTrail = useMemo(() => {
        if (!pathname) return [];

        const matches = flattenedNav.filter((entry) => pathname.startsWith(entry.url));
        if (!matches.length) {
            return pathParts.map((part, index) => {
                const href = "/" + pathParts.slice(0, index + 1).join("/");
                return { name: formatSegment(part), href };
            });
        }

        let bestMatch = matches[0];
        for (let i = 1; i < matches.length; i++) {
            if (matches[i].url.length > bestMatch.url.length) {
                bestMatch = matches[i];
            }
        }

        // Build the trail from the matched item back to the root using parentUrl pointers
        const trail: { name: string; href: string }[] = [];
        let current: { title: string; url: string; parentUrl?: string } | undefined = bestMatch;
        while (current) {
            trail.unshift({ name: current.title, href: current.url });
            const parentUrl: string | undefined = current.parentUrl;
            current = parentUrl ? navLookup.get(parentUrl) : undefined;
        }

        // If the current path is deeper than the nav match, append a leaf inferred from the URL
        if (pathname !== bestMatch.url) {
            const remainder = pathname.slice(bestMatch.url.length).replace(/^\//, "");
            if (remainder) {
                const parts = remainder.split("/").filter(Boolean);
                const leaf = parts[parts.length - 1];
                trail.push({ name: formatSegment(leaf), href: pathname });
            }
        }

        // Ensure dashboard is always present as root when applicable
        if (pathname.startsWith("/dashboard") && trail[0]?.href !== "/dashboard") {
            trail.unshift({ name: "Dashboard", href: "/dashboard" });
        }

        return trail;
    }, [pathname, flattenedNav, navLookup, pathParts]);

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
                                {(breadcrumbOverride || breadcrumbTrail).map((seg, index) => {
                                    const trail = breadcrumbOverride || breadcrumbTrail;
                                    const isFirst = index === 0;
                                    const isLast = index === trail.length - 1;
                                    const isSingle = trail.length === 1;

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
