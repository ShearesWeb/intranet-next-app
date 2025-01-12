"use client"

import React, { ComponentType, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';


const withAuth = (WrappedComponent: ComponentType) => {
  const AuthenticatedComponent = (props: any) => {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !user) {
        toast.error('You need to be logged in to access this page.');
        router.push('/auth/login');
      }
    }, [user, loading, router]);

    if (loading || !user) {
      return <div>Loading...</div>;
    }

    return <WrappedComponent {...props} />;
  };

  return AuthenticatedComponent;
};

export default withAuth;

/*Explanation:
The withAuth higher-order component (HOC) is used to protect pages that require authentication.
The withAuth function takes a WrappedComponent as an argument and returns a new component called AuthenticatedComponent.
Use the useAuth hook:

Inside AuthenticatedComponent, use the useAuth hook to get the user and loading states.
Redirect unauthenticated users:

Use the useRouter hook to get the router instance.
Use the useEffect hook to redirect unauthenticated users to the /auth/login page if loading is false and user is null.
Render the wrapped component:

If the authentication state is still loading or the user is not authenticated, render a loading message.
If the user is authenticated, render the WrappedComponent with the passed props.

Usage Example:
To use the withAuth HOC to protect a page, wrap the page component with withAuth when exporting it. But the page component must be a client-side component (not a server-side component).

For example, if you have a protected page at src/pages/dashboard.tsx, you can wrap it like this:
import React from 'react';
import withAuth from '@/hoc/withAuth';

const Dashboard = () => {
  return (
    <div>
      <h1>Dashboard</h1>
      { Your dashboard content }
      </div>
    );
  };
  
  export default withAuth(Dashboard);

*/