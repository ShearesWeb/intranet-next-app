"use client";

import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider } from "../../../../lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { GoogleAuthProvider } from "firebase/auth/web-extension";
import Image from "next/image";
import { StyleSheet, css } from "aphrodite";
import toast from "react-hot-toast";



export default function Home() {
  const { user, loading } = useAuth();

  const handleSignIn = async () => {
    signInWithPopup(auth, provider)
      .then(result => {
        GoogleAuthProvider.credentialFromResult(result);
        toast.success("Sign in successful!");
      })
      .catch(error => {
        console.error("Sign-in error:", error);
        toast.error("Sign in failed!");
      });
    
  };
  
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success("Sign out successful!");
    } catch (e) {
      console.error("Sign-out error:", e);
      toast.error("Sign out failed!");
    }
  };

  return (
    !loading && (
      <div className={css(styles.container)}>
        <div className={css(styles.leftPane)}>
          <div className={css(styles.logoContainer)}>
            <Image
              src="/images/lion_logo.png"
              alt="Lion Logo"
              width={90}
              height={90}
              className={css(styles.logoImage)}
            />
            Sheares Intranet
          </div>
        </div>

        <div className={css(styles.rightPane)}>
          <h1 className={css(styles.welcomeTitle)}>
            <span className={css(styles.welcomeText)}>Welcome</span>
            <br />
            <span>Shearites!</span>
          </h1>

          <hr className={css(styles.divider)} />

          {user && (
            <button className={css(styles.signoutButton)} onClick={handleSignOut}>
              Sign Out
            </button>
          )}
          {!user && (
            <>
              <button className={css(styles.signinButton)} onClick={handleSignIn}>
                <span className={css(styles.arrow)}>→</span> Sign In with Google
              </button>
              <p className={css(styles.description)}>
                The intranet is a place where shearites.<br /> can rank and view their CCAs.
              </p>
            </>
          )}
          {user && <p className={css(styles.userInfo)}>Welcome User: {user?.displayName}</p>}
        </div>
      </div>
    )
  );
}

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'row',
    minHeight: '100vh',
    width: '100%',
    fontFamily: 'Reem Kufi, sans-serif',
    fontWeight: 600
  },
  leftPane: {
    flex: 2,
    background: 'linear-gradient(to bottom, #FFCD9D, #FC8B1A, #FF6F00)',
    color: '#FFFFFF',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '2rem',
    fontWeight: 600
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center'
  },
  logoImage: {
    borderRadius: '50%',
    marginRight: '20px'
  },
  rightPane: {
    flex: 1,
    background: '#FFFFFF',
    color: '#FF8C00',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2rem'
  },
  welcomeTitle: {
    fontSize: '50px',
    fontWeight: 600,
    marginBottom: '2rem'
  },
  welcomeText: {
    display: 'inline-block',
    marginLeft: '8px'
  },
  divider: {
    width: '80%',
    border: '0.5px solid black',
    marginBottom: '2rem'
  },
  signinButton: {
    background: '#FF8C1A',
    color: 'white',
    padding: '8.85px 21.23px 8.85px 16.81px',
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '12px'
  },
  signoutButton: {
    background: '#FF8C1A',
    color: 'white',
    padding: '12px 24px',
    fontSize: '18px',
    fontWeight: 500,
    borderRadius: '8px'
  },
  arrow: {
    marginRight: '5px'
  },
  description: {
    paddingTop: '2rem',
    fontSize: '14px',
    color: '#B7B7B7',
    textAlign: 'center'
  },
  userInfo: {
    marginTop: '1rem',
    fontWeight: 600
  },
  errorMessage: {
    color: 'red'
  }
});
