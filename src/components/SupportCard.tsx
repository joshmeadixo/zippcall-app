'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
// Remove Loops SDK import from client component
// import Loops from '@loops/node'; 
import { submitSupportRequest } from '@/app/actions/supportActions'; // Import the server action

// Remove Loops client initialization from client component
// const loops = new Loops(process.env.LOOPS_API_KEY || '');

// Define the structure for the form data
interface SupportFormData {
  name: string;
  email: string;
  message: string;
  uid: string;
}

export default function SupportCard() {
  const { user, loading: authLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<SupportFormData>({
    name: '',
    email: '', // Will be pre-filled
    message: '',
    uid: '', // Will be set from user context
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string>(''); // To store success/error messages

  // Pre-fill email and uid when user data is available
  useEffect(() => { 
    if (user) {
      setFormData(prev => ({ ...prev, email: user.email || '', uid: user.uid }));
    }
  }, [user]);

  // Don't render card if loading or no user
  if (authLoading || !user) {
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setSubmitMessage('');
    console.log('[SupportCard] Calling submitSupportRequest server action with:', formData);

    // Call the server action
    try {
      const result = await submitSupportRequest(formData);
      console.log('[SupportCard] Server action response:', result);

      if (result.success) {
        setSubmitStatus('success');
        setSubmitMessage('Message sent successfully!');
        // Optionally reset form and close modal after a delay
        setTimeout(() => {
          setFormData(prev => ({ ...prev, name: '', message: '' })); // Keep email/uid
          setIsModalOpen(false);
          setSubmitStatus('idle');
          setSubmitMessage('');
        }, 2000);
      } else {
        setSubmitStatus('error');
        setSubmitMessage(result.message || 'Failed to send message. Please try again.');
      }

    } catch (error: unknown) {
      console.error('[SupportCard] Error calling server action:', error);
      setSubmitStatus('error');
      setSubmitMessage('An unexpected error occurred on the client.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Support</h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-blue-500 hover:text-blue-700 text-sm font-medium focus:outline-none"
          aria-expanded={isOpen}
          aria-controls="support-card-content"
        >
          {isOpen ? 'Hide' : 'Show'}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`inline-block h-4 w-4 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Collapsible Content */}
      {isOpen && (
        <div id="support-card-content" className="pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-600 mb-4">
            Need help? Contact our support team.
          </p>
          <button
            onClick={() => {
              setIsModalOpen(true);
              setSubmitStatus('idle'); // Reset status when opening modal
              setSubmitMessage('');
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            Contact Support
          </button>
        </div>
      )}

      {/* Contact Support Modal */} 
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Contact Support</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email} // Pre-filled, potentially read-only
                  readOnly // Make email read-only
                  disabled
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-500 focus:outline-none"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Submission Status - Updated to use submitMessage */} 
              {submitStatus === 'success' && (
                <p className="text-sm text-green-600 mb-3">{submitMessage}</p>
              )}
              {submitStatus === 'error' && (
                <p className="text-sm text-red-600 mb-3">{submitMessage}</p>
              )}
              
              <div className="flex justify-end space-x-3">
                 <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 