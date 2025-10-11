// C:\Ron\intranet-next-app\src\components\Sidebar.tsx
'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRoleAuth } from '@/hooks/useRoleAuth';
import { usePhaseInfo } from "@/hooks/usePhaseInfo";

function Sidebar() {
	const { isAuthorized, loading: roleLoading } = useRoleAuth();
	const { phaseInfo } = usePhaseInfo();

	// Memoize button text computation to prevent unnecessary recalculations
	const getRankCCAButtonText = useMemo(() => {
		switch (phaseInfo.phase) {
			case 'maincomm_concurrent_ranking':
				return 'Rank Maincomm';
			case 'subcomm_concurrent_ranking':
				return 'Rank Subcomm';
			default:
				return 'CCA Ranking';
		}
	}, [phaseInfo.phase]);

	const isSportsCultureAvailable = () => {
		return phaseInfo.phase === 'subcomm_concurrent_ranking';
	};

	return (
		<div style={styles.sidebar}>
			<div style={styles.logoContainer}>
				<Image
					src="/images/lion_logo.png"
					alt="Lion Logo"
					width={80}
					height={80}
					style={styles.logo}
				/>
			</div>
			<nav style={styles.nav}>
				<Link href="/dashboard" style={styles.navItem}>❤️ Home</Link>
				<Link href="/dashboard/mycca" style={{ ...styles.navItem }}>📋 My CCAs</Link>
				<Link href="/dashboard/rank" style={styles.navItem}>📊 {getRankCCAButtonText}</Link>
				{isSportsCultureAvailable() && (
					<Link href="/dashboard/sportsCulture" style={styles.navItem}>🤸 Sports & Culture</Link>
				)}
				{!roleLoading && isAuthorized && (
					<Link href="/dashboard/rankApplicants" style={styles.navItem}>👥 Rank Applicants</Link>
				)}
			</nav>
		</div>
	);
}

export default React.memo(Sidebar);

const styles = {
	sidebar: {
		width: '250px',
		background: '#FF8C1A',
		color: 'white',
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		padding: '20px'
	},
	logoContainer: {
		marginBottom: '20px'
	},
	logo: {
		borderRadius: '50%'
	},
	nav: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '15px',
		marginTop: '20px'
	},
	navItem: {
		textDecoration: 'none',
		color: 'white',
		fontSize: '16px',
		padding: '10px 15px',
		borderRadius: '5px',
		cursor: 'pointer'
	},
	active: {
		backgroundColor: '#FC7A00'
	}
};
