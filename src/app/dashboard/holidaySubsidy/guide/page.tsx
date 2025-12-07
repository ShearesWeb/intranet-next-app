'use client';

import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';

import {
    Card,
    CardHeader,
    CardTitle,
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
import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon, InfoIcon, FileCheck, CheckCircle, Users, Calculator } from 'lucide-react';


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
        answer: "Yes. You can edit declarations at any time, even after JCRC approval. However, editing an approved declaration will reset its status to 'Pending' and require JCRC to re-approve it.",
    },
    {
        id: "faq-3",
        question: "Can I increase a member's actual weekly hours later?",
        answer: "Yes, it is allowed, but do not expect the holiday subsidy to be approved. JCRC may reject it if the increase is unreasonable.",
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
            <div className="flex flex-col space-y-6 p-4">

                {/* PAGE TITLE */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold">Holiday Subsidy Guide</h1>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Full process, requirements, and FAQs for the holiday subsidy system.
                    </p>
                </div>

                {/* PROCESS OVERVIEW */}
                <Card className="bg-card/40">
                    <CardContent className="pt-6 pb-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="flex flex-col items-center text-center space-y-2">
                                <FileCheck className="w-8 h-8 text-muted-foreground" />
                                <div className="font-semibold text-sm">Phase 1</div>
                                <div className="text-xs text-muted-foreground">Declaration</div>
                            </div>
                            <div className="flex flex-col items-center text-center space-y-2">
                                <CheckCircle className="w-8 h-8 text-muted-foreground" />
                                <div className="font-semibold text-sm">Phase 2</div>
                                <div className="text-xs text-muted-foreground">JCRC Approval</div>
                            </div>
                            <div className="flex flex-col items-center text-center space-y-2">
                                <Users className="w-8 h-8 text-muted-foreground" />
                                <div className="font-semibold text-sm">Phase 3</div>
                                <div className="text-xs text-muted-foreground">Weekly Submissions</div>
                            </div>
                            <div className="flex flex-col items-center text-center space-y-2">
                                <Calculator className="w-8 h-8 text-muted-foreground" />
                                <div className="font-semibold text-sm">Phase 4</div>
                                <div className="text-xs text-muted-foreground">Final Calculation</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* PHASES */}
                <div className="space-y-4">
                    {/* Phase 1 */}
                    <Card>
                        <CardHeader>
                            <div className="space-y-2">
                                <CardTitle className="text-lg font-semibold">Phase 1 — Initial Subsidy Declaration</CardTitle>
                                <div className="flex items-center gap-2">
                                    <Badge variant="default">Chairs</Badge>
                                    <Badge variant="destructive">Due: Before Commencement of Week</Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Chairs declare subsidy requirements for the entire holiday period. For each position, provide weekly hours and a sound justification.
                            </p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                You can create new declarations and if JCRC rejects them, edit and resubmit; they will re-enter the approval queue.
                            </p>

                            <Alert>
                                <AlertCircleIcon className="h-4 w-4" />
                                <AlertTitle className="text-sm font-semibold">Valid Justifications Required</AlertTitle>
                                <AlertDescription className="text-sm space-y-3">
                                    <p>
                                        For <strong>each position</strong>, provide weekly hours and a sound justification that is measurable and accurate.
                                    </p>

                                    <p className="font-medium">Example of valid justification:</p>
                                    <div className="space-y-1">
                                        <div><strong>CCA:</strong> Swim Team</div>
                                        <div><strong>Position:</strong> Members</div>
                                        <div><strong>Week 1 Training:</strong></div>
                                        <ul className="list-disc list-inside ml-4">
                                            <li>Wednesday — 2 hours</li>
                                            <li>Friday — 2 hours</li>
                                        </ul>
                                        <div className="pt-1"><strong>Total Declared Hours:</strong> 4 hours for Week 1</div>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>

                    {/* Phase 2 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold">Phase 2 — JCRC Approval</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">JCRC verifies justifications and validates weekly hour allocations. After approval, Chairs may edit approved declarations at any time but doing so will reset the status to <strong>Pending</strong> and require re-approval.</p>
                        </CardContent>
                    </Card>

                    {/* Phase 3 */}
                    <Card>
                        <CardHeader>
                            <div className="space-y-2">
                                <CardTitle className="text-lg font-semibold">Phase 3 — Weekly Commitment Declaration</CardTitle>
                                <div className="flex items-center gap-2">
                                    <Badge variant="default">Chairs</Badge>
                                    <Badge variant="destructive">Due: End of Each Week</Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Chairs must submit actual hours committed by each member weekly.
                            </p>

                            <Alert variant="destructive" className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
                                <AlertTriangleIcon className="h-4 w-4" />
                                <AlertTitle className="text-sm font-semibold">Weekly Deadline</AlertTitle>
                                <AlertDescription className="text-sm">
                                    <p>
                                        Submission closes every <strong>Tuesday 23:59</strong>. Missing the deadline automatically voids the subsidy for that week.
                                    </p>
                                    <p>
                                        Example: Week 1's Subsidies are due by Week 2 Tuesday 23:59
                                    </p>
                                </AlertDescription>
                            </Alert>

                            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    The interface auto-fills recommended values based on approved declarations from Phase 1. You may decrease hours and add remarks, but you cannot increase them.
                                </p>

                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-600 mt-0.5">•</span>
                                        <span>Each member appears as a row in the table prefilled according to the previous subsidy declaration.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-amber-600 mt-0.5">•</span>
                                        <span>By default, all members are marked as <strong>not having committed any hours</strong>.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-600 mt-0.5">•</span>
                                        <span>You must manually <strong>tick</strong> each member you want to confirm hours for.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-0.5">•</span>
                                        <span>Modify the number of hours if the member's contributions are less than planned.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-0.5">•</span>
                                        <span>You may add <strong>remarks</strong> to explain reduced hours or exceptions.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-600 mt-0.5">•</span>
                                        <span>Hours cannot be increased beyond the approved subsidy declaration.</span>
                                    </li>
                                </ul>
                            </div>

                            <Alert>
                                <CheckCircle2Icon className="h-4 w-4" />
                                <AlertTitle className="text-sm font-semibold">Why the Interface Is Designed This Way</AlertTitle>
                                <AlertDescription className="text-sm leading-relaxed">
                                    <p>
                                        The submission interface requires chairs to manually confirm each member every week because it encourages <strong>intentional and thoughtful verification</strong> of actual participation. By reviewing every row, chairs must actively assess whether members genuinely showed up, contributed, and fulfilled the hours committed.<br /><br />This design prevents passive or blanket approvals and ensures that subsidy allocations reflect <strong>real, meaningful work</strong> rather than assumptions or default values. It reinforces fairness across all CCAs and upholds accountability in the subsidy process.
                                    </p>
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>

                    {/* Phase 4 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold">Phase 4 — Final Subsidy Calculation</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                At the end of the holiday, JCRC and SHWeb will run the subsidy algorithm to compute final eligible amounts.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* FAQ SECTION */}
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="text-lg font-semibold">Frequently Asked Questions</div>
                        <p className="text-sm text-muted-foreground">Common questions about the subsidy process</p>
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                        {faq.map((item, index) => (
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

            </div>
        </AppLayout >
    );
}
