export interface SportsCultureCca {
	id: number;
	name: string;
	cca_type: "sports" | "culture";
}

export interface SportsCulturePositionJoin {
	name: string;
	position_type: string;
	cca_id: number;
	ccas: SportsCultureCca | SportsCultureCca[] | null;
}

export interface SportsCultureAppointment {
	position_id: number;
	cca_positions: SportsCulturePositionJoin | SportsCulturePositionJoin[] | null;
}
