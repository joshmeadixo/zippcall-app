'use client';

import { useState, useEffect } from 'react';
import { 
  auth, 
  googleProvider, 
  sendSignInLinkToEmail, 
  actionCodeSettings,
  isSignInWithEmailLink,
  signInWithEmailLink
} from '@/lib/firebase';
import { 
  signInWithPopup,
  AuthError
} from 'firebase/auth';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ensureUserDocument } from '@/lib/user-db';
import Footer from '@/components/Footer';

export default function Home() {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Check if the current URL contains a sign-in link
  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      // Check if the URL contains a sign-in link
      if (isSignInWithEmailLink(auth, window.location.href)) {
        setIsLoading(true);
        
        // Get the email from localStorage
        let email = localStorage.getItem('emailForSignIn');
        
        // If the email is missing, ask the user for it
        if (!email) {
          email = window.prompt('Please provide your email for confirmation');
        }
        
        // Complete the sign-in process
        if (email) {
          signInWithEmailLink(auth, email, window.location.href)
            .then((result) => {
              // Clear the email from storage
              localStorage.removeItem('emailForSignIn');
              // Clear the URL to prevent automatic sign-in attempts if the page is refreshed
              window.history.replaceState(null, "", window.location.pathname);
              
              // Ensure user document exists in Firestore
              return ensureUserDocument(result.user)
                .then(() => {
                  // Redirect to dashboard
                  router.push('/dashboard');
                })
                .catch((dbError) => {
                  console.error('Error creating user document:', dbError);
                  setError('Error setting up user profile. Please ensure Firestore is properly configured.');
                });
            })
            .catch((error) => {
              setError(error.message || 'An error occurred during sign-in.');
            })
            .finally(() => {
              setIsLoading(false);
            });
        } else {
          setError('Email is required to complete sign-in.');
          setIsLoading(false);
        }
      }
    }
  }, [router]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Save the email in localStorage for later use
      localStorage.setItem('emailForSignIn', email);
      
      // Send a sign-in link to the user's email
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      
      // Display a message to the user
      setEmailSent(true);
    } catch (err) {
      const firebaseError = err as AuthError;
      setError(firebaseError.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      // Sign in with Google
      const result = await signInWithPopup(auth, googleProvider);
      
      // Ensure user document exists in Firestore
      try {
        await ensureUserDocument(result.user);
      } catch (dbError) {
        console.error('Error creating user document:', dbError);
        setError('Error setting up user profile. Please ensure Firestore is properly configured.');
        return;
      }
      
      router.push('/dashboard');
    } catch (err) {
      const firebaseError = err as AuthError;
      if (firebaseError.code === 'auth/popup-closed-by-user') {
        // User closed the popup, not an error to show
      } else {
        setError(firebaseError.message || 'An error occurred with Google sign-in.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg text-zippcall-blue"></div>
        <p className="mt-4 text-zippcall-blue">Loading...</p>
      </div>
    );
  }

  // If user is already logged in, don't render login page
  if (user) {
    return null; // This will not render as the useEffect will redirect
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow bg-gradient-to-b from-zippcall-light-blue/10 to-white">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              {/* Logo */}
              <div className="flex justify-center mb-2">
                <div className="w-40 h-40 relative">
                  <Image 
                    src="/images/zippcall-logo.png" 
                    alt="ZippCall Logo" 
                    width={200} 
                    height={200}
                    priority
                    className="object-contain"
                  />
                </div>
              </div>
              
              <h1 className="text-4xl font-bold text-zippcall-blue mb-2">ZippCall</h1>
              <p className="text-zippcall-blue text-lg">Make international calls from your browser</p>
            </div>

            <div className="bg-white rounded-lg shadow-xl p-8 border border-zippcall-light-blue/20">
              <h2 className="text-2xl font-bold text-center text-zippcall-blue mb-2">
                Welcome to ZippCall
              </h2>
              <p className="text-center text-gray-600 mb-6">
                {emailSent ? '' : 'New or returning user? We make it simple.'}
              </p>

              {/* Google Sign-in Button */}
              {!emailSent && (
                <>
                  <div className="mb-6">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                      className={`btn btn-outline w-full flex items-center justify-center gap-2 hover:bg-gray-100 hover:text-current ${isLoading ? 'opacity-70' : ''}`}
                    >
                      {isLoading ? (
                        <span className="loading loading-spinner loading-sm"></span>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#4285F4">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                      )}
                      {isLoading ? 'Processing...' : 'Continue with Google'}
                    </button>
                  </div>

                  <div className="divider text-sm text-gray-500">OR</div>
                </>
              )}

              {emailSent ? (
                <div className="bg-green-50 border border-green-200 rounded-md p-4 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 mx-auto mb-2 text-green-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <h3 className="text-lg font-semibold text-green-800 mb-1">Check your email</h3>
                  <p className="text-green-700">
                    We&apos;ve sent a sign-in link to <strong>{email}</strong>. 
                    Click the link in the email to sign in.
                  </p>
                  <p className="text-sm text-green-600 mt-2">
                    If you&apos;re a new user, your account will be created automatically.
                  </p>
                  <button 
                    onClick={() => setEmailSent(false)} 
                    className="mt-4 text-zippcall-blue hover:underline"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-zippcall-blue">Email address</span>
                    </label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      className="input input-bordered w-full border-zippcall-light-blue/50"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  {error && (
                    <div className="alert alert-error">
                      <span>{error}</span>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary w-full bg-zippcall-blue hover:bg-zippcall-blue/80"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Processing...
                      </>
                    ) : (
                      'Continue with Email'
                    )}
                  </button>

                  <div className="text-sm text-center mt-4">
                    We&apos;ll email you a secure magic link for password-free access.
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
