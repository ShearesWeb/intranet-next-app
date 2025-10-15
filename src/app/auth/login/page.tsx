"use client";
import { LoginForm } from "@/components/auth/login-form";
import { Avatar } from "@/components/ui/avatar";
import { AvatarImage } from "@radix-ui/react-avatar";
import Link from "next/link";
import { Suspense } from 'react'

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
