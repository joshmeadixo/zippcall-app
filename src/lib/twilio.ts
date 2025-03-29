import twilio from 'twilio';

// Environment variables for Twilio configuration
// These should be set in your environment (.env.local)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_APPLICATION_SID = process.env.TWILIO_APPLICATION_SID; // For TwiML apps

// Initialize Twilio client with account credentials
let twilioClient: twilio.Twilio | null = null;

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
} else {
  console.warn('Twilio credentials not found in environment variables');
}

// Phone number pool management
export async function getAvailablePhoneNumber(countryCode = 'US') {
  if (!twilioClient) throw new Error('Twilio client not initialized');
  
  try {
    // Get a list of available phone numbers in the specified country
    const availableNumbers = await twilioClient.availablePhoneNumbers(countryCode)
      .local
      .list({ limit: 10 });
    
    if (availableNumbers.length === 0) {
      throw new Error(`No available phone numbers found in ${countryCode}`);
    }
    
    return availableNumbers[0].phoneNumber;
  } catch (error) {
    console.error('Error getting available phone number:', error);
    throw error;
  }
}

// Purchase and add a phone number to your pool
export async function purchasePhoneNumber(phoneNumber: string) {
  if (!twilioClient) throw new Error('Twilio client not initialized');
  
  try {
    const incomingPhoneNumber = await twilioClient.incomingPhoneNumbers
      .create({
        phoneNumber: phoneNumber,
        // Optional: Set a friendly name to identify this number
        friendlyName: `ZippCall Number ${new Date().toISOString()}`,
        // Link to your TwiML application for handling calls
        voiceApplicationSid: TWILIO_APPLICATION_SID
      });
    
    return incomingPhoneNumber.sid;
  } catch (error) {
    console.error('Error purchasing phone number:', error);
    throw error;
  }
}

// Get a random phone number from your existing pool
export async function getRandomPhoneNumberFromPool() {
  if (!twilioClient) throw new Error('Twilio client not initialized');
  
  try {
    // Get all phone numbers in your account
    const incomingPhoneNumbers = await twilioClient.incomingPhoneNumbers.list();
    
    if (incomingPhoneNumbers.length === 0) {
      throw new Error('No phone numbers found in your account');
    }
    
    // Pick a random number from the pool
    const randomIndex = Math.floor(Math.random() * incomingPhoneNumbers.length);
    return incomingPhoneNumbers[randomIndex].phoneNumber;
  } catch (error) {
    console.error('Error getting random phone number from pool:', error);
    throw error;
  }
}

// Initiate a call using Twilio
export async function makeCall(to: string, from: string) {
  if (!twilioClient) throw new Error('Twilio client not initialized');
  
  try {
    // The 'to' number should be in E.164 format
    // e.g., +14155552671
    const call = await twilioClient.calls.create({
      to,
      from,
      // You can use a TwiML Bin URL or your own endpoint that returns TwiML
      url: process.env.TWILIO_VOICE_URL || 'https://handler.twilio.com/twiml/your-twiml-bin-id',
    });
    
    return call.sid;
  } catch (error) {
    console.error('Error making call:', error);
    throw error;
  }
}

// Generate a Twilio Client token for browser-based calling
export async function generateClientToken(identity: string) {
  if (!twilioClient) throw new Error('Twilio client not initialized');
  if (!TWILIO_APPLICATION_SID) throw new Error('Twilio Application SID not found');
  
  try {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;
    
    // Create a Voice grant for this token
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_APPLICATION_SID,
      incomingAllow: true,
    });
    
    // Create an access token which we will sign and return to the client
    const token = new AccessToken(
      TWILIO_ACCOUNT_SID!,
      TWILIO_AUTH_TOKEN!,
      process.env.TWILIO_API_KEY!,
      { identity }
    );
    
    token.addGrant(voiceGrant);
    
    return token.toJwt();
  } catch (error) {
    console.error('Error generating client token:', error);
    throw error;
  }
}

// Create a call through Twilio Client (browser-based calling)
export function createTwiMLForClientCall(to: string) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  
  // Create a <Dial> verb with appropriate attributes
  const dial = twiml.dial({
    callerId: process.env.TWILIO_CALLER_ID, // This must be a verified number or a Twilio number you own
  });
  
  // Add a <Number> noun with the 'to' parameter
  dial.number(to);
  
  return twiml.toString();
} 