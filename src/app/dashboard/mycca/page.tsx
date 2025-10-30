// C:\Ron\intranet-next-app\src\app\dashboard\mycca\page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AUTHORIZED_CHAIR_ROLES, type ChairRole } from '@/lib/lead-auth-service';

interface CCAData {
  name: string;
  role: string;
  position_type: string
  cca_type: string;
  description: string;
  points: number;
}

export default function MyCCA() {
  const router = useRouter();
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [ccas, setCCAs] = useState<CCAData[]>([]);

  const [loadingCCAs, setLoadingCCAs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to display CCA type with proper capitalization
  const ccaTypeDisplay = (str: string) => {
    if (!str) return '';

    const typeMapping: Record<string, string> = {
      'committee': 'Committee',
      'sports': 'Sports',
      'culture': 'Culture',
      'jcrc': 'JCRC',
    };

    return typeMapping[str] || str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  useEffect(() => {
    if (!user?.email) return;

    setLoadingCCAs(true);
    fetch('/api/user/getCCAs')
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to fetch user CCA data");
        }
        return res.json();
      })
      .then((data) => {
        // console.log("CCA Data received:", data);
        setCCAs(data.data);
        ``
        if (process.env.NODE_ENV === 'development') {
          // console.log("Debug info:", data.debug);
        }
      })
      .catch((error) => {
        console.error("Error fetching CCAs:", error.message);
        toast.error(error.message);
        setError("Failed to load CCAs");
      })
      .finally(() => {
        setLoadingCCAs(false);
      });
  }, [user?.email]);

  const handleManageMembers = (cca: CCAData) => {
    // Navigate to member management page
    router.push(`/dashboard/mycca/manageMembers/${encodeURIComponent(cca.name)}?ccaName=${encodeURIComponent(cca.name)}`);
  };

  if (loadingCCAs) {
    return (
      <div style={styles.container}>
        <Sidebar />
        <div style={styles.content}>
          <div style={styles.loading}>Loading your CCA data...</div>
        </div>
      </div>
    );
  }

  if (error && ccas.length === 0 && points === 0) {
    return (
      <div style={styles.container}>
        <Sidebar />
        <div style={styles.content}>
          <div style={styles.header}>
            <h1 style={styles.title}>My CCAs</h1>
          </div>
          <div style={styles.error}>
            <p>⚠️ {error}</p>
            <button
              style={styles.retryButton}
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <Sidebar />
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>My CCAs</h1>
        </div>

        <div style={styles.tableContainer}>
          {ccas.length === 0 ? (
            <div style={styles.emptyState}>
              <p>📋 No CCA appointments found.</p>
              <p style={styles.emptySubtext}>
                You have not been assigned to any CCAs yet. Check back later or contact your CCA chairs/ICs.
              </p>
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>CCA</th>
                  <th style={styles.thCenter}>Role</th>
                  <th style={styles.thCenter}>Type</th>
                  <th style={styles.thCenter}>Points</th>
                  <th style={styles.thCenter}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ccas.map((cca, index) => (
                  <tr
                    key={index}
                    style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}
                  >
                    <td style={styles.td}>
                      <div style={styles.ccaInfo}>
                        <strong>{cca.name}</strong>
                        {cca.description && (
                          <div style={styles.description}>
                            {cca.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={styles.tdCenter}>
                      <span style={styles.roleTag}>
                        {cca.role}
                      </span>
                    </td>
                    <td style={styles.tdCenter}>
                      <span style={styles.typeTag}>
                        {ccaTypeDisplay(cca.cca_type)}
                      </span>
                    </td>
                    <td style={styles.tdCenter}>
                      <strong>{cca.points}</strong>
                    </td>
                    <td style={styles.tdCenter}>
                      {AUTHORIZED_CHAIR_ROLES.includes(cca.position_type as ChairRole) &&
                        (
                          <button
                            style={styles.manageButton}
                            onClick={() => handleManageMembers(cca)}
                          >
                            View
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={styles.footer}>
          <strong>Total Points: </strong> {points ? points : 0}
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
  loading: {
    textAlign: 'center' as const,
    fontSize: '16px',
    color: '#7A7A7A',
    marginTop: '50px',
    padding: '20px'
  },
  error: {
    textAlign: 'center' as const,
    padding: '50px 20px',
    color: '#B91C1C',
    backgroundColor: '#FEF2F2',
    borderRadius: '8px',
    border: '1px solid #FCA5A5'
  },
  retryButton: {
    marginTop: '15px',
    padding: '10px 20px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  tableContainer: {
    marginBottom: '20px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '10px',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
  },
  th: {
    textAlign: 'left' as const,
    borderBottom: '2px solid #E5E7EB',
    padding: '15px 12px',
    backgroundColor: '#F9FAFB',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#374151'
  },
  thCenter: {
    textAlign: 'center' as const,
    borderBottom: '2px solid #E5E7EB',
    padding: '15px 12px',
    backgroundColor: '#F9FAFB',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#374151'
  },
  td: {
    borderBottom: '1px solid #E5E7EB',
    padding: '15px 12px',
    fontSize: '14px',
    color: '#1F2937'
  },
  tdCenter: {
    borderBottom: '1px solid #E5E7EB',
    padding: '15px 12px',
    fontSize: '14px',
    color: '#1F2937',
    textAlign: 'center' as const
  },
  rowEven: {
    backgroundColor: '#F9FAFB'
  },
  rowOdd: {
    backgroundColor: '#FFFFFF'
  },
  ccaInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  },
  description: {
    fontSize: '12px',
    color: '#6B7280',
    fontStyle: 'italic'
  },
  roleTag: {
    padding: '4px 8px',
    backgroundColor: '#EFF6FF',
    color: '#1D4ED8',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'inline-block'
  },
  typeTag: {
    padding: '4px 8px',
    backgroundColor: '#F0FDF4',
    color: '#15803D',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'inline-block'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    borderRadius: '8px',
    border: '2px dashed #E5E7EB'
  },
  emptySubtext: {
    fontSize: '14px',
    marginTop: '10px',
    color: '#9CA3AF'
  },
  footer: {
    marginTop: '20px',
    padding: '15px',
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#1F2937',
    backgroundColor: '#F8F9FA',
    borderRadius: '6px'
  },
  manageButton: {
    padding: '6px 12px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 'bold',
  }
};
