'use server';

// Remove unused import
// import { Loops } from 'loops'; 

// Constants for Loops API
const LOOPS_API_KEY = process.env.LOOPS_API_KEY || '';
const LOOPS_CONTACT_CREATE_ENDPOINT = 'https://app.loops.so/api/v1/contacts/create';

interface AddContactArgs {
  email: string;
  uid: string; // User's Firebase UID
  firstName?: string; // Optional
  lastName?: string;  // Optional
}

// Define interface for the payload
interface LoopsContactPayload {
  email: string;
  userId: string;
  source: string;
  firstName?: string;
  lastName?: string;
  // Add other potential fields if needed
}

/**
 * Adds or updates a contact in Loops.
 * Uses the 'create' endpoint which typically handles upsert (create or update).
 */
export async function addOrUpdateLoopsContact(args: AddContactArgs): Promise<{ success: boolean; message?: string }> {
  const { email, uid, firstName, lastName } = args;
  console.log(`[Server Action] Adding/updating Loops contact for UID: ${uid}, Email: ${email}`);

  if (!LOOPS_API_KEY) {
    console.error('[Server Action] Loops API key is missing for contact creation.');
    // Return success as false but maybe don't block user flow for this
    return { success: false, message: 'Server configuration error: Loops API key missing.' };
  }

  if (!email || !uid) {
      console.error('[Server Action] Email or UID missing for Loops contact creation.');
      return { success: false, message: 'Email or User ID is required.'};
  }

  const payload: LoopsContactPayload = {
    email: email,
    userId: uid, // Maps UID to Loops userId
    source: 'app_customer', // As requested
    // Add optional fields if provided
    ...(firstName && { firstName }),
    ...(lastName && { lastName }),
    // You could add other standard or custom fields here
    // e.g., subscribed: true, // If you want to auto-subscribe them to a list
  };

  try {
    const response = await fetch(LOOPS_CONTACT_CREATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOOPS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Loops create endpoint returns 200 for success (creation or update)
    // It might return different status codes for errors (e.g., 400 for bad request)
    if (response.ok) {
      const responseBody = await response.json(); // Contains { success: true, id: 'contact_...' } or similar
      console.log('[Server Action] Loops contact created/updated successfully:', responseBody);
      return { success: true };
    } else {
      // Attempt to parse error response
      let errorMessage = `Loops API request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.message || errorMessage;
         console.error('[Server Action] Failed to create/update Loops contact. Status:', response.status, 'Body:', errorBody);
      } catch {
         // Ignoring parse error, we already have a default message
         console.error('[Server Action] Failed to create/update Loops contact. Status:', response.status, '(Could not parse error body)');
      }
      return { success: false, message: errorMessage };
    }

  } catch (error: unknown) {
    console.error('[Server Action] Error calling Loops Create Contact API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { success: false, message: errorMessage || 'An unexpected error occurred while syncing contact to Loops.' };
  }
} 