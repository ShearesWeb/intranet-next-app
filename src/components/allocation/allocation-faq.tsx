"use client";

import React from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/lib/allocation/allocation-guide-content";

export function AllocationFAQ() {
	return (
		<div className="space-y-4">
			<h2 className="text-2xl font-bold pl-2 border-l-4 border-violet-500">
				Frequently Asked Questions
			</h2>
			<Accordion type="single" collapsible className="w-full">
				{FAQ_ITEMS.map((item) => (
					<AccordionItem key={item.value} value={item.value}>
						<AccordionTrigger>{item.question}</AccordionTrigger>
						<AccordionContent>
							{"list" in item ? (
								<>
									<p className="mb-2">You are generally allowed to join:</p>
									<ul className="list-disc list-inside mb-2 space-y-1 font-medium">
										{item.list.map((li) => (
											<li key={li}>{li}</li>
										))}
									</ul>
									<p>{item.footer}</p>
								</>
							) : (
								item.answer
							)}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	);
}
