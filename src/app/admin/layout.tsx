import React from 'react';
import { Metadata } from 'next';
import AdminLayoutClient from '@/components/admin/AdminLayoutClient';

export const metadata: Metadata = {
  title: 'Admin - Zipp Call',
  description: 'ZippCall Administration',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminLayoutClient>
      {children}
    </AdminLayoutClient>
  );
} 