'use client';

import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription,
} from "@/components/ui/card";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

import { Heart, Brain, Users, Activity, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CCAAllocationGuide() {
    return (
        <AppLayout>
            <div className="flex flex-col space-y-8 p-6 max-w-5xl mx-auto">

                {/* HERO SECTION */}
                <div className="flex flex-col gap-4 text-center items-center py-8">
                    <div className="bg-pink-100 p-4 rounded-full mb-2 animate-bounce">
                        <Heart className="w-12 h-12 text-pink-500 fill-pink-500" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-600">
                        The Science of Matching
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
                        Hey Shearites! Curious about how Sheares Web handles CCA allocation?
                        We use the <span className="font-bold text-foreground">Gale-Shapley algorithm</span>...
                        similar to how medical residents are matched to hospitals! 💘
                    </p>
                    
                    <div className="flex gap-4 mt-4">
                        <Link href="/dashboard/ccaAllocation/rank">
                            <Button size="lg" className="bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white border-0">
                                Start Ranking CCAs
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* HOW IT WORKS */}
                <Card className="border-none shadow-lg overflow-hidden">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <Brain className="w-6 h-6 text-violet-600" />
                            How the Algorithm Works
                        </CardTitle>
                        <CardDescription>
                            A simplified explanation of the Nobel Prize-winning algorithm that gets you your CCA.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-8 md:grid-cols-3 pt-6">
                        {/* Step 1 */}
                        <div className="relative p-6 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">1</div>
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                <Users className="w-4 h-4 text-violet-500" />
                                You Propose
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Students rank their preferred CCAs. The algorithm starts with you &quot;proposing&quot; to your #1 choice.
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="relative p-6 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">2</div>
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-violet-500" />
                                CCAs Decide
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                CCAs look at all their proposals. They tentatively hold onto their top candidates (up to their capacity) and reject the rest.
                            </p>
                        </div>

                        {/* Step 3 */}
                        <div className="relative p-6 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">3</div>
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                <Heart className="w-4 h-4 text-violet-500" />
                                Match Made!
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Rejected students propose to their next choice. This repeats until everyone is matched or positions run out. It&apos;s stable!
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* THE "TINDER" ANALOGY */}
                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="bg-gradient-to-br from-pink-50 to-white border-none shadow-md">
                        <CardHeader>
                            <CardTitle className="text-pink-600 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5" />
                                Why it&apos;s fair
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                The algorithm is considered a <strong>stable matching algorithm</strong>. This means that regardless of the number of iterations the algorithm is ran, the result will always be the same. You can&apos;t &quot;game&quot; the system by modifying environmental parameters.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-100">
                        <CardHeader>
                            <CardTitle className="text-slate-600 flex items-center gap-2">
                                <XCircle className="w-5 h-5" />
                                Common Myth
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                &quot;If I rank a popular CCA 1st, I have less chance than someone who ranks it 2nd.&quot; <br/>
                                <strong>FALSE!</strong> The algorithm always tries to match you with your highest possible preference first. Ranking it lower only hurts your chances.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* FAQ SECTION */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold pl-2 border-l-4 border-violet-500">Frequently Asked Questions</h2>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>What if I don&apos;t get any of my choices?</AccordionTrigger>
                            <AccordionContent>
                                If all the CCAs you ranked are filled by students they ranked higher than you, you might end up unmatched. We recommend ranking multiple CCAs to maximize your chances!
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                            <AccordionTrigger>Can I change my rankings after submission?</AccordionTrigger>
                            <AccordionContent>
                                Yes, you can update your rankings anytime before the deadline. The algorithm is run only after the submission period closes.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3">
                            <AccordionTrigger>Does the timestamp of my submission matter?</AccordionTrigger>
                            <AccordionContent>
                                No. Submitting early does not give you priority. Take your time to decide your true preferences.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-4">
                            <AccordionTrigger>How many CCAs can I join?</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-2">You are generally allowed to join:</p>
                                <ul className="list-disc list-inside mb-2 space-y-1 font-medium">
                                    <li>Two Maincomms</li>
                                    <li>One Maincomm and one Subcomm</li>
                                    <li>Three Subcomms</li>
                                </ul>
                                <p>
                                    Anything else requires an appeal to JCRC through the appeal form in the Shearites channel.
                                </p>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

            </div>
        </AppLayout>
    );
}
