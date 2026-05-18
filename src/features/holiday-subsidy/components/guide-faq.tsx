import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/features/holiday-subsidy/utils/holiday-subsidy-guide-content";

export function GuideFaq() {
	return (
		<div className="space-y-3">
			<div className="space-y-1">
				<div className="text-lg font-semibold">Frequently Asked Questions</div>
				<p className="text-sm text-muted-foreground">Common questions about the subsidy process</p>
			</div>
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
		</div>
	);
}
