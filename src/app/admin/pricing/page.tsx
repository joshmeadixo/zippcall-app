import PricingDashboard from '@/components/admin/PricingDashboard';
import { Metadata } from 'next';
import CSVImportContainer from './components/CSVImportContainer';

export const metadata: Metadata = {
  title: 'Pricing Management | ZippCall Admin',
  description: 'Manage call pricing for different countries'
};

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Call Pricing Management</h1>
      
      {/* Add CSV Import Section */}
      <CSVImportContainer />
      
      <PricingDashboard />
    </div>
  );
} 