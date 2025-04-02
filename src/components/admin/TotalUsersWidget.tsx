import React from 'react';
import { getTotalUsers } from '@/app/admin/users/actions'; // Import the new action

export default async function TotalUsersWidget() {
  let totalUsers = 0;
  try {
    totalUsers = await getTotalUsers(); // Call the action
  } catch (error) {
    console.error("Error fetching total users for widget:", error);
    // Display 0 or an error message if fetching fails
  }

  return (
    <div className="bg-white p-4 sm:p-5 rounded-lg shadow flex flex-col h-full">
      <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
        Total Registered Users
      </h3>
      <div className="mt-auto">
        <p className="text-2xl sm:text-3xl font-bold text-gray-900">
          {totalUsers.toLocaleString()} {/* Format number with commas */}
        </p>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Active accounts
        </p>
      </div>
      {/* Optional: Add a subtitle or link if needed */}
      {/* <p className="text-sm text-gray-500">Across the platform</p> */}
    </div>
  );
} 