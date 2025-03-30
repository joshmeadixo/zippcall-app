import { useState, useEffect, useCallback } from 'react';
import { Device, Call } from '@twilio/voice-sdk';

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
    if (!userId) return;

    let isMounted = true;
    let localStream: MediaStream | null = null;
    
    const initDevice = async () => {
      try {
        // First, ensure we have microphone access before initializing
        try {
          // This will trigger the browser's permission prompt if needed
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('Microphone access granted');
        } catch (err) {
          console.error('Error accessing microphone:', err);
          if (isMounted) setError('Microphone access is required for calls');
          return;
        }

        // Fetch a token from our API
        const response = await fetch('/api/twilio-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch token');
        }

        const { token } = await response.json();
        
        // Create a new Device with appropriate options
        const newDevice = new Device(token, {
          logLevel: 'debug',
        });

        // Set up event listeners
        newDevice.on('registered', () => {
          if (isMounted) setIsReady(true);
        });

        newDevice.on('error', (twilioError) => {
          console.error('Twilio device error:', twilioError);
          if (isMounted) setError(twilioError.message);
        });

        newDevice.on('incoming', (incomingCall) => {
          setCall(incomingCall);
          
          // Set up call event listeners
          incomingCall.on('accept', () => {
            if (isMounted) {
              setIsConnected(true);
              setIsAccepted(true);
            }
          });
          
          incomingCall.on('disconnect', () => {
            if (isMounted) {
              setCall(null);
              setIsConnected(false);
              setIsAccepted(false);
            }
          });

          incomingCall.on('cancel', () => {
            if (isMounted) {
              setCall(null);
              setIsAccepted(false);
            }
          });
        });

        // Register the device to receive incoming calls
        await newDevice.register();
        
        if (isMounted) setDevice(newDevice);
      } catch (err) {
        console.error('Error initializing Twilio device:', err);
        if (isMounted) setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    initDevice();

    // Clean up
    return () => {
      isMounted = false;
      if (device) {
        device.destroy();
      }
      // Stop any media tracks if we had a stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [userId]); // intentionally omitting 'device' to prevent infinite rerender loops

  // Register listeners for device state changes
  useEffect(() => {
    if (!device) return; // Don't register listeners if device isn't ready

    const handleReady = () => {
      console.log('Twilio Device Ready');
      setIsReady(true);
    };

    const handleConnect = (connection: Call) => {
      console.log('Call connected', connection);
      setIsConnecting(false);
      setIsConnected(true);
      setCall(connection);
    };

    const handleDisconnect = (connection: Call) => {
      console.log('Call disconnected', connection);
      setIsConnecting(false);
      setIsConnected(false);
      setIsAccepted(false);
      setCall(null);
      setError(null);
    };

    // Type guard to check if error has a code property
    function isTwilioError(error: unknown): error is { code: number; message: string } {
      return (
        typeof error === 'object' && 
        error !== null && 
        'code' in error && typeof (error as { code: unknown }).code === 'number' &&
        'message' in error && typeof (error as { message: unknown }).message === 'string'
      );
    }

    const handleErrorEvent = (error: unknown) => { // Type error as unknown
      console.error('Twilio Device Error:', error);
      let errorMessage = 'An unknown error occurred';
      if (isTwilioError(error)) { // Type guard narrows it down
        errorMessage = `Error ${error.code}: ${error.message}`;
        // Handle specific error codes
        if (error.code === 31205) { 
          errorMessage = 'Your session expired. Please refresh the page.';
        } else if (error.code === 31000) { 
          errorMessage = 'A general connection error occurred.';
        } else if (error.code === 20104) { 
          errorMessage = 'Invalid authentication token. Session may be invalid.';
        } else if (error.code === 31005) { 
          errorMessage = 'Cannot establish connection. Check your network.';
        } else if (error.code === 31208) { 
            errorMessage = 'Authentication failed. Please try again.';
        }
      }
      setError(errorMessage);
      setIsConnecting(false);
      setIsConnected(false);
      setCall(null);
    };

    const handleIncoming = (connection: Call) => {
      console.log('Incoming call:', connection);
      setCall(connection);
      connection.on('accept', () => {
        console.log('Incoming call accepted');
        setIsAccepted(true);
        setIsConnected(true);
      });
      connection.on('reject', () => {
        console.log('Incoming call rejected');
        setCall(null);
        setIsConnected(false);
      });
      connection.on('cancel', () => {
        console.log('Incoming call cancelled by caller');
        setCall(null);
        setIsConnected(false);
      });
      connection.on('disconnect', () => {
        console.log('Incoming call disconnected');
        handleDisconnect(connection);
      });
    };

    device.on('ready', handleReady);
    device.on('connect', handleConnect);
    device.on('disconnect', handleDisconnect);
    device.on('error', handleErrorEvent); 
    device.on('incoming', handleIncoming);

    // Cleanup listeners when the component unmounts or userId changes
    return () => {
      device.off('ready', handleReady);
      device.off('connect', handleConnect);
      device.off('disconnect', handleDisconnect);
      device.off('error', handleErrorEvent);
      device.off('incoming', handleIncoming);
    };
  }, [userId]); // intentionally omitting 'device' to prevent infinite rerender loops

  // Make an outgoing call
  const makeCall = useCallback(async (to: string) => {
    if (!device) {
      setError('Device is not initialized');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Make the call
      const outgoingCall = await device.connect({
        params: {
          To: to,
          // Additional parameters if needed
        }
      });

      // Set up call event listeners
      outgoingCall.on('accept', () => {
        setIsConnected(true);
        setIsConnecting(false);
        setIsAccepted(true);
      });

      outgoingCall.on('disconnect', () => {
        setCall(null);
        setIsConnected(false);
        setIsConnecting(false);
        setIsAccepted(false);
      });

      outgoingCall.on('error', (callError) => {
        console.error('Call error:', callError);
        setError(callError.message);
        setIsConnecting(false);
        setIsAccepted(false);
      });

      setCall(outgoingCall);
    } catch (err) {
      console.error('Error making call:', err);
      setError(err instanceof Error ? err.message : 'Failed to make call');
      setIsConnecting(false);
    }
  }, [device]);

  // Hang up the current call
  const hangupCall = useCallback(() => {
    if (call) {
      call.disconnect();
      setCall(null);
      setIsConnected(false);
      setIsConnecting(false);
      setIsAccepted(false);
    }
  }, [call]);

  // Answer an incoming call
  const answerCall = useCallback(() => {
    if (call) {
      call.accept();
    }
  }, [call]);

  // Reject an incoming call
  const rejectCall = useCallback(() => {
    if (call) {
      call.reject();
      setCall(null);
      setIsAccepted(false);
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