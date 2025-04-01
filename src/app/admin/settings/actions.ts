'use server';

import twilio from 'twilio';

// Re-define the interface here or import from page if needed elsewhere
interface TwilioPhoneNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  dateCreated: string; // Keep as string for serialization
}

export async function getTwilioPhoneNumbers(): Promise<TwilioPhoneNumber[]> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.error('[Twilio Action] Error: Twilio Account SID or Auth Token missing in environment variables.');
    throw new Error('Twilio credentials are not configured on the server.');
  }

  try {
    console.log('[Twilio Action] Initializing Twilio client...');
    const client = twilio(accountSid, authToken);

    console.log('[Twilio Action] Fetching incoming phone numbers...');
    const numbers = await client.incomingPhoneNumbers.list({ limit: 100 }); // Adjust limit if needed
    console.log(`[Twilio Action] Fetched ${numbers.length} phone numbers.`);

    // Map the response to our simplified interface
    const formattedNumbers: TwilioPhoneNumber[] = numbers.map(num => ({
      sid: num.sid,
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      // Convert Date object to ISO string for serialization
      dateCreated: num.dateCreated.toISOString(), 
    }));

    return formattedNumbers;

  } catch (error: unknown) {
    console.error('[Twilio Action] Error fetching Twilio phone numbers:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while communicating with Twilio.';
    // Re-throw a more user-friendly error or handle as needed
    throw new Error(`Failed to fetch Twilio phone numbers: ${errorMessage}`);
  }
} 