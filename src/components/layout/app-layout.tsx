"use client";

import { Fragment, ReactNode } from "react";
import { Separator } from "../ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface AppLayoutProps {
    children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    const pathname = usePathname();

    const segments = pathname
        .split("/")
        .filter(Boolean)
        .map((seg) => ({
            name: seg.charAt(0).toUpperCase() + seg.slice(1),
            href: "/" + seg,
        }));

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
                                {segments.map((seg, index) => {
                                    const isFirst = index === 0;
                                    const isLast = index === segments.length - 1;
                                    const isSingle = segments.length === 1;

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
