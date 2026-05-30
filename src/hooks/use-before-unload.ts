"use client";

import { useEffect } from "react";

export function useBeforeUnload(hasUnsavedChanges: boolean) {
	useEffect(() => {
		const handler = (e: BeforeUnloadEvent) => {
			if (hasUnsavedChanges) e.preventDefault();
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [hasUnsavedChanges]);
}
