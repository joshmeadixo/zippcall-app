"use client";

import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Footer from '@/components/Footer';
import Header from '@/components/Header';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Use the Header component */}
      <Header showSignOut={true} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 flex-grow flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-6xl font-bold text-blue-600 mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Page Not Found</h2>
          <p className="text-gray-600 mb-8">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved, deleted, or never existed.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="/dashboard"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Dashboard
            </Link>
            <button 
              onClick={() => window.history.back()}
              className="px-5 py-2.5 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
} 