'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type TabsContextValue = {
    value?: string;
    onValueChange?: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
    const context = React.useContext(TabsContext);
    if (!context) {
        throw new Error('Tabs components must be used within <Tabs>');
    }
    return context;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
}

export function Tabs({ value: controlledValue, defaultValue, onValueChange, className, children, ...props }: TabsProps) {
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
            <div className={cn('flex w-full flex-col', className)} {...props}>
                {children}
            </div>
        </TabsContext.Provider>
    );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
                className
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
    const safeValue = value.replace(/\s+/g, '-');

    return (
        <button
            type="button"
            role="tab"
            id={`tab-trigger-${safeValue}`}
            aria-selected={isActive}
            aria-controls={`tab-content-${safeValue}`}
            data-state={isActive ? 'active' : 'inactive'}
            className={cn(
                'inline-flex min-w-[100px] items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium',
                'ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-50',
                'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                className
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
    const safeValue = value.replace(/\s+/g, '-');

    if (!isActive) return null;

    return (
        <div
            role="tabpanel"
            id={`tab-content-${safeValue}`}
            aria-labelledby={`tab-trigger-${safeValue}`}
            className={cn('mt-2', className)}
            {...props}
        >
            {children}
        </div>
    );
}
