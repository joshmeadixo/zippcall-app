import React from 'react';
import AdminAccessOnly from '@/components/admin/AdminAccessOnly';
import TotalUsersWidget from '@/components/admin/TotalUsersWidget'; // Import the new widget
import UserTable from './components/UserTable'; // Import the new client component
import { getAdminUsers, getTotalUsers, AdminUserRecord } from './actions'; // Import server actions and type

// Static metadata can be used in Server Components
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'User Management - Admin Dashboard',
};

export default async function UserManagementPage() {
  let users: AdminUserRecord[] = [];
  let error: string | null = null;

  // Fetch data on the server
  try {
    // Use Promise.all but only destructure the first element
    [users] = await Promise.all([
      getAdminUsers(), // Consider adding pagination/limits later
      getTotalUsers()
    ]);
  } catch (err) {
    console.error('Failed to fetch user data on server:', err);
    error = 'Failed to load user data. Please try again later.';
    // Set default/empty values on error
    users = [];
  }

  // isLoading state is no longer needed as data fetching is synchronous server-side

  return (
    <AdminAccessOnly>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">User Management</h1>

        {/* Display Total Users Widget */} 
        <div className="mb-6">
          <TotalUsersWidget />
        </div>

        {/* Display Server-Side Fetch Error if any */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Loading Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Render the Client Component Table, passing initial data */} 
        {!error && <UserTable initialUsers={users} />}

      </div>
    </AdminAccessOnly>
  );
} 