import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";

const Page = async () => {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (user) {
		redirect("/dashboard");
	}

	return (
		<section className="flex min-h-screen flex-col items-center lg:justify-center text-center p-24">
			<div className="hidden lg:block absolute inset-x-0 top-0 flex h-full w-full items-center justify-center opacity-100">
				<Image
					alt="background"
					src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/patterns/square-alt-grid.svg"
					fill
					sizes="100vw"
					className="[mask-image:radial-gradient(75%_75%_at_center,white,transparent)] opacity-90"
				/>
			</div>
			<div className="relative z-10 container">
				<div className="mx-auto flex max-w-5xl flex-col items-center">
					<div className="flex flex-col items-center gap-6 text-center">
						<div
							className="rounded-xl bg-background/30 p-4 shadow-sm backdrop-blur-sm animate-[fade-in-up_0.3s_ease-out_both]"
							style={{ animationDelay: "0.05s" }}
						>
							<Image
								src="/images/shweb-logo.png"
								alt="logo"
								width={64}
								height={64}
								className="h-16"
							/>
						</div>
						<div>
							<h1
								className="mb-4 text-2xl font-bold tracking-tight text-pretty lg:text-5xl animate-[fade-in-up_0.3s_ease-out_both]"
								style={{ animationDelay: "0.1s" }}
							>
								Welcome to the <span className="text-primary">Sheares Intranet</span>
							</h1>
							<p
								className="text-muted-foreground text-base lg:text-lg max-w-xl animate-[fade-in-up_0.3s_ease-out_both]"
								style={{ animationDelay: "0.15s" }}
							>
								Manage your CCAs, track your points, and handle subsidy declarations — all in one
								place.
							</p>
						</div>
						<div
							className="mt-6 flex justify-center gap-3 animate-[fade-in-up_0.3s_ease-out_both]"
							style={{ animationDelay: "0.2s" }}
						>
							<Link href={"/auth/login"}>
								<Button className="shadow-sm transition-all hover:shadow hover:scale-105 active:scale-[0.95] text-lg md:text-xl px-6 py-5 md:px-8 md:py-6">
									Login Now
								</Button>
							</Link>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default Page;
