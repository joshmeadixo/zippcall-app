'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import VoiceCall, { VoiceCallHandle } from '@/components/VoiceCall';
import CallHistory, { CallHistoryEntry } from '@/components/CallHistory';
import { getUserCallHistory, deleteCallHistoryEntry } from '@/lib/call-history-db';
import { doc, onSnapshot, collection, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AddFundsModal from '@/components/AddFundsModal';
import { loadStripe } from '@stripe/stripe-js';
import { formatDistanceToNow } from 'date-fns';
import Footer from '@/components/Footer';
import AccountDetailsCard from '@/components/AccountDetailsCard';
import Header from '@/components/Header';
import SupportCard from '@/components/SupportCard';

// Load Stripe promise outside component to avoid recreating on render
// Ensure your publishable key is in .env.local as NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
console.log('[Dashboard] Initializing Stripe with key:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? 'Key available' : 'Key missing');
console.log('[Dashboard] App URL for redirects:', process.env.NEXT_PUBLIC_APP_URL || 'Not set');

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  console.error("Stripe publishable key is not set. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your environment.");
}

// Define the constant for max transactions within the component scope
const MAX_TRANSACTIONS_TO_FETCH = 50;

// Define transaction type locally (matching API response)
interface TransactionData {
  id: string;
  type: 'deposit' | 'call' | 'adjustment' | 'unknown';
  amount: number;
  currency: string;
  status: string;
  source: string;
  createdAt: string; // ISO string
  stripeSessionId?: string;
  callId?: string;
  phoneNumber?: string;
  durationSeconds?: number;
}

export default function DashboardAuthOnly() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [balanceFetchError, setBalanceFetchError] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const voiceCallRef = useRef<VoiceCallHandle>(null);

  // State for transaction history
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  // State for collapsible transaction history
  const [isTransactionHistoryOpen, setIsTransactionHistoryOpen] = useState(false);
  // State for collapsible call history
  const [isCallHistoryOpen, setIsCallHistoryOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      // If not authenticated, redirect to login page
      router.push('/');
    }
  }, [user, loading, router]);

  // Load call history from Firestore when user is authenticated
  useEffect(() => {
    const loadCallHistory = async () => {
      if (user && user.uid) {
        try {
          setIsLoadingHistory(true);
          console.log(`[Dashboard] Loading call history for user ${user.uid}`);
          const history = await getUserCallHistory(user.uid);
          setCallHistory(history);
          console.log(`[Dashboard] Loaded ${history.length} call history entries from Firestore`);
        } catch (error) {
          console.error('[Dashboard] Error loading call history:', error);
        } finally {
          setIsLoadingHistory(false);
        }
      }
    };

    if (user) {
      loadCallHistory();
    }
  }, [user]);

  // Fetch user balance from Firestore using a real-time listener
  useEffect(() => {
    if (!user || !user.uid) {
      setUserBalance(null);
      setIsLoadingBalance(false);
      setBalanceFetchError(null);
      return; 
    }

    setIsLoadingBalance(true);
    setBalanceFetchError(null);
    console.log(`[Dashboard] Setting up balance listener for user ${user.uid}`);
    const userRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(userRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const balance = typeof userData.balance === 'number' ? userData.balance : 0;
          setUserBalance(balance);
          console.log(`[Dashboard] Balance updated via listener: ${balance}`);
          setBalanceFetchError(null); 
        } else {
          console.warn(`[Dashboard] User document snapshot not found for UID: ${user.uid}. Setting balance to 0.`);
          setUserBalance(0); 
          setBalanceFetchError('User profile not found.');
        }
        setIsLoadingBalance(false); 
      },
      (error) => {
        console.error('[Dashboard] Error listening to user balance:', error);
        setUserBalance(0); 
        setBalanceFetchError('Could not load balance.');
        setIsLoadingBalance(false);
      }
    );

    return () => {
      console.log(`[Dashboard] Unsubscribing balance listener for user ${user.uid}`);
      unsubscribe();
    };

  }, [user]); // Re-run effect if user object changes

  // --- Listener for Transaction History --- 
  useEffect(() => {
    if (!user || !user.uid) {
      setTransactions([]);
      setIsLoadingTransactions(false);
      setTransactionsError(null);
      return; 
    }

    setIsLoadingTransactions(true);
    setTransactionsError(null);
    console.log(`[Dashboard] Setting up transactions listener for user ${user.uid}`);
    
    // Reference the subcollection
    const transactionsRef = collection(db, 'users', user.uid, 'transactions');
    // Create the query
    const q = query(
      transactionsRef, 
      orderBy('createdAt', 'desc'), 
      limit(MAX_TRANSACTIONS_TO_FETCH) // Use the constant defined elsewhere or define one
    );

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const fetchedTransactions: TransactionData[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Convert Firestore Timestamp to ISO string
            const createdAtTs = data.createdAt as Timestamp; // Assume it's a Timestamp
            const createdAtIso = createdAtTs?.toDate ? createdAtTs.toDate().toISOString() : new Date().toISOString();
                                 
            fetchedTransactions.push({
                id: doc.id,
                type: data.type || 'unknown',
                amount: data.amount || 0,
                currency: data.currency || 'usd',
                status: data.status || 'unknown',
                source: data.source || 'unknown',
                createdAt: createdAtIso,
                ...(data.stripeSessionId && { stripeSessionId: data.stripeSessionId }),
                ...(data.callId && { callId: data.callId }),
                ...(data.phoneNumber && { phoneNumber: data.phoneNumber }),
                ...(data.durationSeconds !== undefined && { durationSeconds: data.durationSeconds }),
            });
        });
        setTransactions(fetchedTransactions);
        console.log(`[Dashboard] Transactions updated via listener: ${fetchedTransactions.length}`);
        setTransactionsError(null); 
        setIsLoadingTransactions(false);
      },
      (error) => {
        console.error('[Dashboard] Error listening to transactions:', error);
        setTransactions([]);
        setTransactionsError('Could not load transaction history.');
        setIsLoadingTransactions(false);
      }
    );

    // Cleanup function to unsubscribe when component unmounts or user changes
    return () => {
      console.log(`[Dashboard] Unsubscribing transactions listener for user ${user.uid}`);
      unsubscribe();
    };

  }, [user]); // Re-run listener setup if user changes

  const openAddFundsModal = () => {
    setPaymentError(null);
    setIsModalOpen(true);
  };

  const handleConfirmAddFunds = async (amount: number) => {
    if (!user) return; 

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      // Debug logging for environment
      console.log(`[Dashboard] Environment check for Stripe payment:`);
      console.log(`[Dashboard] NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL}`);
      console.log(`[Dashboard] Client-side environment: ${process.env.NODE_ENV}`);
      
      console.log(`[Dashboard] Requesting Stripe session for $${amount}`);
      const token = await user.getIdToken();
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }), 
      });

      const data = await response.json();

      if (!response.ok || !data.sessionId) {
        throw new Error(data.error || 'Failed to create Stripe checkout session');
      }

      console.log(`[Dashboard] Redirecting to Stripe Checkout with session ID: ${data.sessionId}`);
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe.js has not loaded correctly.');
      }

      const { error } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });

      if (error) {
        console.error('[Dashboard] Stripe redirectToCheckout error:', error);
        throw new Error(error.message || 'Could not redirect to payment page.');
      }

    } catch (error: unknown) {
      console.error('[Dashboard] Error processing payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      setPaymentError(errorMessage);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (loading) {
    // Render loading state for the whole page
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (!user) {
    // This part might not be strictly necessary if AuthProvider handles redirects,
    // but good as a fallback or explicit state handling.
    // router.push('/login'); // Consider redirecting if not handled by provider
    return (
        <div className="flex justify-center items-center min-h-screen">
            <p>Please log in to view the dashboard.</p> 
            {/* Optionally add a link to login */} 
        </div>
    );
  }
  
  // Log auth state just before rendering the main dashboard content
  console.log(`[page-auth-only] Rendering dashboard. Auth Loading: ${loading}, User: ${user ? user.uid : 'null'}`);

  const handleCallHistoryUpdate = (newCall: CallHistoryEntry) => {
    setCallHistory(prevHistory => {
      // Prepend the new call and limit the history size
      const updatedHistory = [newCall, ...prevHistory];
      return updatedHistory.slice(0, 50); // Keep max 50 entries
    });
  };

  // Handle click on a call history entry
  const handleHistoryItemClick = (phoneNumber: string) => {
    console.log(`[Dashboard] Call history item clicked: ${phoneNumber}`);
    
    // If we have a reference to the VoiceCall component, use its method
    if (voiceCallRef.current && typeof voiceCallRef.current.callNumber === 'function') {
      voiceCallRef.current.callNumber(phoneNumber);
    } else {
      console.error('[Dashboard] VoiceCall reference not available');
    }
  };
  
  // Handle deletion of a call history entry
  const handleHistoryItemDelete = async (callId: string) => {
    console.log(`[Dashboard] Deleting call history entry: ${callId}`);
    
    if (!user || !user.uid) {
      console.error('[Dashboard] Cannot delete call history: User not authenticated');
      return;
    }
    
    try {
      // First update the local state
      const updatedHistory = callHistory.filter(call => call.id !== callId);
      setCallHistory(updatedHistory);
      
      // Then delete from Firestore
      const success = await deleteCallHistoryEntry(callId, user.uid);
      
      if (success) {
        console.log(`[Dashboard] Successfully deleted call history entry: ${callId}`);
      } else {
        console.error(`[Dashboard] Failed to delete call history entry: ${callId}`);
        // If failed, revert the local state update by reloading the call history
        const history = await getUserCallHistory(user.uid);
        setCallHistory(history);
      }
    } catch (error) {
      console.error('[Dashboard] Error deleting call history entry:', error);
    }
  };

  // --- Helper function to format transaction item ---
  const renderTransaction = (tx: TransactionData) => {
      let description = 'Unknown Transaction';
      let amountStyle = 'text-gray-800'; // Default style
      let amountPrefix = tx.amount >= 0 ? '+' : '';

      if (tx.type === 'deposit') {
          description = `Deposit via ${tx.source}`; 
          amountStyle = 'text-green-600';
      } else if (tx.type === 'call') {
          description = tx.phoneNumber ? `Call to ${tx.phoneNumber}` : 'Phone Call';
          amountStyle = 'text-red-600';
          amountPrefix = ''; // Amount is already negative
      } else if (tx.type === 'adjustment') {
          description = `Balance Adjustment (${tx.source})`;
          amountStyle = tx.amount >= 0 ? 'text-green-600' : 'text-red-600';
      }
      
      let formattedDate = 'Invalid Date';
      try {
          formattedDate = formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true });
      } catch (e) {
          console.error("Error formatting date:", e);
      }
      
      return (
          <li key={tx.id} className="py-3 sm:py-4">
              <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                      {/* Simple icon based on type */} 
                      {tx.type === 'deposit' && <span className="text-green-500">↑</span>}
                      {tx.type === 'call' && <span className="text-red-500">↓</span>}
                      {tx.type === 'adjustment' && <span className="text-blue-500">↕</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                          {description}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                          {formattedDate}
                      </p>
                  </div>
                  <div className={`inline-flex items-center text-sm font-semibold ${amountStyle}`}>
                      {amountPrefix}${(Math.abs(tx.amount)).toFixed(2)}
                  </div>
              </div>
          </li>
      );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="container mx-auto px-4 py-6 flex-grow">
        {/* Revert to original grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6"> 
          {/* Left Column - Phone Card */}
          <div className="md:col-span-2"> 
            <VoiceCall 
              ref={voiceCallRef}
              userId={user.uid} 
              title="Phone" 
              hideHistory={true}
              onHistoryUpdate={handleCallHistoryUpdate}
            />
          </div>
          
          {/* Middle and Right Columns */}
          <div className="md:col-span-3 space-y-6"> 
            {/* Balance Card - Top Right */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Balance</h2>
                <button 
                  onClick={openAddFundsModal}
                  disabled={!user}
                  className={`bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Add Funds
                </button>
              </div>
              {paymentError && (
                <div className="mb-3 p-2 bg-red-100 text-red-700 text-sm rounded-md">
                  Error: {paymentError}
                </div>
              )}
              
              {balanceFetchError && (
                <div className="mb-3 p-2 bg-yellow-100 text-yellow-800 text-sm rounded-md">
                  Balance Error: {balanceFetchError}
                </div>
              )}
              
              <div className="p-3 bg-blue-50 rounded-lg flex justify-center items-center">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Available Balance</p>
                  {isLoadingBalance ? (
                    <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mx-auto"></div>
                  ) : (
                    <p className="text-3xl font-bold text-blue-600">
                      {userBalance !== null 
                        ? `$${userBalance.toFixed(2)}` 
                        : '$0.00'}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Call History Card (Now Collapsible) */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Call History</h2>
                <button 
                  onClick={() => setIsCallHistoryOpen(!isCallHistoryOpen)}
                  className="text-blue-500 hover:text-blue-700 text-sm font-medium focus:outline-none"
                  aria-expanded={isCallHistoryOpen}
                  aria-controls="call-history-content"
                >
                  {isCallHistoryOpen ? 'Hide' : 'Show'}
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`inline-block h-4 w-4 ml-1 transition-transform duration-200 ${isCallHistoryOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Collapsible Content */}
              {isCallHistoryOpen && (
                <div id="call-history-content">
                  {isLoadingHistory ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-6 h-6 border-t-2 border-l-2 border-blue-500 rounded-full mx-auto"></div>
                      <p className="text-gray-500 mt-2">Loading your call history...</p>
                    </div>
                  ) : callHistory.length > 0 ? (
                    <CallHistory 
                      calls={callHistory}
                      onCallClick={handleHistoryItemClick}
                      onDeleteClick={handleHistoryItemDelete}
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No call history yet</p>
                      <p className="text-sm mt-2">Start making calls to see your history here</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Transaction History Card (Moved Down & Collapsible) */}
            <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Transaction History</h2>
                  <button 
                    onClick={() => setIsTransactionHistoryOpen(!isTransactionHistoryOpen)}
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium focus:outline-none"
                    aria-expanded={isTransactionHistoryOpen}
                    aria-controls="transaction-history-content"
                  >
                    {isTransactionHistoryOpen ? 'Hide' : 'Show'}
                    {/* Optional: Add chevron icon rotation based on state */} 
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className={`inline-block h-4 w-4 ml-1 transition-transform duration-200 ${isTransactionHistoryOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                
                {/* Collapsible Content */}
                {isTransactionHistoryOpen && (
                  <div id="transaction-history-content">
                    {isLoadingTransactions && (
                      <div className="text-center py-4">
                        <div className="loading loading-spinner loading-md text-gray-400"></div>
                        <p className="text-sm text-gray-500 mt-1">Loading history...</p>
                      </div>
                    )}
                    {transactionsError && (
                      <div className="p-3 bg-red-100 text-red-700 text-sm rounded-md">
                        Error loading history: {transactionsError}
                      </div>
                    )}
                    {!isLoadingTransactions && !transactionsError && (
                        <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                            {transactions.length === 0 ? (
                                <li className="py-3 text-sm text-gray-500 text-center">No transactions found.</li>
                            ) : (
                                transactions.map(renderTransaction)
                            )}
                        </ul>
                    )}
                  </div>
                )}
            </div>
            
            {/* Account Details Card - NEW */} 
            <AccountDetailsCard />

            {/* Support Card - NEW */} 
            <SupportCard />
          </div>
        </div>
      </main>

      <AddFundsModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAmountSelected={handleConfirmAddFunds}
        isProcessing={isProcessingPayment}
      />
      
      <Footer />
    </div>
  );
} 