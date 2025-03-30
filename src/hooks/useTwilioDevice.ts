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
            if (isMounted) setIsConnected(true);
          });
          
          incomingCall.on('disconnect', () => {
            if (isMounted) {
              setCall(null);
              setIsConnected(false);
            }
          });

          incomingCall.on('cancel', () => {
            if (isMounted) setCall(null);
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
      });

      outgoingCall.on('disconnect', () => {
        setCall(null);
        setIsConnected(false);
        setIsConnecting(false);
      });

      outgoingCall.on('error', (callError) => {
        console.error('Call error:', callError);
        setError(callError.message);
        setIsConnecting(false);
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
    }
  }, [call]);

  return {
    device,
    call,
    isReady,
    isConnecting,
    isConnected,
    error,
    makeCall,
    hangupCall,
    answerCall,
    rejectCall,
  };
} 