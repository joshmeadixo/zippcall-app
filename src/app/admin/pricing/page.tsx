import PricingDashboard from '@/components/admin/PricingDashboard';
import { Metadata } from 'next';
import { CSVImport } from './components/CSVImport';
import { TwilioPriceData } from '@/types/pricing';

export const metadata: Metadata = {
  title: 'Pricing Management | ZippCall Admin',
  description: 'Manage call pricing for different countries'
};

export default async function PricingPage() {
  // Create an empty pricingData object to satisfy the component's props requirement
  const emptyPricingData: Record<string, TwilioPriceData> = {};

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Call Pricing Management</h1>
      
      {/* Add CSV Import Section */}
      <CSVImport />
      
      <PricingDashboard pricingData={emptyPricingData} />
    </div>
  );
} 