import { CCAPosition } from "./CCAPosition";

export interface User {
    id: number;
    name: string;
    display_name: string;
    room: string;
    email: string;
    profile_photo_url?: string | null;
    is_jcrc: boolean;
    is_admin: boolean;
    cca_positions: CCAPosition[];
}