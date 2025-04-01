'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import AdminAccessOnly from '@/components/admin/AdminAccessOnly';
import { Metadata } from 'next'; // Use Metadata type if needed, but remove static export

// Define a type for the user data we expect from the API
interface AdminUserView {
  uid: string;
  email: string | null;
  displayName: string;
  phoneNumber: string | null;
  isAdmin: boolean;
  balance: number;
  lastLogin: string | null;
  createdAt: string | null;
}

// State to manage which user is being edited and the new balance value
interface EditState {
  userId: string | null;
  currentBalance: number;
  inputBalance: string; // Store input as string for flexibility
}

// Cannot use static metadata export in a Client Component
// export const metadata: Metadata = {
//   title: 'User Management - Admin Dashboard',
// };

export default function UserManagementPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for editing balance
  const [editState, setEditState] = useState<EditState | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) {
        setIsLoading(false);
        setError('Authentication required.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/users', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch users: ${response.statusText}`);
        }

        const data: AdminUserView[] = await response.json();
        setUsers(data);

      } catch (err: any) {
        console.error('Error fetching users:', err);
        setError(err.message || 'An unexpected error occurred while fetching users.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [user]);

  // Function to initiate editing for a user
  const handleEditBalanceClick = (targetUser: AdminUserView) => {
    setUpdateError(null); // Clear previous update errors
    setEditState({
      userId: targetUser.uid,
      currentBalance: targetUser.balance,
      inputBalance: targetUser.balance.toFixed(2), // Initialize input with current balance
    });
  };

  // Function to cancel editing
  const handleCancelEdit = () => {
    setEditState(null);
    setUpdateError(null);
  };

  // Function to handle input change
  const handleBalanceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editState) {
      setEditState({ ...editState, inputBalance: e.target.value });
    }
  };

  // Function to save the updated balance
  const handleSaveBalance = async () => {
    if (!editState || !user) return;

    const { userId, inputBalance } = editState;
    if (userId === null) return;

    const newBalanceNum = parseFloat(inputBalance);

    // Validate input
    if (isNaN(newBalanceNum) || newBalanceNum < 0) {
      setUpdateError('Invalid balance. Please enter a non-negative number.');
      return;
    }
    
    // Optimistic UI check: If balance hasn't changed, don't call API
    // if (newBalanceNum.toFixed(2) === editState.currentBalance.toFixed(2)) {
    //     handleCancelEdit();
    //     return;
    // }

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/update-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUserId: userId,
          newBalance: newBalanceNum,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update balance: ${response.statusText}`);
      }

      const data = await response.json();

      // Update local state immediately on success
      setUsers(currentUsers => 
        currentUsers.map(u => 
          u.uid === userId ? { ...u, balance: data.newBalance } : u
        )
      );
      
      // Clear edit state
      handleCancelEdit(); 

    } catch (err: any) {
      console.error('Error updating balance:', err);
      setUpdateError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper to format date strings
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <AdminAccessOnly>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">User Management</h1>

        {isLoading && (
          <div className="text-center py-10">
            <div className="loading loading-spinner loading-lg text-blue-500"></div>
            <p className="mt-2">Loading users...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Display Update Error */} 
        {updateError && (
           <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Update Error: </strong>
            <span className="block sm:inline">{updateError}</span>
           </div>
        )}

        {!isLoading && !error && (
          <div className="bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No users found.</td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.uid}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.email || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.displayName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {/* Conditional display for editing balance */}
                        {editState?.userId === u.uid ? (
                          <input 
                            type="number"
                            value={editState.inputBalance}
                            onChange={handleBalanceInputChange}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveBalance()} // Optional: Save on Enter
                            className="w-20 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            step="0.01"
                            min="0"
                            autoFocus // Focus the input when it appears
                          />
                        ) : (
                          `$${u.balance.toFixed(2)}`
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.isAdmin ? 'Yes' : 'No'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(u.lastLogin)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {/* Conditional Action Buttons */}
                        {editState?.userId === u.uid ? (
                          <div className="flex space-x-2">
                            <button 
                              onClick={handleSaveBalance}
                              disabled={isUpdating}
                              className="text-green-600 hover:text-green-900 disabled:text-gray-400"
                            >
                              {isUpdating ? 'Saving...' : 'Save'}
                            </button>
                            <button 
                              onClick={handleCancelEdit}
                              disabled={isUpdating}
                              className="text-red-600 hover:text-red-900 disabled:text-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleEditBalanceClick(u)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Modify Balance
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminAccessOnly>
  );
} 