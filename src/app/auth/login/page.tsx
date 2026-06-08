"use client";
import { LoginForm } from "@/components/auth/login-form";
import { Avatar } from "@/components/ui/avatar";
import { AvatarImage } from "@radix-ui/react-avatar";
import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";

export default function LoginPage() {
	return (
		<Suspense>
			<div className="grid min-h-svh lg:grid-cols-2">
				<div className="flex flex-col gap-4 p-6 md:p-10">
					<div className="flex justify-center gap-2 md:justify-start">
						<Link href="/" className="flex items-center gap-2 font-medium">
							<Avatar>
								<AvatarImage src="/images/shweb-logo.png" />
							</Avatar>
							Sheares Web Intranet
						</Link>
					</div>
					<div className="flex flex-1 items-center justify-center">
						<div className="w-full max-w-sm">
							<LoginForm />
						</div>
					</div>
				</div>
				<div className="hidden lg:flex h-screen bg-gradient-to-br from-primary via-orange-500 to-amber-500 justify-center items-center relative overflow-hidden">
					<div
						className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-2xl animate-[pulse-blob_3s_ease-in-out_infinite]"
						style={{ animationDelay: "0s" }}
					/>
					<div
						className="absolute top-1/3 -right-16 h-56 w-56 rounded-full bg-white/15 blur-xl animate-[pulse-blob_3s_ease-in-out_infinite]"
						style={{ animationDelay: "1s" }}
					/>
					<div
						className="absolute -bottom-20 left-1/4 h-64 w-64 rounded-full bg-white/10 blur-2xl animate-[pulse-blob_3s_ease-in-out_infinite]"
						style={{ animationDelay: "2s" }}
					/>
					<div className="relative z-10 flex flex-col items-center">
						<Image
							src="/images/shweb-logo.png"
							alt="Image"
							width={480}
							height={480}
							className="w-1/3 object-cover dark:brightness-[0.2] dark:grayscale"
						/>
						<p className="text-primary-foreground/90 text-2xl font-semibold mt-6">
							Welcome back to Sheares
						</p>
					</div>
				</div>
			</div>
		</Suspense>
	);
}
