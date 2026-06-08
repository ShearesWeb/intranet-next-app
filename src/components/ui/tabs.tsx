"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
	value?: string;
	onValueChange?: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
	const context = React.useContext(TabsContext);
	if (!context) {
		throw new Error("Tabs components must be used within <Tabs>");
	}
	return context;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
}

export function Tabs({
	value: controlledValue,
	defaultValue,
	onValueChange,
	className,
	children,
	...props
}: TabsProps) {
	const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue);
	const value = controlledValue ?? internalValue;

	const handleValueChange = (next: string) => {
		if (controlledValue === undefined) {
			setInternalValue(next);
		}
		onValueChange?.(next);
	};

	return (
		<TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
			<div className={cn("flex w-full flex-col", className)} {...props}>
				{children}
			</div>
		</TabsContext.Provider>
	);
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"inline-flex w-full items-center justify-start gap-6 border-b border-border text-muted-foreground",
				className,
			)}
			role="tablist"
			{...props}
		/>
	);
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	value: string;
}

export function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps) {
	const { value: activeValue, onValueChange } = useTabsContext();
	const isActive = activeValue === value;
	const safeValue = value.replace(/\s+/g, "-");

	return (
		<button
			type="button"
			role="tab"
			id={`tab-trigger-${safeValue}`}
			aria-selected={isActive}
			aria-controls={`tab-content-${safeValue}`}
			data-state={isActive ? "active" : "inactive"}
			className={cn(
				"relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-1 pb-3 pt-1 text-sm font-medium text-muted-foreground transition-colors",
				"hover:text-foreground focus-visible:text-foreground focus-visible:outline-none",
				"disabled:pointer-events-none disabled:opacity-50",
				"after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform after:duration-200 after:ease-out",
				"data-[state=active]:text-foreground data-[state=active]:after:scale-x-100",
				className,
			)}
			onClick={() => onValueChange?.(value)}
			{...props}
		>
			{children}
		</button>
	);
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
	value: string;
}

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
	const { value: activeValue } = useTabsContext();
	const isActive = activeValue === value;
	const safeValue = value.replace(/\s+/g, "-");

	if (!isActive) return null;

	return (
		<div
			role="tabpanel"
			id={`tab-content-${safeValue}`}
			aria-labelledby={`tab-trigger-${safeValue}`}
			className={cn("mt-4", className)}
			{...props}
		>
			{children}
		</div>
	);
}
