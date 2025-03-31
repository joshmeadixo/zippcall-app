/**
 * Authentication utilities for admin operations
 */

/**
 * Gets the authorization header for admin API requests
 * Uses the NEXT_PUBLIC_ADMIN_TOKEN environment variable
 * 
 * @returns {Promise<string>} Authorization header value
 */
export async function getAdminAuthHeader(): Promise<string> {
  const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
  
  if (!adminToken) {
    console.warn('Admin token is not configured. Please check your .env.local file.');
  }
  
  return `Bearer ${adminToken}`;
} 