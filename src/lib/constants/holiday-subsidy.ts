// Holiday subsidy week options for AY 2024/2025
export const WEEK_OPTIONS = [
    { id: 1, label: "Week 1 (Dec 4 - Dec 10)" },
    { id: 2, label: "Week 2 (Dec 11 - Dec 17)" },
    { id: 3, label: "Week 3 (Dec 18 - Dec 24)" },
    { id: 4, label: "Week 4 (Dec 25 - Dec 31)" },
    { id: 5, label: "Week 5 (Jan 1 - Jan 7)" },
    { id: 6, label: "Week 6 (Jan 8 - Jan 14)" },
    { id: 7, label: "Week 7 (Jan 15 - Jan 21)" },
    { id: 8, label: "Week 8 (Jan 22 - Jan 28)" },
    { id: 9, label: "Week 9 (Jan 29 - Feb 4)" },
    { id: 10, label: "Week 10 (Feb 5 - Feb 11)" },
] as const;

//Valid subsidy statuses for validation
export const VALID_STATUSES = new Set(["pending", "approved", "rejected"]);

