import type { CCAData } from "@/features/cca/types/cca-data";
import type { RecapData } from "@/features/ranking/types/recap";
import { isResidentPositionType } from "@/features/ranking/utils/cca-ranking-metrics";
import type { User } from "@/types/User";

const leadershipPositionTypes = new Set(["lead", "vice", "maincomm", "subcomm"]);

function isLeadershipRole(cca: Pick<CCAData, "position_type" | "role">) {
	const positionType = String(cca.position_type || "")
		.trim()
		.toLowerCase();
	const role = String(cca.role || "")
		.trim()
		.toLowerCase();

	return (
		leadershipPositionTypes.has(positionType) || role.includes("lead") || role.includes("vice")
	);
}

function isBlockCcaName(value?: string | null) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.startsWith("block");
}

function isResidentBlockPosition(positionType?: string | null, role?: string | null) {
	return (
		isResidentPositionType(positionType) ||
		String(role || "")
			.trim()
			.toLowerCase() === "resident"
	);
}

export async function createRecapImageBlob(
	user: User,
	ccas: CCAData[],
	recap: RecapData,
): Promise<Blob> {
	const width = 1080;
	const height = 1350;
	const scale = 2;
	const canvas = document.createElement("canvas");
	canvas.width = width * scale;
	canvas.height = height * scale;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("ctx");
	ctx.scale(scale, scale);

	const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	};

	const grad = ctx.createLinearGradient(0, 0, width, height);
	grad.addColorStop(0, "#ff6a00");
	grad.addColorStop(0.5, "#ff9500");
	grad.addColorStop(1, "#ffb700");
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, width, height);

	const vignette = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
	vignette.addColorStop(0, "rgba(255,255,255,0.05)");
	vignette.addColorStop(1, "rgba(150, 40, 0, 0.45)");
	ctx.fillStyle = vignette;
	ctx.fillRect(0, 0, width, height);

	ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
	ctx.lineWidth = 3;
	roundedRect(40, 40, width - 80, height - 80, 24);
	ctx.stroke();

	ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
	ctx.lineWidth = 1;
	roundedRect(54, 54, width - 108, height - 108, 16);
	ctx.stroke();

	ctx.shadowColor = "rgba(0,0,0,0.2)";
	ctx.shadowBlur = 8;
	ctx.shadowOffsetY = 2;

	ctx.textAlign = "center";
	ctx.fillStyle = "#ffffff";
	ctx.font = "800 64px system-ui, -apple-system, sans-serif";
	ctx.fillText("SHEARES WRAPPED", width / 2, 160);

	ctx.font = "700 32px system-ui, -apple-system, sans-serif";
	ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
	ctx.fillText("25/26 HALL POINTS RECAP", width / 2, 220);

	ctx.font = "italic 600 40px system-ui, -apple-system, sans-serif";
	ctx.fillStyle = "#ffffff";
	const userName = (user.name || "Resident").toUpperCase();
	ctx.fillText(userName, width / 2, 280);

	ctx.shadowColor = "transparent";

	const formatName = (c: Pick<CCAData, "name" | "role" | "position_type">) =>
		isLeadershipRole(c) && c.role ? `${c.role} in ${c.name}` : c.name;

	const catDefs = [
		{
			label: "Culture",
			items: (ccas || [])
				.filter((c) => c.cca_type === "culture")
				.map((c) => ({ name: formatName(c), points: c.points || 0 })),
			total: recap.totals.culturePoints || 0,
		},
		{
			label: "Sports",
			items: (ccas || [])
				.filter((c) => c.cca_type === "sports")
				.map((c) => ({ name: formatName(c), points: c.points || 0 })),
			total: recap.totals.sportsPoints || 0,
		},
		{
			label: "Committees",
			items: (ccas || [])
				.filter((c) => {
					if (c.cca_type !== "committee") return false;
					const posType = String(c.position_type || "")
						.trim()
						.toLowerCase();
					return posType !== "member" && posType !== "resident";
				})
				.map((c) => ({ name: formatName(c), points: c.points || 0 })),
			total: recap.totals.committeePoints || 0,
		},
		{
			label: "Block",
			items: (user.appointments || [])
				.filter(
					(appointment) =>
						isBlockCcaName(appointment.cca_name) &&
						isResidentBlockPosition(appointment.position_type, appointment.position_name),
				)
				.map((appointment) => ({ name: appointment.cca_name, points: appointment.points || 0 })),
			total: recap.totals.blockPoints || 0,
		},
		{
			label: "Supplementary",
			items: (ccas || [])
				.filter((c) => c.cca_type === "supplementary")
				.map((c) => ({ name: formatName(c), points: c.points || 0 })),
			total: recap.totals.supplementaryPoints || 0,
		},
		{
			label: "Adhoc",
			items: (ccas || [])
				.filter((c) => c.cca_type === "adhoc")
				.map((c) => ({ name: formatName(c), points: c.points || 0 })),
			total: recap.totals.adhocPoints || 0,
		},
	].filter((cat) => cat.items.length > 0 || cat.total > 0);

	ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
	roundedRect(80, 330, width - 160, 710, 24);
	ctx.fill();
	ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
	ctx.lineWidth = 1;
	ctx.stroke();

	let totalLines = catDefs.length * 2;
	catDefs.forEach((c) => {
		totalLines += c.items.length;
	});

	const useTwoCols = totalLines > 11;
	const col1X = 120;
	const col1Width = useTwoCols ? (width - 290) / 2 : width - 240;
	const col2X = useTwoCols ? col1X + col1Width + 50 : col1X;

	let currentX = col1X;
	const currentWidth = col1Width;
	let y = 400;
	const maxY = 1000;

	const drawText = (
		text: string,
		x: number,
		yy: number,
		font: string,
		align: CanvasTextAlign,
		color = "#ffffff",
	) => {
		ctx.font = font;
		ctx.fillStyle = color;
		ctx.textAlign = align;
		ctx.fillText(text, x, yy);
	};

	const wrapText = (text: string, maxW: number, font: string): string[] => {
		ctx.font = font;
		const words = text.split(" ");
		const lines: string[] = [];
		let currentLine = words[0] || "";

		for (let index = 1; index < words.length; index += 1) {
			const word = words[index];
			const lineWidth = ctx.measureText(`${currentLine} ${word}`).width;
			if (lineWidth < maxW) {
				currentLine += ` ${word}`;
			} else {
				lines.push(currentLine);
				currentLine = word;
			}
		}

		lines.push(currentLine);
		return lines;
	};

	for (const cat of catDefs) {
		const spaceNeeded = 70 + cat.items.length * 40;
		if (useTwoCols && currentX === col1X && y + spaceNeeded > maxY && y > 450) {
			currentX = col2X;
			y = 400;
		}

		drawText(
			cat.label,
			currentX,
			y,
			"800 28px system-ui, -apple-system, sans-serif",
			"left",
			"#ffffff",
		);
		drawText(
			`${cat.total} pts`,
			currentX + currentWidth,
			y,
			"800 28px system-ui, -apple-system, sans-serif",
			"right",
			"#ffffff",
		);

		ctx.beginPath();
		ctx.moveTo(currentX, y + 15);
		ctx.lineTo(currentX + currentWidth, y + 15);
		ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
		ctx.stroke();

		y += 50;

		for (const item of cat.items) {
			const ptsText = `${item.points} pts`;
			ctx.font = "700 24px system-ui, -apple-system, sans-serif";
			const ptsWidth = ctx.measureText(ptsText).width;

			const nameFont = "500 24px system-ui, -apple-system, sans-serif";
			const nameMaxW = currentWidth - ptsWidth - 25;
			const nameLines = wrapText(`• ${item.name}`, nameMaxW, nameFont);
			const itemHeight = Math.max(nameLines.length * 30, 36);

			if (useTwoCols && currentX === col1X && y + itemHeight > maxY - 20) {
				currentX = col2X;
				y = 400;
			}

			drawText(
				ptsText,
				currentX + currentWidth,
				y,
				"700 24px system-ui, -apple-system, sans-serif",
				"right",
				"rgba(255, 255, 255, 0.95)",
			);

			for (let index = 0; index < nameLines.length; index += 1) {
				const lineX = currentX + 10 + (index > 0 ? 15 : 0);
				drawText(nameLines[index], lineX, y + index * 30, nameFont, "left", "rgba(255, 255, 255, 0.95)");
			}

			y += itemHeight + 6;
		}

		y += 24;
	}

	ctx.textAlign = "center";
	ctx.shadowColor = "rgba(0,0,0,0.2)";
	ctx.shadowBlur = 6;
	ctx.shadowOffsetY = 2;
	ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
	ctx.font = "800 32px system-ui, -apple-system, sans-serif";
	ctx.fillText("TOTAL SCORE", width / 2, 1120);

	ctx.fillStyle = "#ffffff";
	ctx.font = "900 150px system-ui, -apple-system, sans-serif";
	ctx.shadowColor = "rgba(0,0,0,0.4)";
	ctx.shadowBlur = 16;
	ctx.shadowOffsetY = 6;
	ctx.fillText(String(recap.totals.totalPoints), width / 2, 1260);
	ctx.shadowColor = "transparent";

	return new Promise<Blob>((resolve) => {
		canvas.toBlob((blob) => resolve(blob as Blob), "image/png", 0.92);
	});
}
