import { buildRankingComments, extractRankingCommentFields } from "./cca-ranking-comments";

describe("extractRankingCommentFields", () => {
	it("returns all-null fields for empty or non-object input", () => {
		expect(extractRankingCommentFields(null)).toEqual({
			attendance: null,
			performance: null,
			helpfulness: null,
			initiative: null,
			attitude: null,
			remarks: null,
		});

		expect(extractRankingCommentFields("captain")).toEqual({
			attendance: null,
			performance: null,
			helpfulness: null,
			initiative: null,
			attitude: null,
			remarks: null,
		});
	});

	it("preserves the legacy initiative fallback for resident comments", () => {
		expect(extractRankingCommentFields({ initiative: 8, remarks: "steady" })).toEqual({
			attendance: null,
			performance: null,
			helpfulness: 8,
			initiative: 8,
			attitude: 8,
			remarks: "steady",
		});
	});
});

describe("buildRankingComments", () => {
	it("keeps populated attendance and performance fields only", () => {
		expect(buildRankingComments({ attendance: 9, performance: 7, remarks: "captain" })).toEqual({
			attendance: 9,
			performance: 7,
			remarks: "captain",
		});
	});

	it("omits blank remarks and null metrics", () => {
		expect(
			buildRankingComments({
				attendance: 9,
				performance: null,
				helpfulness: null,
				initiative: 8,
				attitude: null,
				remarks: "   ",
			}),
		).toEqual({
			attendance: 9,
			initiative: 8,
		});
	});
});
