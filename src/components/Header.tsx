'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  showSignOut?: boolean;
}

export default function Header({ showSignOut = true }: HeaderProps) {
  const { signOut, user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/'); // Redirect to home page after signing out
  };

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <div className="w-10 h-10 relative mr-2">
              <Image 
                src="/images/zippcall-logo.png" 
                alt="ZippCall Logo" 
                width={40} 
                height={40}
                className="object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-blue-500">ZippCall</h1>
          </Link>
        </div>
        
        <div className="flex items-center space-x-4">
          {showSignOut && user && (
            <button 
              onClick={handleSignOut}
              className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 transition-colors"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </header>
  );
} 