// // src/app/dashboard/rank/page.tsx
// 'use client';

// import React, { useEffect, useState, useCallback } from 'react';
// import Sidebar from '@/components/Sidebar';
// import { useAuth } from '@/context/AuthContext';
// import { usePhaseInfo } from '@/hooks/usePhaseInfo';
// import toast from 'react-hot-toast';

// interface RankablePosition {
// 	id: number;
// 	name: string;
// 	cca_name: string;
// 	position_type: 'maincomm' | 'subcomm' | 'blockcomm';
// 	capacity: number;
// 	available_capacity: number;
// 	applied_count: number;
// 	description?: string;
// 	user_ranking?: number | null;
// 	is_selected?: boolean;
// }

// function LoadingOverlay({ visible }: { visible: boolean }) {
// 	if (!visible) return null;

// 	return (
// 		<div style={styles.loadingOverlay}>
// 			<div style={styles.loadingContent}>
// 				<div style={styles.spinner}></div>
// 				<p style={styles.loadingText}>Saving rankings...</p>
// 			</div>
// 		</div>
// 	);
// }

// export default function RankCCA() {
// 	const { user } = useAuth();
// 	const { phaseInfo, loading: phaseLoading } = usePhaseInfo();
// 	const [allPositions, setAllPositions] = useState<RankablePosition[]>([]);
// 	const [selectedPositions, setSelectedPositions] = useState<RankablePosition[]>([]);
// 	const [loading, setLoading] = useState(true);
// 	const [isSaving, setIsSaving] = useState<boolean>(false);
// 	const [currentStep, setCurrentStep] = useState<'selection' | 'ranking'>('selection');
// 	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
// 	const [searchTerm, setSearchTerm] = useState(''); // Added search state

// 	// State for tracking changes
// 	const [initialSelectedIds, setInitialSelectedIds] = useState<Set<number>>(new Set());
// 	const [initialRankingOrder, setInitialRankingOrder] = useState<number[]>([]);
// 	const [hasChanges, setHasChanges] = useState(false);

// 	// Function to detect changes
// 	const detectChanges = useCallback(() => {
// 		const selectedIdsChanged = selectedIds.size !== initialSelectedIds.size ||
// 			[...selectedIds].some(id => !initialSelectedIds.has(id));
// 		const currentOrder = selectedPositions.map(p => p.id);
// 		const rankingOrderChanged = JSON.stringify(currentOrder) !== JSON.stringify(initialRankingOrder);
// 		const changes = selectedIdsChanged || rankingOrderChanged;
// 		setHasChanges(changes);
// 		return changes;
// 	}, [selectedIds, initialSelectedIds, selectedPositions, initialRankingOrder]);

// 	useEffect(() => {
// 		detectChanges();
// 	}, [selectedIds, selectedPositions, initialSelectedIds, initialRankingOrder, detectChanges]);

// 	// Filter positions based on search term
// 	const filterPositions = (positions: RankablePosition[]) => {
// 		return positions.filter(pos =>
// 			pos.cca_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
// 			pos.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
// 			(pos.description && pos.description.toLowerCase().includes(searchTerm.toLowerCase()))
// 		);
// 	};

// 	// Fetch available positions for ranking
// 	useEffect(() => {
// 		if (!user?.email) return;

// 		const fetchRankablePositions = async () => {
// 			try {
// 				const response = await fetch(`/api/user/getRankablePositions/${user.email}`);
// 				if (!response.ok) {
// 					const errorData = await response.json();
// 					throw new Error(errorData.error || "Failed to fetch rankable positions");
// 				}
// 				const data = await response.json();

// 				setAllPositions(data.positions || []);

// 				const preSelected = new Set<number>(
// 					data.positions?.filter((p: RankablePosition) => p.is_selected).map((p: RankablePosition) => p.id) || []
// 				);
// 				setSelectedIds(preSelected);
// 				setInitialSelectedIds(new Set(preSelected));

// 				if (preSelected.size > 0) {
// 					const selected = data.positions?.filter((p: RankablePosition) => preSelected.has(p.id)) || [];
// 					selected.sort((a: RankablePosition, b: RankablePosition) => (a.user_ranking || 999) - (b.user_ranking || 999));
// 					setSelectedPositions(selected);
// 					setInitialRankingOrder(selected.map((p: RankablePosition) => p.id));
// 					setCurrentStep('ranking');
// 				} else {
// 					setInitialRankingOrder([]);
// 				}

// 				setHasChanges(false);
// 			} catch (error) {
// 				const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
// 				console.error("Error fetching rankable positions:", errorMessage);
// 				toast.error(errorMessage);
// 			} finally {
// 				setLoading(false);
// 			}
// 		};

// 		fetchRankablePositions();
// 	}, [user?.email]);

// 	if (loading || phaseLoading) {
// 		return (
// 			<div style={styles.container}>
// 				<Sidebar />
// 				<div style={styles.content}>
// 					<div style={styles.loading}>Loading your CCA rankings...</div>
// 				</div>
// 			</div>
// 		);
// 	}

// 	if (!phaseInfo.allowApplicantRanking) {
// 		const getStatusMessage = () => {
// 			switch (phaseInfo.phase) {
// 				case 'maincomm_interviews':
// 					return "Maincomm interviews are in progress. Ranking will open after interviews complete.";
// 				case 'chair_ranking_maincomm':
// 					return "Maincomm ranking is not available. Chairs are currently ranking applicants. Student ranking will open when chair ranking completes.";
// 				case 'maincomm_results_processing':
// 					return "Maincomm results are being processed. Please wait for results to be released.";
// 				case 'maincomm_results_available':
// 					return "Maincomm results are available. Subcomm interviews will begin soon.";
// 				case 'subcomm_interviews':
// 					return "Subcomm interviews are in progress. Ranking will open after interviews complete.";
// 				case 'chair_ranking_subcomm':
// 					return "Subcomm ranking is not available. Chairs are currently ranking applicants. Student ranking will open when chair ranking completes.";
// 				case 'subcomm_results_processing':
// 					return "Subcomm results are being processed. Please wait for final results.";
// 				case 'full_results_available':
// 					return "Complete CCA allocation results are now available!";
// 				default:
// 					return "CCA ranking is not currently active.";
// 			}
// 		};

// 		return (
// 			<div style={styles.container}>
// 				<Sidebar />
// 				<div style={styles.content}>
// 					<div style={styles.header}>
// 						<h1 style={styles.title}>CCA Ranking</h1>
// 						<p style={styles.subtitle}>Rank your preferred CCA positions by priority.</p>
// 					</div>

// 					<div style={styles.emptyState}>
// 						<p>{getStatusMessage()}</p>
// 						{phaseInfo.nextPhaseDate && (
// 							<p><strong>Next Update:</strong> {phaseInfo.nextPhaseDate}</p>
// 						)}
// 					</div>
// 				</div>
// 			</div>
// 		);
// 	}

// 	const togglePositionSelection = (positionId: number) => {
// 		setSelectedIds(prev => {
// 			const newSet = new Set(prev);
// 			if (newSet.has(positionId)) {
// 				newSet.delete(positionId);
// 			} else {
// 				newSet.add(positionId);
// 			}
// 			return newSet;
// 		});
// 	};

// 	const proceedToRanking = () => {
// 		const selected = allPositions.filter(p => selectedIds.has(p.id));
// 		selected.sort((a, b) => a.name.localeCompare(b.name));
// 		setSelectedPositions(selected);
// 		setCurrentStep('ranking');
// 	};

// 	const backToSelection = () => {
// 		setCurrentStep('selection');
// 	};

// 	const moveUp = (index: number) => {
// 		if (index === 0) return;
// 		const newPositions = [...selectedPositions];
// 		[newPositions[index], newPositions[index - 1]] = [newPositions[index - 1], newPositions[index]];
// 		setSelectedPositions(newPositions);
// 	};

// 	const moveDown = (index: number) => {
// 		if (index === selectedPositions.length - 1) return;
// 		const newPositions = [...selectedPositions];
// 		[newPositions[index], newPositions[index + 1]] = [newPositions[index + 1], newPositions[index]];
// 		setSelectedPositions(newPositions);
// 	};

// 	const saveRankings = async () => {
// 		if (!user?.email) return;

// 		setIsSaving(true);
// 		try {
// 			const rankings = selectedPositions.map((position, index) => ({
// 				position_id: position.id,
// 				ranking: index + 1
// 			}));

// 			const response = await fetch('/api/user/saveRankings', {
// 				method: 'POST',
// 				headers: {
// 					'Content-Type': 'application/json',
// 				},
// 				body: JSON.stringify({
// 					email: user.email,
// 					rankings
// 				})
// 			});

// 			if (!response.ok) {
// 				const errorData = await response.json();
// 				throw new Error(errorData.error || "Failed to save rankings");
// 			}

// 			toast.success("Rankings saved successfully!");

// 			const refreshResponse = await fetch(`/api/user/getRankablePositions/${user.email}`);
// 			if (refreshResponse.ok) {
// 				const refreshData = await refreshResponse.json();
// 				setAllPositions(refreshData.positions || []);

// 				const updatedSelected = selectedPositions.map(pos => {
// 					const freshData = refreshData.positions.find((p: RankablePosition) => p.id === pos.id);
// 					return freshData ? { ...pos, user_ranking: freshData.user_ranking } : pos;
// 				});
// 				setSelectedPositions(updatedSelected);
// 			}

// 			setInitialSelectedIds(new Set(selectedIds));
// 			setInitialRankingOrder(selectedPositions.map(p => p.id));
// 			setHasChanges(false);
// 		} catch (error) {
// 			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
// 			console.error("Error saving rankings:", errorMessage);
// 			toast.error(errorMessage);
// 		} finally {
// 			setIsSaving(false);
// 		}
// 	};

// 	// Filter positions for display
// 	const filteredPositions = filterPositions(allPositions);

// 	if (currentStep === 'selection') {
// 		return (
// 			<div style={styles.container}>
// 				<Sidebar />
// 				<div style={styles.content}>
// 					<div style={styles.header}>
// 						<h1 style={styles.title}>Select Committee Positions to Rank</h1>
// 						<p style={styles.subtitle}>
// 							Select the positions you are interested in, then rank them.
// 						</p>
// 					</div>

// 					<div style={styles.searchContainer}>
// 						<input
// 							type="text"
// 							placeholder="Search positions by name, CCA, or description..."
// 							value={searchTerm}
// 							onChange={(e) => setSearchTerm(e.target.value)}
// 							style={styles.searchInput}
// 						/>
// 					</div>

// 					{filteredPositions.length === 0 ? (
// 						<div style={styles.emptyState}>
// 							<p>
// 								{searchTerm
// 									? 'No positions found matching your search.'
// 									: 'No positions available for ranking.'
// 								}
// 							</p>
// 							{searchTerm && <p>Try adjusting your search terms.</p>}
// 						</div>
// 					) : (
// 						<>
// 							<div style={styles.instructionsBar}>
// 								<span style={styles.instructionText}>
// 									{selectedIds.size} of {filteredPositions.length} positions selected
// 									{searchTerm && ` (filtered from ${allPositions.length} total)`}
// 								</span>
// 								<button
// 									style={styles.proceedButton}
// 									onClick={proceedToRanking}
// 								>
// 									Proceed to Ranking →
// 								</button>
// 							</div>

// 							<div style={styles.selectionContainer}>
// 								{filteredPositions.map((position) => (
// 									<div
// 										key={position.id}
// 										style={{
// 											...styles.selectionCard,
// 											...(selectedIds.has(position.id) ? styles.selectedCard : {})
// 										}}
// 										onClick={() => togglePositionSelection(position.id)}
// 									>
// 										<div style={styles.checkbox}>
// 											<input
// 												type="checkbox"
// 												checked={selectedIds.has(position.id)}
// 												onChange={() => { }}
// 												style={styles.checkboxInput}
// 											/>
// 										</div>

// 										<div style={styles.positionInfo}>
// 											<h3 style={styles.positionName}>{position.name}</h3>
// 											<p style={styles.ccaName}>{position.cca_name}</p>
// 											<div style={styles.positionMeta}>
// 												<span style={styles.positionType}>
// 													{position.position_type === 'maincomm' ? 'Main Committee' : 'Sub Committee'}
// 												</span>
// 												<span style={styles.capacity}>
// 													Available Capacity: {position.available_capacity}
// 												</span>
// 											</div>
// 											{position.description && (
// 												<p style={styles.description}>{position.description}</p>
// 											)}
// 										</div>
// 									</div>
// 								))}
// 							</div>
// 						</>
// 					)}
// 				</div>
// 			</div>
// 		);
// 	}

// 	return (
// 		<div style={styles.container}>
// 			<Sidebar />
// 			<div style={styles.content}>
// 				<div style={styles.header}>
// 					<h1 style={styles.title}>Rank Your Selected CCA Positions</h1>
// 					<p style={styles.subtitle}>
// 						{selectedPositions.length === 0
// 							? "No positions selected. You can save this to clear all your rankings, or go back to select positions."
// 							: "Drag and drop or use arrows to rank your preferred CCA positions. Higher positions have higher priority."
// 						}
// 					</p>
// 				</div>

// 				<div style={styles.instructionsBar}>
// 					<button
// 						style={styles.backButton}
// 						onClick={backToSelection}
// 					>
// 						← Back to Selection
// 					</button>
// 					<span style={styles.instructionText}>
// 						{selectedPositions.length} position{selectedPositions.length !== 1 ? 's' : ''} to rank
// 					</span>
// 					<button
// 						style={
// 							isSaving
// 								? styles.saveButtonDisabled
// 								: hasChanges
// 									? styles.saveButton
// 									: styles.saveButtonDisabled
// 						}
// 						onClick={saveRankings}
// 						disabled={isSaving || !hasChanges}
// 					>
// 						{isSaving ? 'Saving...' : 'Save Rankings'}
// 					</button>
// 				</div>

// 				<div style={styles.rankingContainer}>
// 					{selectedPositions.length === 0 ? (
// 						<div style={styles.emptyRankingState}>
// 							<p>No positions selected for ranking.</p>
// 							<p>Go back to selection to choose positions, or save to clear all your existing rankings.</p>
// 						</div>
// 					) : (
// 						selectedPositions.map((position, index) => (
// 							<div key={position.id} style={styles.positionCard}>
// 								<div style={styles.rankNumber}>{index + 1}</div>

// 								<div style={styles.positionInfo}>
// 									<h3 style={styles.positionName}>{position.name}</h3>
// 									<p style={styles.ccaName}>{position.cca_name}</p>
// 									<div style={styles.positionMeta}>
// 										<span style={styles.positionType}>
// 											{position.position_type === 'maincomm' ? 'Main Committee' : position.position_type === 'blockcomm' ? 'Block Committee' : 'Sub Committee'}
// 										</span>
// 										<span style={styles.capacity}>
// 											Available Capacity: {position.available_capacity}
// 										</span>
// 									</div>
// 									{position.description && (
// 										<p style={styles.description}>{position.description}</p>
// 									)}
// 								</div>

// 								<div style={styles.controls}>
// 									<button
// 										style={index === 0 ? styles.controlButtonDisabled : styles.controlButton}
// 										onClick={() => moveUp(index)}
// 										disabled={index === 0}
// 										title="Move up"
// 									>
// 										↑
// 									</button>
// 									<button
// 										style={index === selectedPositions.length - 1 ? styles.controlButtonDisabled : styles.controlButton}
// 										onClick={() => moveDown(index)}
// 										disabled={index === selectedPositions.length - 1}
// 										title="Move down"
// 									>
// 										↓
// 									</button>
// 								</div>
// 							</div>
// 						))
// 					)}
// 				</div>
// 			</div>
// 			<LoadingOverlay visible={isSaving} />
// 		</div>
// 	);
// }

// const styles = {
// 	container: {
// 		display: 'flex',
// 		height: '100vh',
// 		fontFamily: 'Arial, sans-serif'
// 	},
// 	content: {
// 		flex: 1,
// 		padding: '20px',
// 		backgroundColor: '#FFFFFF',
// 		color: '#2C2C2C',
// 		overflow: 'auto'
// 	},
// 	header: {
// 		marginBottom: '30px'
// 	},
// 	title: {
// 		fontSize: '28px',
// 		marginBottom: '10px',
// 		fontWeight: 'bold',
// 		color: '#4A4A4A'
// 	},
// 	subtitle: {
// 		fontSize: '14px',
// 		color: '#7A7A7A',
// 		margin: '0'
// 	},
// 	loading: {
// 		textAlign: 'center' as const,
// 		fontSize: '16px',
// 		color: '#7A7A7A',
// 		marginTop: '50px'
// 	},
// 	emptyState: {
// 		textAlign: 'center' as const,
// 		padding: '50px 20px',
// 		color: '#7A7A7A'
// 	},
// 	emptyRankingState: {
// 		textAlign: 'center' as const,
// 		padding: '50px 20px',
// 		color: '#7A7A7A',
// 		backgroundColor: '#F8F9FA',
// 		borderRadius: '8px',
// 		border: '2px dashed #E5E7EB'
// 	},
// 	searchContainer: {
// 		marginBottom: '20px',
// 	},
// 	searchInput: {
// 		width: '100%',
// 		padding: '12px 16px',
// 		border: '1px solid #D1D5DB',
// 		borderRadius: '8px',
// 		fontSize: '16px',
// 		outline: 'none',
// 		boxSizing: 'border-box' as const
// 	},
// 	instructionsBar: {
// 		display: 'flex',
// 		justifyContent: 'space-between',
// 		alignItems: 'center',
// 		marginBottom: '20px',
// 		padding: '15px',
// 		backgroundColor: '#F8F9FA',
// 		borderRadius: '8px'
// 	},
// 	instructionText: {
// 		fontSize: '14px',
// 		color: '#6B7280'
// 	},
// 	proceedButton: {
// 		backgroundColor: '#3B82F6',
// 		color: 'white',
// 		padding: '10px 20px',
// 		borderRadius: '6px',
// 		border: 'none',
// 		cursor: 'pointer',
// 		fontSize: '14px',
// 		fontWeight: 'bold'
// 	},
// 	backButton: {
// 		backgroundColor: '#6B7280',
// 		color: 'white',
// 		padding: '10px 15px',
// 		borderRadius: '6px',
// 		border: 'none',
// 		cursor: 'pointer',
// 		fontSize: '14px'
// 	},
// 	saveButton: {
// 		backgroundColor: '#10B981',
// 		color: 'white',
// 		padding: '10px 20px',
// 		borderRadius: '6px',
// 		border: 'none',
// 		cursor: 'pointer',
// 		fontSize: '14px',
// 		fontWeight: 'bold'
// 	},
// 	saveButtonDisabled: {
// 		backgroundColor: '#9CA3AF',
// 		color: 'white',
// 		padding: '10px 20px',
// 		borderRadius: '6px',
// 		border: 'none',
// 		cursor: 'not-allowed',
// 		fontSize: '14px',
// 		fontWeight: 'bold'
// 	},
// 	selectionContainer: {
// 		display: 'flex',
// 		flexDirection: 'column' as const,
// 		gap: '12px'
// 	},
// 	selectionCard: {
// 		display: 'flex',
// 		alignItems: 'center',
// 		padding: '20px',
// 		backgroundColor: '#FFFFFF',
// 		borderWidth: '2px',
// 		borderStyle: 'solid',
// 		borderColor: '#E5E7EB',
// 		borderRadius: '8px',
// 		cursor: 'pointer',
// 		transition: 'all 0.2s ease'
// 	},
// 	selectedCard: {
// 		borderColor: '#3B82F6',
// 		backgroundColor: '#EFF6FF'
// 	},
// 	checkbox: {
// 		marginRight: '15px'
// 	},
// 	checkboxInput: {
// 		width: '20px',
// 		height: '20px'
// 	},
// 	rankingContainer: {
// 		display: 'flex',
// 		flexDirection: 'column' as const,
// 		gap: '12px'
// 	},
// 	positionCard: {
// 		display: 'flex',
// 		alignItems: 'center',
// 		padding: '20px',
// 		backgroundColor: '#FFFFFF',
// 		border: '1px solid #E5E7EB',
// 		borderRadius: '8px',
// 		boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
// 		transition: 'all 0.2s ease'
// 	},
// 	rankNumber: {
// 		fontSize: '24px',
// 		fontWeight: 'bold',
// 		color: '#6B7280',
// 		marginRight: '20px',
// 		minWidth: '40px',
// 		textAlign: 'center' as const
// 	},
// 	positionInfo: {
// 		flex: 1,
// 		marginRight: '20px'
// 	},
// 	positionName: {
// 		fontSize: '18px',
// 		fontWeight: 'bold',
// 		color: '#1F2937',
// 		margin: '0 0 5px 0'
// 	},
// 	ccaName: {
// 		fontSize: '16px',
// 		color: '#4B5563',
// 		margin: '0 0 10px 0'
// 	},
// 	positionMeta: {
// 		display: 'flex',
// 		gap: '15px',
// 		marginBottom: '8px'
// 	},
// 	positionType: {
// 		fontSize: '12px',
// 		padding: '4px 8px',
// 		backgroundColor: '#EFF6FF',
// 		color: '#1D4ED8',
// 		borderRadius: '4px',
// 		fontWeight: 'bold'
// 	},
// 	capacity: {
// 		fontSize: '12px',
// 		color: '#6B7280',
// 		alignSelf: 'center'
// 	},
// 	description: {
// 		fontSize: '13px',
// 		color: '#6B7280',
// 		margin: '0'
// 	},
// 	controls: {
// 		display: 'flex',
// 		flexDirection: 'column' as const,
// 		gap: '8px'
// 	},
// 	controlButton: {
// 		width: '40px',
// 		height: '40px',
// 		borderRadius: '6px',
// 		border: '1px solid #D1D5DB',
// 		backgroundColor: '#FFFFFF',
// 		cursor: 'pointer',
// 		fontSize: '18px',
// 		color: '#4B5563',
// 		display: 'flex',
// 		alignItems: 'center',
// 		justifyContent: 'center',
// 		transition: 'all 0.2s ease'
// 	},
// 	controlButtonDisabled: {
// 		width: '40px',
// 		height: '40px',
// 		borderRadius: '6px',
// 		border: '1px solid #E5E7EB',
// 		backgroundColor: '#F9FAFB',
// 		cursor: 'not-allowed',
// 		fontSize: '18px',
// 		color: '#D1D5DB',
// 		display: 'flex',
// 		alignItems: 'center',
// 		justifyContent: 'center'
// 	},
// 	loadingOverlay: {
// 		position: 'fixed' as const,
// 		top: 0,
// 		left: 0,
// 		width: '100vw',
// 		height: '100vh',
// 		backgroundColor: 'rgba(0, 0, 0, 0.5)',
// 		display: 'flex',
// 		justifyContent: 'center',
// 		alignItems: 'center',
// 		zIndex: 9999
// 	},
// 	loadingContent: {
// 		display: 'flex',
// 		flexDirection: 'column' as const,
// 		alignItems: 'center',
// 		padding: '30px',
// 		backgroundColor: 'white',
// 		borderRadius: '12px',
// 		boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
// 	},
// 	spinner: {
// 		width: '50px',
// 		height: '50px',
// 		border: '6px solid #f3f3f3',
// 		borderTop: '6px solid #10B981',
// 		borderRadius: '50%',
// 		animation: 'spin 1s linear infinite',
// 		marginBottom: '15px'
// 	},
// 	loadingText: {
// 		fontSize: '16px',
// 		fontWeight: 'bold',
// 		color: '#4A4A4A',
// 		margin: 0
// 	}
// };

'use client';

import React, { useEffect, useState, useCallback, Fragment } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePhaseInfo } from '@/hooks/usePhaseInfo';
import toast from 'react-hot-toast';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface RankablePosition {
  id: number;
  name: string;
  cca_name: string;
  position_type: 'maincomm' | 'subcomm' | 'blockcomm';
  capacity: number;
  available_capacity: number;
  applied_count: number;
  description?: string;
  user_ranking?: number | null;
  is_selected?: boolean;
}

export default function RankCCA() {
  const { user } = useAuth();
  const { phaseInfo, loading: phaseLoading } = usePhaseInfo();
  const [allPositions, setAllPositions] = useState<RankablePosition[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<RankablePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<'selection' | 'ranking'>('selection');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [initialSelectedIds, setInitialSelectedIds] = useState<Set<number>>(new Set());
  const [initialRankingOrder, setInitialRankingOrder] = useState<number[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const detectChanges = useCallback(() => {
    const selectedIdsChanged =
      selectedIds.size !== initialSelectedIds.size ||
      [...selectedIds].some((id) => !initialSelectedIds.has(id));
    const currentOrder = selectedPositions.map((p) => p.id);
    const rankingOrderChanged =
      JSON.stringify(currentOrder) !== JSON.stringify(initialRankingOrder);
    const changes = selectedIdsChanged || rankingOrderChanged;
    setHasChanges(changes);
    return changes;
  }, [selectedIds, initialSelectedIds, selectedPositions, initialRankingOrder]);

  useEffect(() => {
    detectChanges();
  }, [selectedIds, selectedPositions, detectChanges]);

  const filterPositions = (positions: RankablePosition[]) => {
    return positions.filter(
      (pos) =>
        pos.cca_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pos.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pos.description && pos.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  useEffect(() => {
    if (!user?.email) return;

    const fetchRankablePositions = async () => {
      try {
        const response = await fetch(`/api/user/getRankablePositions/${user.email}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch rankable positions');
        }
        const data = await response.json();
        setAllPositions(data.positions || []);
        const preSelected = new Set<number>(
          data.positions
            ?.filter((p: RankablePosition) => p.is_selected)
            .map((p: RankablePosition) => p.id) || []
        );
        setSelectedIds(preSelected);
        setInitialSelectedIds(new Set(preSelected));

        if (preSelected.size > 0) {
          const selected = data.positions?.filter((p: RankablePosition) =>
            preSelected.has(p.id)
          );
          selected.sort(
            (a: RankablePosition, b: RankablePosition) =>
              (a.user_ranking || 999) - (b.user_ranking || 999)
          );
          setSelectedPositions(selected);
          setInitialRankingOrder(selected.map((p: RankablePosition) => p.id));
          setCurrentStep('ranking');
        } else {
          setInitialRankingOrder([]);
        }

        setHasChanges(false);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchRankablePositions();
  }, [user?.email]);

  const togglePositionSelection = (positionId: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      newSet.has(positionId) ? newSet.delete(positionId) : newSet.add(positionId);
      return newSet;
    });
  };

  const proceedToRanking = () => {
    const selected = allPositions.filter((p) => selectedIds.has(p.id));
    selected.sort((a, b) => a.name.localeCompare(b.name));
    setSelectedPositions(selected);
    setCurrentStep('ranking');
  };

  const backToSelection = () => setCurrentStep('selection');

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newPositions = [...selectedPositions];
    [newPositions[index], newPositions[index - 1]] = [
      newPositions[index - 1],
      newPositions[index],
    ];
    setSelectedPositions(newPositions);
  };

  const moveDown = (index: number) => {
    if (index === selectedPositions.length - 1) return;
    const newPositions = [...selectedPositions];
    [newPositions[index], newPositions[index + 1]] = [
      newPositions[index + 1],
      newPositions[index],
    ];
    setSelectedPositions(newPositions);
  };

  const saveRankings = async () => {
    if (!user?.email) return;
    setIsSaving(true);
    try {
      const rankings = selectedPositions.map((p, i) => ({
        position_id: p.id,
        ranking: i + 1,
      }));
      const res = await fetch('/api/user/saveRankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, rankings }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save rankings');
      }
      toast.success('Rankings saved successfully!');
      setInitialSelectedIds(new Set(selectedIds));
      setInitialRankingOrder(selectedPositions.map((p) => p.id));
      setHasChanges(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPositions = filterPositions(allPositions);

  // ------------------------
  //  UI RENDERING
  // ------------------------
  if (loading || phaseLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-full">
          <Loader2 className="animate-spin text-gray-500" size={32} />
          <p className="ml-3 text-gray-600">Loading your CCA rankings...</p>
        </div>
      </AppLayout>
    );
  }

  if (currentStep === 'selection') {
    return (
      <AppLayout>
        <div className="flex flex-col space-y-4">
          <h1 className="text-2xl font-semibold">Select Committee Positions to Rank</h1>
          <p className="text-gray-600">
            Choose positions you are interested in, then click “Proceed to Ranking”.
          </p>

          <Input
            placeholder="Search positions by name, CCA, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />

          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-600">
              {selectedIds.size} selected / {filteredPositions.length} available
            </span>
            <Button onClick={proceedToRanking} disabled={selectedIds.size === 0}>
              Proceed to Ranking →
            </Button>
          </div>

          <Table>
            <TableCaption>Available CCA Positions</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>CCA</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPositions.map((pos) => (
                <TableRow
                  key={pos.id}
                  className={selectedIds.has(pos.id) ? 'bg-blue-50' : ''}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(pos.id)}
                      onChange={() => togglePositionSelection(pos.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{pos.name}</TableCell>
                  <TableCell>{pos.cca_name}</TableCell>
                  <TableCell>
                    {pos.position_type === 'maincomm'
                      ? 'Main Committee'
                      : pos.position_type === 'blockcomm'
                      ? 'Block Committee'
                      : 'Sub Committee'}
                  </TableCell>
                  <TableCell>{pos.available_capacity}</TableCell>
                  <TableCell className="max-w-xs truncate text-gray-500">
                    {pos.description || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <Button variant="secondary" onClick={backToSelection}>
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold">Rank Your Selected CCA Positions</h1>
          <Button
            onClick={saveRankings}
            disabled={isSaving || !hasChanges}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSaving ? 'Saving...' : 'Save Rankings'}
          </Button>
        </div>

        <Table>
          <TableCaption>Your Ranking List</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>CCA</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectedPositions.map((pos, index) => (
              <TableRow key={pos.id}>
                <TableCell className="font-bold">{index + 1}</TableCell>
                <TableCell>{pos.name}</TableCell>
                <TableCell>{pos.cca_name}</TableCell>
                <TableCell>{pos.available_capacity}</TableCell>
                <TableCell className="space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={index === 0}
                    onClick={() => moveUp(index)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={index === selectedPositions.length - 1}
                    onClick={() => moveDown(index)}
                  >
                    ↓
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
