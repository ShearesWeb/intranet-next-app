'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function MyCCA() {
  return (
    <div style={styles.container}>
      {/* Sidebar Navigation */}
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
          <Link href="/" style={styles.navItem}>🏠 Home</Link>
          <Link href="/mycca" style={{ ...styles.navItem, ...styles.active }}>📋 My CCAs</Link>
          <Link href="/rank" style={styles.navItem}>📊 Rank CCA</Link>
          <Link href="/" style={styles.navItem}>🚪 Log out</Link>
        </nav>
      </div>

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
            {ccaData.map((cca, index) => (
              <tr
                key={index}
                style={{
                  backgroundColor: index % 2 === 0
                    ? styles.rowEven.backgroundColor
                    : styles.rowOdd.backgroundColor,
                }}
              >
                <td style={styles.td}>{cca.name}</td>
                <td style={styles.td}>{cca.role}</td>
                <td style={styles.td}>{cca.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={styles.footer}>
          <strong>Total Points:</strong> {calculateTotalPoints()}
        </div>
      </div>
    </div>
  );
}

// Sample Data
const ccaData = [
  { name: 'Block Committee', role: 'Member', points: 47 },
  { name: 'Sports Management Board', role: 'Publicity Main Comm', points: 42 },
  { name: 'Sheares Production', role: 'Sets Sub Comm', points: 38 },
  { name: 'Floorball F', role: 'Member', points: 27 },
  { name: 'Volleyball F', role: 'Captain', points: 20 },
  { name: 'Handball F', role: 'Member', points: 17 },
  { name: 'SWCC 23/24 Elections', role: 'Attendance', points: 11 },
  { name: '44th Elections & ADM', role: 'Attendance', points: 1 }
];

// Calculate Total Points
function calculateTotalPoints() {
  return ccaData.reduce((total, cca) => total + cca.points, 0);
}

// Styles
const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'Arial, sans-serif'
  },
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
    borderCollapse: 'collapse',
    marginTop: '10px'
  },
  th: {
    textAlign: 'left' as const,
    borderBottom: '2px solid #DDD',
    padding: '12px 10px',
    backgroundColor: '#FFFFFF', // White background
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#7A7A7A' // Lighter grey text
  },
  td: {
    borderBottom: '1px solid #DDD',
    padding: '10px',
    fontSize: '14px',
    color: '#000000' // Black text
  },
  rowEven: {
    backgroundColor: '#F5F5F5' // Light grey for even rows
  },
  rowOdd: {
    backgroundColor: '#FFFFFF' // White for odd rows
  },
  footer: {
    marginTop: '20px',
    textAlign: 'right' as const,
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#000000'
  }
};
