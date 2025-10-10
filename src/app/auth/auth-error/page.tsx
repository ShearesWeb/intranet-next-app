"use client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { AvatarImage } from "@radix-ui/react-avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense } from 'react'

export default function LoginPage() {
    const router = useRouter();
    const { error } = useAuth();

    return (
        <Suspense>
            <div className="grid min-h-svh lg:grid-cols-2">
                <div className="flex flex-col gap-4 p-6 md:p-10">
                    <div className="flex justify-center gap-2 md:justify-start">
                        <Link href="/" className="flex items-center gap-2 font-medium">
                            <Avatar>
                                <AvatarImage src="/lion-logo.png" />
                            </Avatar>
                            Sheares Web Jobs
                        </Link>
                    </div>
                    <div className="flex flex-1 items-center justify-center">
                        <div className="w-full max-w-sm">
                            <Card>
                                <CardContent className="p-8 pt-4 pb-4 flex flex-col gap-8">
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <h1 className="text-2xl font-bold">Sheares Web Job Portal</h1>
                                        <p className="text-muted-foreground text-sm text-balance">
                                            There was an error signing you in.
                                        </p>
                                        {error && <p className="text-muted-foreground text-sm text-balance">
                                            {error.message}
                                        </p>}
                                    </div>
                                    <div className="grid gap-6">
                                        <Button className="w-full p-5" variant={"outline"} onClick={() => router.push('/auth/login')}>
                                            Retry Login
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
                <div className="bg-muted hidden lg:flex bg-primary justify-center items-center relative" style={{ height: '100vh' }}>
                    <img
                        src="/images/shweb-logo.png"
                        alt="Image"
                        className="w-1/2 object-cover dark:brightness-[0.2] dark:grayscale"
                    />
                </div>
            </div>
        </Suspense>
    )
}
