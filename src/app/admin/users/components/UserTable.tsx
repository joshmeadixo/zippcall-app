'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AdminUserRecord } from '../actions'; // Use the type from actions
import MobileCardView from '@/components/admin/MobileCardView';

// State to manage which user is being edited and the new balance value
interface EditState {
  userId: string | null;
  currentBalance: number;
  inputBalance: string; // Store input as string for flexibility
}

interface UserTableProps {
  initialUsers: AdminUserRecord[];
}

export default function UserTable({ initialUsers }: UserTableProps) {
  const { user } = useAuth(); // Needed for auth token when updating balance
  const [users, setUsers] = useState<AdminUserRecord[]>(initialUsers);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Function to initiate editing for a user
  const handleEditBalanceClick = (targetUser: AdminUserRecord) => {
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
    if (!editState || !user) return; // Check for user auth context

    const { userId, inputBalance } = editState;
    if (userId === null) return;

    const newBalanceNum = parseFloat(inputBalance);

    // Validate input
    if (isNaN(newBalanceNum) || newBalanceNum < 0) {
      setUpdateError('Invalid balance. Please enter a non-negative number.');
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const token = await user.getIdToken(); // Get token from auth context
      const response = await fetch('/api/admin/update-balance', { // Ensure this API route exists and handles auth
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

    } catch (err: unknown) {
      console.error('Error updating balance:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setUpdateError(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper to format date strings
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid Date';
    }
  };

  // Generate card items for mobile view
  const mobileCardItems = users.map(u => ({
    id: u.uid,
    fields: [
      { label: 'Email', value: u.email || 'N/A' },
      { label: 'Name', value: u.displayName },
      { 
        label: 'Balance', 
        value: editState?.userId === u.uid ? (
          <input 
            type="number"
            value={editState.inputBalance}
            onChange={handleBalanceInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveBalance()}
            className="w-24 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            step="0.01"
            min="0"
            autoFocus
          />
        ) : (
          `$${u.balance.toFixed(2)}`
        )
      },
      { label: 'Admin', value: u.isAdmin ? 'Yes' : 'No' },
      { label: 'Last Login', value: formatDate(u.lastLogin) },
    ],
    actions: editState?.userId === u.uid ? (
      <div className="flex items-center space-x-4">
        <button
          onClick={handleSaveBalance}
          disabled={isUpdating}
          className="text-green-600 hover:text-green-900 disabled:opacity-50"
        >
          {isUpdating ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleCancelEdit}
          disabled={isUpdating}
          className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    ) : (
      <button
        onClick={() => handleEditBalanceClick(u)}
        className="text-indigo-600 hover:text-indigo-900 px-3 py-1 text-sm border border-indigo-200 rounded hover:bg-indigo-50"
      >
        Edit Balance
      </button>
    )
  }));

  return (
    <>
      {/* Display Update Error */} 
      {updateError && (
         <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">Update Error: </strong>
          <span className="block sm:inline">{updateError}</span>
         </div>
      )}

      {/* Desktop version (hidden on small screens) */}
      <div className="hidden md:block bg-white shadow-md rounded-lg overflow-x-auto">
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
                    {editState?.userId === u.uid ? (
                      <input 
                        type="number"
                        value={editState.inputBalance}
                        onChange={handleBalanceInputChange}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveBalance()}
                        className="w-20 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        step="0.01"
                        min="0"
                        autoFocus
                      />
                    ) : (
                      `$${u.balance.toFixed(2)}`
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.isAdmin ? 'Yes' : 'No'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(u.lastLogin)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {editState?.userId === u.uid ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handleSaveBalance}
                          disabled={isUpdating}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                        >
                          {isUpdating ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                          className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditBalanceClick(u)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit Balance
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile version (shown only on small screens) */}
      <div className="md:hidden">
        <MobileCardView items={mobileCardItems} />
      </div>
    </>
  );
} 