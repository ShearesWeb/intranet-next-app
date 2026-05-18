import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRankingEditor } from "@/features/ranking/hooks/use-ranking-editor";

const toast = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));

const membersResponse = {
	members: [
		{
			user_id: 1,
			name: "Alex",
			position_id: 1,
			position: "Chair",
			position_type: "lead",
			cut_status: null,
			commitment_period: "full-year",
			ranking: 1,
			attendance: 8,
			performance: 6,
			helpfulness: 0,
			initiative: 0,
			attitude: 0,
			remarks: "steady",
		},
		{
			user_id: 2,
			name: "Blair",
			position_id: 1,
			position: "Chair",
			position_type: "lead",
			cut_status: null,
			commitment_period: "full-year",
			ranking: 2,
			attendance: 6,
			performance: 5,
			helpfulness: 0,
			initiative: 0,
			attitude: 0,
			remarks: "",
		},
	],
	cca_type: "culture",
};

describe("useRankingEditor", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	});

	const waitFor = async (assertion: () => void, timeout = 1000) => {
		const start = Date.now();
		while (Date.now() - start < timeout) {
			try {
				assertion();
				return;
			} catch {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		}
		assertion();
	};

	const renderRankingEditorHook = (ccaId: string | null) => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		const root: Root = createRoot(container);
		const result: { current: ReturnType<typeof useRankingEditor> | null } = { current: null };

		function Harness() {
			result.current = useRankingEditor(ccaId);
			return null;
		}

		act(() => {
			root.render(<Harness />);
		});

		return {
			result,
			unmount: () => {
				act(() => {
					root.unmount();
				});
				container.remove();
			},
		};
	};

	it("populates members from a successful GET and clears error", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(membersResponse), { status: 200 }),
		);

		const { result, unmount } = renderRankingEditorHook("42");

		await waitFor(() => expect(result.current?.isLoading).toBe(false));
		expect(result.current?.error).toBeNull();
		expect(result.current?.ccaType).toBe("culture");
		expect(result.current?.members).toHaveLength(2);
		expect(result.current?.positionGroups).toHaveLength(1);
		unmount();
	});

	it("surfaces failed POST errors through the hook", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(new Response(JSON.stringify(membersResponse), { status: 200 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: "Failed to save rankings" }), { status: 500 }),
			);

		const { result, unmount } = renderRankingEditorHook("42");
		await waitFor(() => expect(result.current?.isLoading).toBe(false));

		act(() => {
			result.current?.handleFieldChange("2:1", "attendance", 10);
		});

		await act(async () => {
			await result.current?.handleSave();
		});

		expect(result.current?.error).toBe("Failed to save rankings");
		expect(toast.error).toHaveBeenCalledWith("Failed to save rankings");
		unmount();
	});

	it("recomputes rankings across the group when a field changes", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(membersResponse), { status: 200 }),
		);

		const { result, unmount } = renderRankingEditorHook("42");
		await waitFor(() => expect(result.current?.isLoading).toBe(false));
		await waitFor(() => expect(result.current?.ccaType).toBe("culture"));

		await act(async () => {
			result.current?.handleFieldChange("2:1", "attendance", 10);
			await Promise.resolve();
		});

		await waitFor(() =>
			expect(result.current?.members.find((member) => member.user_id === 2)?.ranking).toBe(1),
		);
		expect(result.current?.members.find((member) => member.user_id === 1)?.ranking).toBe(2);
		unmount();
	});
});
