import React from 'react';
import { getTotalCallDuration } from '@/app/admin/calls/actions';

// Helper function to format seconds into HH:MM:SS
function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) return '00:00:00';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedHours = String(hours).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
}

export default async function TotalCallDurationWidget() {
  let totalDuration = 0;
  try {
    totalDuration = await getTotalCallDuration();
  } catch (error) {
    console.error("Error fetching total call duration for widget:", error);
    // Display 0 or an error message if fetching fails
  }

  const formattedDuration = formatDuration(totalDuration);

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        Total Call Duration
      </h3>
      <p className="text-3xl font-bold text-gray-900">
        {formattedDuration}
      </p>
      <p className="text-sm text-gray-500">
        (HH:MM:SS)
      </p>
    </div>
  );
} 