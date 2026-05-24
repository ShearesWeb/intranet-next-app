"use client";

import React from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { FadeIn } from "@/components/ui/fade-in";
import { FAQ_ITEMS } from "@/lib/allocation/allocation-guide-content";

export function AllocationFAQ() {
	return (
		<div className="flex flex-col gap-6">
			<FadeIn>
				<h2 className="border-l-4 border-primary pl-3 text-2xl font-bold tracking-tight md:text-3xl">
					Frequently Asked Questions
				</h2>
			</FadeIn>

			<FadeIn delay={0.15}>
				<Accordion type="single" collapsible className="w-full">
					{FAQ_ITEMS.map((item) => (
						<AccordionItem key={item.value} value={item.value}>
							<AccordionTrigger>{item.question}</AccordionTrigger>
							<AccordionContent>
								{"list" in item ? (
									<div className="flex flex-col gap-2">
										<p>You are generally allowed to join:</p>
										<ul className="list-inside list-disc font-medium">
											{item.list.map((li) => (
												<li key={li}>{li}</li>
											))}
										</ul>
										<p>{item.footer}</p>
									</div>
								) : (
									item.answer
								)}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</FadeIn>
		</div>
	);
}
