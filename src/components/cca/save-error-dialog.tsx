"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircleIcon } from "lucide-react";

interface SaveErrorDialogProps {
	errors: string[];
	onClose: () => void;
}

export function SaveErrorDialog({ errors, onClose }: SaveErrorDialogProps) {
	return (
		<Dialog open={errors.length > 0} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="border-l-4 border-red-500 max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="text-red-600 flex items-center gap-2">
						<AlertCircleIcon className="h-5 w-5" />
						Errors Occurred
					</DialogTitle>
					<DialogDescription>
						The following errors prevented some changes from being saved:
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2 my-4 max-h-60 overflow-y-auto">
					{errors.map((err, idx) => (
						<div
							key={idx}
							className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-100 break-words"
						>
							{err}
						</div>
					))}
				</div>
				<div className="flex justify-end">
					<Button onClick={onClose} className="bg-gray-800 text-white hover:bg-gray-700">
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
