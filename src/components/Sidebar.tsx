// C:\Ron\intranet-next-app\src\components\Sidebar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRoleAuth } from '@/hooks/useRoleAuth';

export default function Sidebar() {
  const { isAuthorized, loading: roleLoading } = useRoleAuth();

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
        <Link href="/dashboard/home" style={styles.navItem}>❤️ Home</Link>
        <Link href="/dashboard/mycca" style={{ ...styles.navItem }}>📋 My CCAs</Link>
        <Link href="/dashboard/rank" style={styles.navItem}>📊 Rank CCA</Link>
        {!roleLoading && isAuthorized && (
          <Link href="/dashboard/rankApplicants" style={styles.navItem}>
            👥 Rank Applicants
          </Link>
        )}
      </nav>
    </div>
  );
}

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
