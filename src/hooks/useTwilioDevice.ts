import { useState, useEffect, useCallback } from 'react';
import { Device, Call } from '@twilio/voice-sdk';

// Keep simpler interface for the expected error structure
interface PotentialTwilioError {
    code: number;
    message: string;
}

interface UseTwilioDeviceProps {
  userId: string;
}

interface UseTwilioDeviceReturn {
  device: Device | null;
  call: Call | null;
  isReady: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  isAccepted: boolean;
  error: string | null;
  makeCall: (to: string) => Promise<void>;
  hangupCall: () => void;
  answerCall: () => void;
  rejectCall: () => void;
}

export function useTwilioDevice({ userId }: UseTwilioDeviceProps): UseTwilioDeviceReturn {
  const [device, setDevice] = useState<Device | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize the device
  useEffect(() => {
    console.log('[useTwilioDevice] Initialize Effect Triggered. userId:', userId);
    let isMounted = true;
    let localDevice: Device | null = null; // Keep local reference for cleanup

    const initializeDevice = async () => {
      if (!userId) {
        console.log('[useTwilioDevice] No userId, skipping initialization.');
        return;
      }
      
      try {
        console.log('[useTwilioDevice] Fetching Twilio token...');
        const response = await fetch('/api/twilio-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch token: ${response.statusText}`);
        }
        const data = await response.json();
        const token = data.token;
        console.log('[useTwilioDevice] Token fetched successfully.');

        if (!isMounted) return; // Prevent setting state if unmounted

        console.log('[useTwilioDevice] Creating new Twilio Device instance...');
        localDevice = new Device(token, {
          logLevel: 1, // 0 = errors, 1 = warnings, 2 = info, 3 = debug, 4 = trace
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          // Ensure edge is explicitly set if needed for your region/setup
          // edge: 'your_edge_location' // e.g., 'ashburn', 'frankfurt' 
        });
        
        await localDevice.register();
        console.log('[useTwilioDevice] Device registered.');

        if (isMounted) {
          setDevice(localDevice);
          setIsReady(true);
          setError(null);
        }
      } catch (err: unknown) {
        console.error('[useTwilioDevice] Initialization failed:', err);
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Unknown error during init';
          setError(`Initialization failed: ${message}`);
          setIsReady(false);
          setDevice(null);
        }
      }
    };

    initializeDevice();

    // Cleanup Function
    return () => {
      isMounted = false;
      console.log('[useTwilioDevice] Cleanup: Destroying device instance...');
      if (localDevice) {
        localDevice.disconnectAll(); // Disconnect active calls
        localDevice.unregister();   // Unregister from Twilio
        localDevice.destroy();      // Destroy the device instance
        console.log('[useTwilioDevice] Cleanup: Device destroyed.');
      }
      // Reset state on cleanup
      setDevice(null);
      setIsReady(false);
      setCall(null);
      setIsConnecting(false);
      setIsConnected(false);
      setIsAccepted(false);
      // Keep error state? Maybe clear it here too?
      // setError(null); 
    };
  }, [userId]); // Effect runs when userId changes

  // Register listeners for device state changes
  useEffect(() => {
    if (!device || !isReady) return; // Only register if device is set and ready

    console.log('[useTwilioDevice] Attaching listeners to device...');

    // Define Handlers
    const handleReady = () => {
      console.log('[useTwilioDevice] Event: Device Ready (already handled by init)');
      // setIsReady(true); // Already set in init
    };

    const handleConnect = (connection: Call) => {
      console.log('[useTwilioDevice] Event: Call connected', connection);
      setIsConnecting(false);
      setIsConnected(true);
      setCall(connection); 
    };

    const handleDisconnect = (connection: Call) => {
      console.log('[useTwilioDevice] Event: Call disconnected', connection);
      setIsConnecting(false);
      setIsConnected(false);
      setIsAccepted(false);
      setCall(null);
      setError(null); 
    };

    // Simplified type guard checking for 'code' property
    function isTwilioError(error: unknown): error is PotentialTwilioError {
      return (
        typeof error === 'object' && 
        error !== null && 
        typeof (error as PotentialTwilioError).code === 'number' 
      );
    }

    const handleErrorEvent = (error: unknown) => {
      console.error('[useTwilioDevice] Event: Twilio Device Error:', error);
      let errorMessage = 'An unknown error occurred';
      if (isTwilioError(error)) { 
        errorMessage = `Error ${error.code}: ${error.message || '(no message)'}`;
        // Handle specific codes...
      } else if (error instanceof Error) {
          errorMessage = error.message;
      }
      setError(errorMessage);
      setIsConnecting(false);
      setIsConnected(false);
      setCall(null);
    };

    const handleIncoming = (connection: Call) => {
      console.log('[useTwilioDevice] Event: Incoming call');
      setCall(connection); 
      
      // Define listeners for this specific call
      const handleAccept = () => { 
          console.log('Incoming call accepted');
          setIsAccepted(true);
          setIsConnected(true);
      }; 
      const handleReject = () => { 
          console.log('Incoming call rejected');
          cleanupCallListeners(); 
          setCall(null); 
          setIsConnected(false);
          setIsAccepted(false);
      }; 
      const handleCancel = () => { 
          console.log('Incoming call cancelled');
          cleanupCallListeners(); 
          setCall(null); 
          setIsConnected(false);
          setIsAccepted(false);
      }; 
      const handleCallDisconnect = () => { 
          console.log('Incoming call disconnected event');
          cleanupCallListeners(); 
          // Let the main device disconnect handler manage state
          // handleDisconnect(connection); 
      }; 
      
      // Cleanup function for *this specific call's* listeners
      const cleanupCallListeners = () => {
          console.log(`Cleaning up listeners for call SID: ${connection.parameters.CallSid}`);
          connection.off('accept', handleAccept);
          connection.off('reject', handleReject); 
          connection.off('cancel', handleCancel);
          connection.off('disconnect', handleCallDisconnect);
      };
      
      // Attach listeners
      connection.on('accept', handleAccept);
      connection.on('reject', handleReject); 
      connection.on('cancel', handleCancel);
      connection.on('disconnect', handleCallDisconnect);

      // Also trigger cleanup if the main device disconnects while this call exists
      // This might be redundant if handleCallDisconnect always fires first
      // const deviceDisconnectHandler = () => cleanupCallListeners();
      // device.on('disconnect', deviceDisconnectHandler); 
      // // Need to ensure deviceDisconnectHandler is removed in the outer cleanup! Very tricky.
      // Let's rely on the call's own disconnect for now.
    };

    // Attach Listeners
    device.on('ready', handleReady); // Though ready is usually handled by register()
    device.on('connect', handleConnect);
    device.on('disconnect', handleDisconnect);
    device.on('error', handleErrorEvent); 
    device.on('incoming', handleIncoming);

    // Cleanup Device Listeners
    return () => {
      console.log('[useTwilioDevice] Cleanup: Removing device listeners...');
      if (device) { // Check if device still exists
        device.off('ready', handleReady);
        device.off('connect', handleConnect);
        device.off('disconnect', handleDisconnect);
        device.off('error', handleErrorEvent);
        device.off('incoming', handleIncoming);
        console.log('[useTwilioDevice] Cleanup: Device listeners removed.');
      }
    };
  // Removed userId dependency - device listeners depend on the device instance itself
  }, [device, isReady]); // Re-run ONLY if device instance or isReady state changes

  // Make an outgoing call
  const makeCall = useCallback(async (to: string) => {
    if (!device || !isReady) {
      setError('Device not ready.');
      console.error('[useTwilioDevice] makeCall: Device not ready.');
      return;
    }
    try {
      console.log(`[useTwilioDevice] makeCall: Initiating call to ${to}`);
      setIsConnecting(true);
      setError(null);
      const outgoingCall = await device.connect({ params: { To: to } });
      console.log('[useTwilioDevice] makeCall: Call object created', outgoingCall);
      setCall(outgoingCall);
      setIsAccepted(true); 
      
      // Attach listeners to the outgoing call
      const handleOutgoingDisconnect = () => {
          console.log('[useTwilioDevice] Outgoing call disconnected.');
          // Remove *this specific listener* before nulling state
          outgoingCall.off('disconnect', handleOutgoingDisconnect);
          setCall(null);
          setIsConnected(false);
          setIsConnecting(false);
          setIsAccepted(false);
      };
      outgoingCall.on('disconnect', handleOutgoingDisconnect);
      
      // We also need to handle the initial 'connect' event for an outgoing call
      // The device 'connect' listener handles this now.

    } catch (err: unknown) {
      console.error('[useTwilioDevice] makeCall: Error:', err);
      const message = err instanceof Error ? err.message : 'Failed to initiate call';
      setError(`Failed to make call: ${message}`);
      setIsConnecting(false);
      setCall(null);
    }
  }, [device, isReady]);

  // Hang up the current call
  const hangupCall = useCallback(() => {
    if (call) {
      console.log('[useTwilioDevice] hangupCall: Hanging up call...');
      call.disconnect(); // This should trigger the 'disconnect' event listeners
      // State changes (isConnected=false etc) are handled by the disconnect listener
    } else {
        console.log('[useTwilioDevice] hangupCall: No active call to hang up.');
    }
  }, [call]);

  // Answer an incoming call
  const answerCall = useCallback(() => {
    if (call) {
      console.log('[useTwilioDevice] answerCall: Accepting incoming call...');
      call.accept();
      // isAccepted/isConnected state change handled by listener on call object
    } else {
         console.log('[useTwilioDevice] answerCall: No incoming call to answer.');
    }
  }, [call]);

  // Reject an incoming call
  const rejectCall = useCallback(() => {
    if (call) {
      console.log('[useTwilioDevice] rejectCall: Rejecting incoming call...');
      call.reject();
      // State changes handled by listener on call object
    } else {
        console.log('[useTwilioDevice] rejectCall: No incoming call to reject.');
    }
  }, [call]);

  return {
    device,
    call,
    isReady,
    isConnecting,
    isConnected,
    isAccepted,
    error,
    makeCall,
    hangupCall,
    answerCall,
    rejectCall,
  };
} 