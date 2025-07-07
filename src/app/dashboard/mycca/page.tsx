'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar'; // Import Sidebar
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function MyCCA() {
  const { user } = useAuth();
  const [points, setPoints] = useState<number>(0);
  const [ccas, setCCAs] = useState<{ name: string; role: string; points: number }[]>([]);

  useEffect(() => {
    if (!user?.email) return;

    fetch(`/api/user/getPoints/${user.email}`)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to fetch user points");
        }
        return res.json();
      })
      .then((data) => {
        setPoints(data.userPoints);
      })
      .catch((error) => {
        console.error("Error fetching points:", error.message);
        toast.error(error.message); // Show a toast notification for the error
      });
}, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    fetch('/api/user/getCCAs/' + user?.email)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to fetch user CCA data");
        }
        return res.json();
      })
      .then((data) => {setCCAs(data.data)})
      .catch((error) => {
        console.error("Error fetching CCAs:", error.message);
        toast.error(error.message); // Show a toast notification for the error
      });
      
  }, [user?.email]);

  return (
    <div style={styles.container}>
      <Sidebar /> 

      {/* Main Content */}
      <div style={styles.content}>
        <h1 style={styles.title}>My CCAs</h1>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>CCA</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Points</th>
            </tr>
          </thead>
          <tbody>
            {ccas.map((cca, index) => (
              <tr key={index} style={{ backgroundColor: index % 2 === 0 ? styles.rowEven.backgroundColor : styles.rowOdd.backgroundColor }}>
                <td style={styles.td}>{cca.name}</td>
                <td style={styles.td}>{cca.role}</td>
                <td style={styles.td}>{cca.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
    color: '#2C2C2C'
  },
  title: {
    fontSize: '28px',
    marginBottom: '20px',
    fontWeight: 'bold',
    color: '#4A4A4A'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '10px'
  },
  th: {
    textAlign: 'left' as const,
    borderBottom: '2px solid #DDD',
    padding: '12px 10px',
    backgroundColor: '#FFFFFF',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#7A7A7A'
  },
  td: {
    borderBottom: '1px solid #DDD',
    padding: '10px',
    fontSize: '14px',
    color: '#000000'
  },
  rowEven: {
    backgroundColor: '#F5F5F5'
  },
  rowOdd: {
    backgroundColor: '#FFFFFF'
  },
  footer: {
    marginTop: '20px',
    textAlign: 'right' as const,
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#000000'
  }
};
