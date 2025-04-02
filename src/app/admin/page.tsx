import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import AdminAccessOnly from '@/components/admin/AdminAccessOnly';
import TotalCallDurationWidget from '@/components/admin/TotalCallDurationWidget';
import TotalUsersWidget from '@/components/admin/TotalUsersWidget';

export const metadata: Metadata = {
  title: 'Admin Dashboard - Zipp Call',
  description: 'Administrative controls for Zipp Call',
};

// Force dynamic rendering to ensure data is fresh on each request
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const adminModules = [
    {
      title: 'Pricing Management',
      description: 'Manage call pricing, markups, and view price change alerts',
      href: '/admin/pricing',
      icon: (
        <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'User Management',
      description: 'View and manage user accounts and permissions',
      href: '/admin/users',
      icon: (
        <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      title: 'Call Records',
      description: 'View detailed call records and analytics',
      href: '/admin/calls',
      icon: (
        <svg className="h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
    },
    {
      title: 'System Settings',
      description: 'Configure application settings and integrations',
      href: '/admin/settings',
      icon: (
        <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <AdminAccessOnly>
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage your Zipp Call application</p>
        </header>

        {/* Summary Widgets Section */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3 sr-only">Summary Metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <TotalCallDurationWidget />
            <TotalUsersWidget />
          </div>
        </section>

        {/* Admin Modules Navigation */}
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Admin Modules</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {adminModules.map((module) => (
              <Link
                key={module.title}
                href={module.href}
                className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
              >
                <div className="mb-3 sm:mb-4">{module.icon}</div>
                <h3 className="text-lg font-semibold mb-1 sm:mb-2 text-center">{module.title}</h3>
                <p className="text-sm text-gray-600 text-center">{module.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminAccessOnly>
  );
} 