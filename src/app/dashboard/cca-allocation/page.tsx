import { Quicksand, Space_Mono } from "next/font/google";

import { CupidAnimation } from "@/components/allocation/cupid-animation";

const quicksand = Quicksand({
	subsets: ["latin"],
	variable: "--font-quicksand",
	weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
	subsets: ["latin"],
	variable: "--font-space-mono",
	weight: ["400", "700"],
});

export default function CCAAllocationGuide() {
	return (
		<div className={`${quicksand.variable} ${spaceMono.variable}`}>
			<CupidAnimation />
		</div>
	);
}
