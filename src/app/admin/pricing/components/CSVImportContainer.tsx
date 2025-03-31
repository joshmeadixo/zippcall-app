'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the actual CSV import component with SSR disabled
const CSVImportSection = dynamic(
  () => import('./CSVImportSection'),
  { ssr: false }
);

export default function CSVImportContainer() {
  return (
    <Suspense fallback={
      <div className="bg-white rounded-lg shadow mb-6 p-6 border border-gray-200">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <CSVImportSection />
    </Suspense>
  );
} 