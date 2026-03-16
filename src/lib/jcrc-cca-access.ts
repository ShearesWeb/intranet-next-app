import { AuthenticatedUser, UserAppointment } from "@/types/User";

const JCRC_APPOINTMENT_NAME_PATTERN = /(jcrc|junior common room committee)/i;

const JCRC_POSITION_TO_CCA_NAMES = {
    "President": [
        "Receive And Give (RAG) - Outgoing",
        "Sheares Web",
    ],
    "Vice President (Admin)": [],
    "Vice President (Operations)": [
        "Block Committee (A)",
        "Block Committee (B)",
        "Block Committee (C)",
        "Block Committee (D)",
        "Block Committee (E)",
        "Hall Welfare and Amenities Committee (HWAC)",
    ],
    "Director of Finance": [],
    "Director of Social Functions": [
        "Dinner And Dance (DND)",
        "Sheares Link (SL)",
    ],
    "Director of Welfare": [],
    "Director of Information": [
        "Sheares Production (SP)",
        "Overseas Community Service Project (OCSP)",
    ],
    "Director of Internal Affairs": [
        "Sheares Welcome Orientation Committee (SWOC) - Outgoing",
        "Sheares Hall Voluntary Corps (SHVC)",
        "Sheares Flag - Outgoing",
    ],
    "Director of External Affairs": [
        "Sheares Engagement Camp Committee (SECC) - Outgoing",
        "External Relations Committee (ERC)",
        "Consheares",
    ],
    "Director of Cultural Affairs": [
        "Cultural Management Board (CMB)",
        "Band",
        "Danshers",
        "Geyao",
        "Enshemble",
        "Shacapella",
        "Chorale",
        "Beats",
    ],
    "Director of Sports": [
        "Badminton M",
        "Badminton F",
        "Basketball M",
        "Basketball F",
        "Floorball M",
        "Floorball F",
        "Handball M",
        "Handball F",
        "Netball",
        "Road Relay",
        "Track",
        "Sepak Takraw",
        "Football M",
        "Football F",
        "Softball",
        "Squash M",
        "Squash F",
        "Swim",
        "Table Tennis M",
        "Table Tennis F",
        "Tennis M",
        "Tennis F",
        "Touch Rugby M",
        "Touch Rugby F",
        "Volleyball M",
        "Volleyball F",
        "Ultimate Frisbee",
        "Sports Management Board (SMB)",
    ],
    "Director of Media": [
        "Sheares Media (SHM)",
    ],
} as const satisfies Record<string, readonly string[]>;

const normalizedJcrcPositionToCcaNames = new Map<string, readonly string[]>(
    Object.entries(JCRC_POSITION_TO_CCA_NAMES).map(([positionName, ccaNames]) => [
        positionName.trim().replace(/\s+/g, " ").toLowerCase(),
        ccaNames,
    ])
);

export function getJcrcManagedCcaNamesFromAppointments(
    user: Pick<AuthenticatedUser, "is_jcrc" | "appointments"> | null | undefined
) {
    if (!user?.is_jcrc) {
        return [] as string[];
    }

    const allowedCcaNames = new Set<string>();
    const explicitJcrcAppointments = (user.appointments || []).filter((appointment) =>
        JCRC_APPOINTMENT_NAME_PATTERN.test(appointment.cca_name || "")
    );
    const relevantAppointments = explicitJcrcAppointments.length > 0
        ? explicitJcrcAppointments
        : (user.appointments || []);

    relevantAppointments.forEach((appointment) => {
        const mappedCcaNames = normalizedJcrcPositionToCcaNames.get(
            (appointment.position_name || "").trim().replace(/\s+/g, " ").toLowerCase()
        );

        mappedCcaNames?.forEach((ccaName) => {
            allowedCcaNames.add(ccaName);
        });
    });

    return Array.from(allowedCcaNames);
}

export function canJcrcAccessCca(
    jcrcManagedCcaNames: string[],
    ccaName: string | null | undefined
) {
    if (!ccaName) {
        return false;
    }

    const normalizedTargetName = ccaName.trim().replace(/\s+/g, " ").toLowerCase();
    return jcrcManagedCcaNames.some(
        (allowedName) => allowedName.trim().replace(/\s+/g, " ").toLowerCase() === normalizedTargetName
    );
}
