'use server';

// Remove the unused SDK import
// import * as LoopsNamespace from 'loops'; 

// Remove the unused and problematic SDK initialization block
// // Initialize Loops client on the server
// // Attempt to access the client constructor, potentially via .default for CJS interop
// if (!process.env.LOOPS_API_KEY) {
//   console.warn('[supportActions] Warning: LOOPS_API_KEY is not set. Support form submissions will fail.');
// }
// // Assuming the constructor might be the default export from the namespace
// // @ts-ignore // Ignore potential TS error for now as we're exploring
// const loops = new LoopsNamespace.default(process.env.LOOPS_API_KEY || '');

const LOOPS_API_KEY = process.env.LOOPS_API_KEY || '';
const LOOPS_TRANSACTIONAL_ENDPOINT = 'https://app.loops.so/api/v1/transactional';

interface SupportFormData {
  name: string;
  email: string;
  message: string;
  uid: string;
}

// Type for Loops API response
interface LoopsApiResponse {
  success: boolean;
  message?: string;
  id?: string;
  [key: string]: unknown;
}

export async function submitSupportRequest(formData: SupportFormData): Promise<{ success: boolean; message?: string }> {
  console.log('[Server Action] Received support request for UID:', formData.uid);

  if (!LOOPS_API_KEY) {
    console.error('[Server Action] Loops API key is missing.');
    return { success: false, message: 'Server configuration error: Loops API key missing.' };
  }

  let supportEmailSuccess = false;
  let supportErrorMessage = 'Failed to send support notification.';

  // --- Send Transactional Email to Support Team --- 
  console.log('[Server Action] Sending transactional email to support team.');
  const supportPayload = {
    transactionalId: "cm90euos303fw13hgzc7s4nsj", 
    email: "hi@joshmead.me",
    dataVariables: {
      propertiesname: formData.name,
      propertiesmessage: formData.message,
      email: formData.email,
      propertiessubmissionTimestamp: new Date().toISOString(), 
      userId: formData.uid
    }
  };

  try {
    const supportResponse = await fetch(LOOPS_TRANSACTIONAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOOPS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(supportPayload)
    });

    const supportResponseBody = await supportResponse.json() as LoopsApiResponse;
    console.log('[Server Action] Loops Support Email API response status:', supportResponse.status);
    console.log('[Server Action] Loops Support Email API response body:', supportResponseBody);

    if (supportResponse.ok && supportResponseBody.success === true) {
      console.log('[Server Action] Support transactional email sent successfully.');
      supportEmailSuccess = true; 
    } else {
      supportErrorMessage = supportResponseBody.message || `Support API request failed with status ${supportResponse.status}`;
      console.error('[Server Action] Failed to send support transactional email:', supportErrorMessage);
    }

  } catch (error: unknown) {
    console.error('[Server Action] Error calling Loops Transactional API for support email:', error);
    supportErrorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    supportEmailSuccess = false;
  }

  // --- If Support Email Succeeded, Send Confirmation Email to User --- 
  if (supportEmailSuccess) {
    console.log('[Server Action] Sending confirmation email to user:', formData.email);
    const userPayload = {
      transactionalId: "cm90fgf5u04xjd8dnyf3xsz60", // The new ID for user confirmation
      email: formData.email,                  // User's email as recipient
      dataVariables: {
          // Populate needed variables for the user template
          propertiesname: formData.name, 
          propertiesmessage: formData.message, // Maybe not needed for user confirmation?
          propertiessubmissionTimestamp: new Date().toISOString(), 
          userId: formData.uid,
          email: formData.email 
      }
    };

    try {
        const userResponse = await fetch(LOOPS_TRANSACTIONAL_ENDPOINT, {
            method: 'POST',
            headers: {
            'Authorization': `Bearer ${LOOPS_API_KEY}`,
            'Content-Type': 'application/json'
            },
            body: JSON.stringify(userPayload)
        });

        const userResponseBody = await userResponse.json() as LoopsApiResponse;
        console.log('[Server Action] Loops User Confirmation API response status:', userResponse.status);
        console.log('[Server Action] Loops User Confirmation API response body:', userResponseBody);

        if (!(userResponse.ok && userResponseBody.success === true)) {
            // Log a warning if the user confirmation fails, but don't fail the overall request
            console.warn('[Server Action] Failed to send confirmation email to user:', userResponseBody.message || `User confirmation API request failed with status ${userResponse.status}`);
        }

    } catch (error: unknown) {
        console.warn('[Server Action] Error calling Loops Transactional API for user confirmation:', error);
    }
    
    // Since support email succeeded, return overall success
    return { success: true }; 

  } else {
    // Support email failed, return overall failure
    return { success: false, message: supportErrorMessage };
  }
} 