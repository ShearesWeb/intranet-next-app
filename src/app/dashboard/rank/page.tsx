// C:\Ron\intranet-next-app\src\app\dashboard\rankCCAs\page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface RankablePosition {
	id: number;
	name: string;
	cca_name: string;
	position_type: 'maincomm' | 'subcomm';
	capacity: number;
	description?: string;
	user_ranking?: number | null;
	is_selected?: boolean;
}

export default function RankCCA() {
	const { user } = useAuth();
	const [allPositions, setAllPositions] = useState<RankablePosition[]>([]);
	const [selectedPositions, setSelectedPositions] = useState<RankablePosition[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [currentStep, setCurrentStep] = useState<'selection' | 'ranking'>('selection');
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

	// NEW: State for tracking changes
	const [initialSelectedIds, setInitialSelectedIds] = useState<Set<number>>(new Set());
	const [initialRankingOrder, setInitialRankingOrder] = useState<number[]>([]);
	const [hasChanges, setHasChanges] = useState(false);

	// NEW: Function to detect changes
	const detectChanges = () => {
		// Check if selected IDs changed
		const selectedIdsChanged = selectedIds.size !== initialSelectedIds.size ||
			[...selectedIds].some(id => !initialSelectedIds.has(id));

		// Check if ranking order changed
		const currentOrder = selectedPositions.map(p => p.id);
		const rankingOrderChanged = JSON.stringify(currentOrder) !== JSON.stringify(initialRankingOrder);

		const changes = selectedIdsChanged || rankingOrderChanged;
		setHasChanges(changes);
		return changes;
	};

	// NEW: Update hasChanges when selectedIds or selectedPositions change
	useEffect(() => {
		detectChanges();
	}, [selectedIds, selectedPositions, initialSelectedIds, initialRankingOrder]);

	// Fetch available positions for ranking
	useEffect(() => {
		if (!user?.email) return;

		const fetchRankablePositions = async () => {
			try {
				const response = await fetch(`/api/user/getRankablePositions/${user.email}`);
				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || "Failed to fetch rankable positions");
				}
				const data = await response.json();
				setAllPositions(data.positions || []);

				// Pre-select previously ranked positions
				const preSelected = new Set<number>(
					data.positions?.filter((p: RankablePosition) => p.is_selected).map((p: RankablePosition) => p.id) || []
				);
				setSelectedIds(preSelected);
				setInitialSelectedIds(new Set(preSelected)); // NEW: Store initial state

				// If user has already ranked some positions, show ranking step
				if (preSelected.size > 0) {
					const selected = data.positions?.filter((p: RankablePosition) => preSelected.has(p.id)) || [];
					// Sort by existing user ranking
					selected.sort((a: RankablePosition, b: RankablePosition) => (a.user_ranking || 999) - (b.user_ranking || 999));
					setSelectedPositions(selected);
					setInitialRankingOrder(selected.map((p: RankablePosition) => p.id));
					setCurrentStep('ranking');
				} else {
					setInitialRankingOrder([]);
				}

				setHasChanges(false); // Reset changes on load
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
				console.error("Error fetching rankable positions:", errorMessage);
				toast.error(errorMessage);
			} finally {
				setLoading(false);
			}
		};

		fetchRankablePositions();
	}, [user?.email]);

	// Handle position selection
	const togglePositionSelection = (positionId: number) => {
		setSelectedIds(prev => {
			const newSet = new Set(prev);
			if (newSet.has(positionId)) {
				newSet.delete(positionId);
			} else {
				newSet.add(positionId);
			}
			return newSet;
		});
	};

	// Proceed to ranking step - UPDATED to allow 0 selections
	const proceedToRanking = () => {
		const selected = allPositions.filter(p => selectedIds.has(p.id));

		// Sort selected positions alphabetically
		selected.sort((a, b) => a.name.localeCompare(b.name));
		setSelectedPositions(selected);
		setCurrentStep('ranking');
	};

	// Back to selection
	const backToSelection = () => {
		setCurrentStep('selection');
	};

	// Move item up in ranking
	const moveUp = (index: number) => {
		if (index === 0) return;
		const newPositions = [...selectedPositions];
		[newPositions[index], newPositions[index - 1]] = [newPositions[index - 1], newPositions[index]];
		setSelectedPositions(newPositions);
	};

	// Move item down in ranking
	const moveDown = (index: number) => {
		if (index === selectedPositions.length - 1) return;
		const newPositions = [...selectedPositions];
		[newPositions[index], newPositions[index + 1]] = [newPositions[index + 1], newPositions[index]];
		setSelectedPositions(newPositions);
	};

	// Save rankings to database - UPDATED to allow empty rankings
	const saveRankings = async () => {
		if (!user?.email) return;

		setSaving(true);
		try {
			const rankings = selectedPositions.map((position, index) => ({
				position_id: position.id,
				ranking: index + 1
			}));

			const response = await fetch('/api/user/saveRankings', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					email: user.email,
					rankings
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to save rankings");
			}

			toast.success("Rankings saved successfully!");

			// ✅ NEW: Refresh data from server to ensure UI is in sync
			const refreshResponse = await fetch(`/api/user/getRankablePositions/${user.email}`);
			if (refreshResponse.ok) {
				const refreshData = await refreshResponse.json();
				setAllPositions(refreshData.positions || []);

				// Update the selected positions with fresh user_ranking data
				const updatedSelected = selectedPositions.map(pos => {
					const freshData = refreshData.positions.find((p: RankablePosition) => p.id === pos.id);
					return freshData ? { ...pos, user_ranking: freshData.user_ranking } : pos;
				});
				setSelectedPositions(updatedSelected);
			}

			// Update initial state after successful save
			setInitialSelectedIds(new Set(selectedIds));
			setInitialRankingOrder(selectedPositions.map(p => p.id));
			setHasChanges(false);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
			console.error("Error saving rankings:", errorMessage);
			toast.error(errorMessage);
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div style={styles.container}>
				<Sidebar />
				<div style={styles.content}>
					<div style={styles.loading}>Loading available positions...</div>
				</div>
			</div>
		);
	}

	// SELECTION STEP
	if (currentStep === 'selection') {
		return (
			<div style={styles.container}>
				<Sidebar />
				<div style={styles.content}>
					<div style={styles.header}>
						<h1 style={styles.title}>Select CCA Positions to Rank</h1>
						<p style={styles.subtitle}>
							You were considered for the following positions. Select which ones you're interested in, then rank them.
						</p>
					</div>

					{allPositions.length === 0 ? (
						<div style={styles.emptyState}>
							<p>No positions available for ranking at this time.</p>
							<p>Positions will appear here after CCA chairs complete their rankings.</p>
						</div>
					) : (
						<>
							<div style={styles.instructionsBar}>
								<span style={styles.instructionText}>
									{selectedIds.size} of {allPositions.length} positions selected
								</span>
								<button
									style={styles.proceedButton} // UPDATED: Always enabled
									onClick={proceedToRanking}
								>
									Proceed to Ranking →
								</button>
							</div>

							<div style={styles.selectionContainer}>
								{allPositions.map((position) => (
									<div
										key={position.id}
										style={{
											...styles.selectionCard,
											...(selectedIds.has(position.id) ? styles.selectedCard : {})
										}}
										onClick={() => togglePositionSelection(position.id)}
									>
										<div style={styles.checkbox}>
											<input
												type="checkbox"
												checked={selectedIds.has(position.id)}
												onChange={() => { }}
												style={styles.checkboxInput}
											/>
										</div>

										<div style={styles.positionInfo}>
											<h3 style={styles.positionName}>{position.name}</h3>
											<p style={styles.ccaName}>{position.cca_name}</p>
											<div style={styles.positionMeta}>
												<span style={styles.positionType}>
													{position.position_type === 'maincomm' ? 'Main Committee' : 'Sub Committee'}
												</span>
												<span style={styles.capacity}>
													Capacity: {position.capacity}
												</span>
											</div>
											{position.description && (
												<p style={styles.description}>{position.description}</p>
											)}
										</div>
									</div>
								))}
							</div>
						</>
					)}
				</div>
			</div>
		);
	}

	// RANKING STEP
	return (
		<div style={styles.container}>
			<Sidebar />
			<div style={styles.content}>
				<div style={styles.header}>
					<h1 style={styles.title}>Rank Your Selected CCA Positions</h1>
					<p style={styles.subtitle}>
						{selectedPositions.length === 0
							? "No positions selected. You can save this to clear all your rankings, or go back to select positions."
							: "Drag and drop or use arrows to rank your preferred CCA positions. Higher positions have higher priority."
						}
					</p>
				</div>

				<div style={styles.instructionsBar}>
					<button
						style={styles.backButton}
						onClick={backToSelection}
					>
						← Back to Selection
					</button>
					<span style={styles.instructionText}>
						{selectedPositions.length} position{selectedPositions.length !== 1 ? 's' : ''} to rank
					</span>
					<button
						style={
							saving
								? styles.saveButtonDisabled
								: hasChanges
									? styles.saveButton
									: styles.saveButtonDisabled
						}
						onClick={saveRankings}
						disabled={saving || !hasChanges}
					>
						{saving ? 'Saving...' : 'Save Rankings'}
					</button>
				</div>

				<div style={styles.rankingContainer}>
					{selectedPositions.length === 0 ? (
						<div style={styles.emptyRankingState}>
							<p>No positions selected for ranking.</p>
							<p>Go back to selection to choose positions, or save to clear all your existing rankings.</p>
						</div>
					) : (
						selectedPositions.map((position, index) => (
							<div key={position.id} style={styles.positionCard}>
								<div style={styles.rankNumber}>{index + 1}</div>

								<div style={styles.positionInfo}>
									<h3 style={styles.positionName}>{position.name}</h3>
									<p style={styles.ccaName}>{position.cca_name}</p>
									<div style={styles.positionMeta}>
										<span style={styles.positionType}>
											{position.position_type === 'maincomm' ? 'Main Committee' : 'Sub Committee'}
										</span>
										<span style={styles.capacity}>
											Capacity: {position.capacity}
										</span>
									</div>
									{position.description && (
										<p style={styles.description}>{position.description}</p>
									)}
								</div>

								<div style={styles.controls}>
									<button
										style={index === 0 ? styles.controlButtonDisabled : styles.controlButton}
										onClick={() => moveUp(index)}
										disabled={index === 0}
										title="Move up"
									>
										↑
									</button>
									<button
										style={index === selectedPositions.length - 1 ? styles.controlButtonDisabled : styles.controlButton}
										onClick={() => moveDown(index)}
										disabled={index === selectedPositions.length - 1}
										title="Move down"
									>
										↓
									</button>
								</div>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}

const styles = {
	container: {
		display: 'flex',
		height: '100vh',
		fontFamily: 'Arial, sans-serif'
	},
	content: {
		flex: 1,
		padding: '20px',
		backgroundColor: '#FFFFFF',
		color: '#2C2C2C',
		overflow: 'auto'
	},
	header: {
		marginBottom: '30px'
	},
	title: {
		fontSize: '28px',
		marginBottom: '10px',
		fontWeight: 'bold',
		color: '#4A4A4A'
	},
	subtitle: {
		fontSize: '14px',
		color: '#7A7A7A',
		margin: '0'
	},
	loading: {
		textAlign: 'center' as const,
		fontSize: '16px',
		color: '#7A7A7A',
		marginTop: '50px'
	},
	emptyState: {
		textAlign: 'center' as const,
		padding: '50px 20px',
		color: '#7A7A7A'
	},
	emptyRankingState: {
		textAlign: 'center' as const,
		padding: '50px 20px',
		color: '#7A7A7A',
		backgroundColor: '#F8F9FA',
		borderRadius: '8px',
		border: '2px dashed #E5E7EB'
	},
	instructionsBar: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: '20px',
		padding: '15px',
		backgroundColor: '#F8F9FA',
		borderRadius: '8px'
	},
	instructionText: {
		fontSize: '14px',
		color: '#6B7280'
	},
	proceedButton: {
		backgroundColor: '#3B82F6',
		color: 'white',
		padding: '10px 20px',
		borderRadius: '6px',
		border: 'none',
		cursor: 'pointer',
		fontSize: '14px',
		fontWeight: 'bold'
	},
	backButton: {
		backgroundColor: '#6B7280',
		color: 'white',
		padding: '10px 15px',
		borderRadius: '6px',
		border: 'none',
		cursor: 'pointer',
		fontSize: '14px'
	},
	saveButton: {
		backgroundColor: '#10B981',
		color: 'white',
		padding: '10px 20px',
		borderRadius: '6px',
		border: 'none',
		cursor: 'pointer',
		fontSize: '14px',
		fontWeight: 'bold'
	},
	saveButtonDisabled: {
		backgroundColor: '#9CA3AF',
		color: 'white',
		padding: '10px 20px',
		borderRadius: '6px',
		border: 'none',
		cursor: 'not-allowed',
		fontSize: '14px',
		fontWeight: 'bold'
	},
	selectionContainer: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '12px'
	},
	selectionCard: {
		display: 'flex',
		alignItems: 'center',
		padding: '20px',
		backgroundColor: '#FFFFFF',
		borderWidth: '2px',
		borderStyle: 'solid',
		borderColor: '#E5E7EB',
		borderRadius: '8px',
		cursor: 'pointer',
		transition: 'all 0.2s ease'
	},
	selectedCard: {
		borderColor: '#3B82F6',
		backgroundColor: '#EFF6FF'
	},
	checkbox: {
		marginRight: '15px'
	},
	checkboxInput: {
		width: '20px',
		height: '20px'
	},
	rankingContainer: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '12px'
	},
	positionCard: {
		display: 'flex',
		alignItems: 'center',
		padding: '20px',
		backgroundColor: '#FFFFFF',
		border: '1px solid #E5E7EB',
		borderRadius: '8px',
		boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
		transition: 'all 0.2s ease'
	},
	rankNumber: {
		fontSize: '24px',
		fontWeight: 'bold',
		color: '#6B7280',
		marginRight: '20px',
		minWidth: '40px',
		textAlign: 'center' as const
	},
	positionInfo: {
		flex: 1,
		marginRight: '20px'
	},
	positionName: {
		fontSize: '18px',
		fontWeight: 'bold',
		color: '#1F2937',
		margin: '0 0 5px 0'
	},
	ccaName: {
		fontSize: '16px',
		color: '#4B5563',
		margin: '0 0 10px 0'
	},
	positionMeta: {
		display: 'flex',
		gap: '15px',
		marginBottom: '8px'
	},
	positionType: {
		fontSize: '12px',
		padding: '4px 8px',
		backgroundColor: '#EFF6FF',
		color: '#1D4ED8',
		borderRadius: '4px',
		fontWeight: 'bold'
	},
	capacity: {
		fontSize: '12px',
		color: '#6B7280',
		alignSelf: 'center'
	},
	description: {
		fontSize: '13px',
		color: '#6B7280',
		margin: '0'
	},
	controls: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '8px'
	},
	controlButton: {
		width: '40px',
		height: '40px',
		borderRadius: '6px',
		border: '1px solid #D1D5DB',
		backgroundColor: '#FFFFFF',
		cursor: 'pointer',
		fontSize: '18px',
		color: '#4B5563',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		transition: 'all 0.2s ease'
	},
	controlButtonDisabled: {
		width: '40px',
		height: '40px',
		borderRadius: '6px',
		border: '1px solid #E5E7EB',
		backgroundColor: '#F9FAFB',
		cursor: 'not-allowed',
		fontSize: '18px',
		color: '#D1D5DB',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center'
	}
};
