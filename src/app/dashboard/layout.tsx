import { ReactNode } from "react";

import { AppLayout } from "@/components/layout/app-layout";

export default function DashboardLayout({ children }: { children: ReactNode }) {
	return <AppLayout>{children}</AppLayout>;
}
