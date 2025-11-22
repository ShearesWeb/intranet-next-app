'use client';

import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon, InfoIcon } from 'lucide-react';


// -----------------------------
// FAQ DATA
// -----------------------------
interface FaqItem {
    id: string;
    question: string;
    answer: string;
}

const faq: FaqItem[] = [
    {
        id: "faq-1",
        question: "What happens if I miss the Tuesday 23:59 weekly submission?",
        answer: "The week locks permanently and cannot be edited. The subsidy for that week becomes void unless JCRC grants an exception.",
    },
    {
        id: "faq-2",
        question: "Can I edit the initial subsidy declaration after submitting it?",
        answer: "Only before JCRC approval. Once approved, weekly hours and justification cannot be modified.",
    },
    {
        id: "faq-3",
        question: "Can I increase a member's actual weekly hours later?",
        answer: "No. You can only reduce hours based on attendance or performance. Increases are not allowed without JCRC intervention.",
    },
    {
        id: "faq-4",
        question: "What is considered a sound justification?",
        answer: "Valid examples include training schedules, competitions and events, hall events such as orientation, dry runs, and preparation work. Missing justification or vague reasons may lead to rejection.",
    },
    {
        id: "faq-5",
        question: "What if a member does not attend any sessions?",
        answer: "Set their hours to 0 for the affected week and add a remark.",
    },
    {
        id: "faq-6",
        question: "Can members view their hours?",
        answer: "No. Members cannot view their weekly hours. This is intentional to maintain the confidentiality of internal CCA submissions and to prevent members from disputing or refuting chair decisions.",
    },
    {
        id: "faq-7",
        question: "When are final subsidy results released?",
        answer: "Final subsidy results are reflected directly in the UHMS portal after JCRC and SHWeb complete the final calculation process. There will be no interim updates provided, as the results must be consolidated and verified with Housing Services before being published.",
    },
];


// -----------------------------
// PAGE COMPONENT
// -----------------------------
export default function Guide() {
    return (
        <AppLayout>
            <div className="flex flex-col space-y-8 p-4">

                {/* PAGE TITLE */}
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Holiday Subsidy Guide</h1>
                    <p className="text-muted-foreground">Full process, requirements, and FAQs</p>
                </div>

                {/* GUIDE SECTION */}
                <Card>
                    <CardContent className="space-y-6">

                        {/* Phase 1 */}
                        <div className="space-y-4">
                            {/* Title + Badge */}
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">
                                    Phase 1 — Initial Subsidy Declaration
                                </h3>
                                <Badge variant="default">Chairs</Badge>
                                <Badge className="bg-rose-600">Due: 3 Dec</Badge>
                            </div>

                            {/* Description */}
                            <p className="text-muted-foreground">
                                Chairs declare subsidy requirements for the entire holiday period. For each position,
                                provide weekly hours and a sound justification. You can create new declarations and, if
                                JCRC rejects them, edit and resubmit; updates automatically return the status to
                                <strong> Pending</strong> so they re-enter the approval queue.
                            </p>

                            {/* Alert with examples + explanation */}
                            <Alert className="bg-orange-50 border border-orange-200">
                                <AlertCircleIcon className="h-4 w-4 text-orange-600" />
                                <AlertTitle className="text-orange-700 font-semibold">Important — Valid Justifications Required</AlertTitle>
                                <AlertDescription className="space-y-2">
                                    <p>
                                        Justifications must be <strong>realistic, relevant, and verifiable</strong>.
                                        Weak or vague explanations may lead to rejection by JCRC.
                                    </p>

                                    <div className="mt-3 space-y-1">
                                        <p className="font-medium text-orange-700">Example of valid justification:</p>
                                        <p className="text-orange-900/80">
                                            <strong>CCA:</strong> Swim Team<br />
                                            <strong>Position:</strong> Members<br />
                                            <strong>Week 1 Training:</strong>
                                            <ul className="list-disc list-inside">
                                                <li>Wednesday — 2 hours</li>
                                                <li>Friday — 2 hours</li>
                                            </ul>
                                            <strong>Total Declared Hours:</strong> 4 hours for Week 1
                                        </p>
                                    </div>
                                </AlertDescription>
                            </Alert>

                        </div>


                        <Separator />

                        {/* Phase 2 */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg"> Phase 2 — JCRC Approval</h3>
                                <Badge className='bg-fuchsia-600'>By 6 Dec</Badge>
                            </div>
                            <p className="text-muted-foreground">
                                JCRC verifies justifications and validates weekly hour allocations. Once approved, declarations
                                cannot be modified.
                            </p>
                        </div>

                        <Separator />

                        {/* Phase 3 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg"> Phase 3 — Weekly Commitment Declaration</h3>
                                <Badge>Chairs</Badge>
                                <Badge className='bg-red-600'>Every Week</Badge>
                            </div>

                            <p className="text-muted-foreground">
                                Chairs must submit actual hours committed by each member weekly.
                            </p>

                            <Alert className="bg-rose-50 border border-rose-200">
                                <AlertTriangleIcon className="h-4 w-4 text-rose-600" />
                                <AlertTitle className="text-rose-700 font-semibold">Weekly Deadline</AlertTitle>
                                <AlertDescription >
                                    <p className="text-rose-900/80">
                                        Submission closes every <strong>Tuesday 23:59</strong>. Missing the deadline
                                        automatically voids the subsidy for that week.
                                    </p>
                                </AlertDescription>
                            </Alert>

                            <p className="text-muted-foreground">
                                The interface auto-fills recommended values based on approved declarations from Phase 1.
                                You may decrease hours and add remarks, but you cannot increase them.
                            </p>

                            <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                <li>Each member appears as a row in the table prefilled according to the previous subsidy declaration.</li>
                                <li>By default, all members are marked as <strong>not having committed any hours</strong>.</li>
                                <li>You must manually <strong>tick</strong> each member you want to confirm hours for.</li>
                                <li>Modify the number of hours if the member's contributions are less than planned.</li>
                                <li>You may add <strong>remarks</strong> to explain reduced hours or exceptions.</li>
                                <li>Hours cannot be increased beyond the approved subsidy declaration.</li>
                            </ul>

                            <Alert className="bg-blue-50 border border-blue-200">
                                <CheckCircle2Icon className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-blue-700 font-semibold">Why the Interface Is Designed This Way</AlertTitle>
                                <AlertDescription >
                                    <p className="text-blue-900/80">
                                        The submission interface requires chairs to manually confirm each member every week
                                        because it encourages <strong>intentional and thoughtful verification</strong> of actual participation.
                                        By reviewing every row, chairs must actively assess whether members genuinely showed up,
                                        contributed, and fulfilled the hours committed.
                                        <br /><br />
                                        This design prevents passive or blanket approvals and ensures that subsidy allocations
                                        reflect <strong>real, meaningful work</strong> rather than assumptions or default values.
                                        It reinforces fairness across all CCAs and upholds accountability in the subsidy process.
                                    </p>
                                </AlertDescription>
                            </Alert>
                        </div>


                        <Separator />

                        {/* Phase 4 */}
                        <div className="space-y-2">
                            <h3 className="font-semibold text-lg">
                                Phase 4 — Final Subsidy Calculation
                            </h3>
                            <p className="text-muted-foreground">
                                At the end of the holiday, JCRC and SHWeb will run the subsidy algorithm to compute final eligible amounts.
                            </p>
                        </div>
                    </CardContent>
                </Card>


                {/* FAQ SECTION */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold">FAQs</h2>

                    <Accordion type="single" collapsible>
                        {faq.map((item, index) => (
                            <AccordionItem key={item.id} value={`faq-${index}`}>
                                <AccordionTrigger className="font-semibold hover:no-underline">
                                    {item.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    {item.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>

            </div>
        </AppLayout>
    );
}
