"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { FadeIn } from "@/components/ui/fade-in";
import { FAQ_ITEMS } from "@/lib/holiday-subsidy/holiday-subsidy-guide-content";

export function GuideFaq() {
	return (
		<div className="flex flex-col gap-4">
			<FadeIn>
				<div className="flex flex-col gap-1 border-l-4 border-primary pl-3">
					<div className="text-lg font-semibold">Frequently Asked Questions</div>
					<p className="text-sm text-muted-foreground">
						Common questions about the subsidy process
					</p>
				</div>
			</FadeIn>
			<FadeIn delay={0.1}>
				<Accordion type="single" collapsible className="w-full">
					{FAQ_ITEMS.map((item, index) => (
						<AccordionItem key={item.id} value={`faq-${index}`}>
							<AccordionTrigger className="text-sm font-medium hover:no-underline text-left">
								{item.question}
							</AccordionTrigger>
							<AccordionContent className="text-sm text-muted-foreground leading-relaxed">
								{item.answer}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</FadeIn>
		</div>
	);
}
