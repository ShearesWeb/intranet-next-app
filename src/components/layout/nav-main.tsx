"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavMainProps = {
	items: {
		title: string;
		url: string;
		icon: LucideIcon;
		isActive?: boolean;
		items?: {
			title: string;
			url: string;
		}[];
	}[];
};

export function NavMain({ items }: NavMainProps) {
	const pathname = usePathname() ?? "";

	return (
		<SidebarGroup>
			<SidebarMenu>
				{items.map((item) => {
					// A bare root like "/dashboard" would prefix-match every page, so it
					// only counts as active on an exact match. Deeper items use prefix
					// matching so a parent stays highlighted on its child routes.
					const isItemActive =
						pathname === item.url ||
						(item.url !== "/dashboard" && pathname.startsWith(item.url + "/"));
					const hasActiveChild = item.items?.some((subItem) => pathname === subItem.url);

					return (
						<Collapsible
							key={item.title}
							asChild
							defaultOpen={item.isActive || isItemActive || hasActiveChild}
						>
							<SidebarMenuItem>
								<SidebarMenuButton
									asChild
									tooltip={item.title}
									isActive={isItemActive}
									className="data-[active=true]:relative data-[active=true]:before:bg-sidebar-primary data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1/2 data-[active=true]:before:h-4 data-[active=true]:before:w-0.5 data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:rounded-full"
								>
									<Link href={item.url}>
										<item.icon />
										<span>{item.title}</span>
									</Link>
								</SidebarMenuButton>
								{item.items?.length ? (
									<>
										<CollapsibleTrigger asChild>
											<SidebarMenuAction className="data-[state=open]:rotate-90">
												<ChevronRight />
												<span className="sr-only">Toggle</span>
											</SidebarMenuAction>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<SidebarMenuSub>
												{item.items?.map((subItem) => (
													<SidebarMenuSubItem key={subItem.title}>
														<SidebarMenuSubButton
															asChild
															isActive={pathname === subItem.url}
														>
															<Link href={subItem.url}>
																<span>{subItem.title}</span>
															</Link>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												))}
											</SidebarMenuSub>
										</CollapsibleContent>
									</>
								) : null}
							</SidebarMenuItem>
						</Collapsible>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
