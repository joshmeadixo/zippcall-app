import { useState, useEffect, useCallback, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';

// Keep simpler interface for the expected error structure
interface PotentialTwilioError {
    code: number;
    message: string;
}

// AudioContext type for the window
interface AudioContextWindow extends Window {
  AudioContext: typeof AudioContext;
  webkitAudioContext: typeof AudioContext;
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
  const audioContextRef = useRef<AudioContext | null>(null);

  // Function to ensure AudioContext is created and running
  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      try {
        const windowWithAudioContext = window as unknown as AudioContextWindow;
        const AudioContextClass = windowWithAudioContext.AudioContext || windowWithAudioContext.webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
        console.log('[useTwilioDevice] Created new AudioContext successfully');
      } catch (err) {
        console.error('[useTwilioDevice] Failed to create AudioContext:', err);
        // Return true anyway to allow device initialization to continue
        return true;
      }
    }
    
    // Resume AudioContext if suspended
    if (audioContextRef.current.state === 'suspended') {
      try {
        console.log('[useTwilioDevice] Resuming suspended AudioContext...');
        await audioContextRef.current.resume();
        console.log('[useTwilioDevice] AudioContext resumed successfully.');
      } catch (err) {
        console.error('[useTwilioDevice] Failed to resume AudioContext:', err);
        // Return true anyway to allow initialization to continue
        return true;
      }
    }
    
    return true; // Always return true to continue initialization
  }, []);

  // Initialize the device
  useEffect(() => {
    console.log('[useTwilioDevice] Initialize Effect Triggered. userId:', userId);
    let isMounted = true;
    let localDevice: Device | null = null; // Keep local reference for cleanup
    let initializationTimeout: NodeJS.Timeout | null = null;

    // Check browser compatibility
    const checkBrowserCompatibility = () => {
      const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const isFirefox = navigator.userAgent.indexOf("Firefox") > -1;
      const isEdge = navigator.userAgent.indexOf("Edg") > -1;
      
      console.log('[useTwilioDevice] Browser detection:', { 
        isChrome, isSafari, isFirefox, isEdge, 
        userAgent: navigator.userAgent
      });
      
      return isChrome || isFirefox || isEdge || isSafari;
    };

    // Check if API is available
    const checkApiAvailability = async () => {
      try {
        console.log('[useTwilioDevice] Checking API availability...');
        const response = await fetch('/api/health-check', { 
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' }
        });
        console.log('[useTwilioDevice] API health check response:', response.status);
        return response.ok;
      } catch (error) {
        console.error('[useTwilioDevice] API health check failed:', error);
        return false;
      }
    };

    // Set a timeout for initialization
    initializationTimeout = setTimeout(() => {
      if (isMounted && !isReady) {
        console.error('[useTwilioDevice] Initialization timed out after 15 seconds');
        // Try to check API availability to help with debugging
        checkApiAvailability().then(available => {
          console.log('[useTwilioDevice] API availability status during timeout:', available);
          setError(`Connection timed out. API ${available ? 'seems available' : 'may be unavailable'}. Please refresh and try again.`);
        });
      }
    }, 15000);

    const initializeDevice = async () => {
      if (!userId) {
        console.log('[useTwilioDevice] No userId, skipping initialization.');
        return;
      }
      
      // Check browser compatibility first
      const isBrowserCompatible = checkBrowserCompatibility();
      if (!isBrowserCompatible) {
        console.warn('[useTwilioDevice] Browser may not be fully compatible with Twilio Voice SDK');
        // Continue anyway but log the warning
      }
      
      // --- Explicitly check/request mic permission upfront --- 
      try {
          console.log('[useTwilioDevice] Attempting getUserMedia for permission prompt...');
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          console.log('[useTwilioDevice] Microphone access successfully granted.');
          
          // Initialize AudioContext after mic permission
          try {
            const audioContextReady = await ensureAudioContext();
            console.log(`[useTwilioDevice] AudioContext status: ${audioContextReady ? 'ready' : 'not ready'}`);
            // Even if audioContextReady is false, we'll continue
          } catch (audioErr) {
            console.error('[useTwilioDevice] Error initializing AudioContext:', audioErr);
            // Continue without AudioContext - audio might not work but device could initialize
          }
      } catch (permErr) {
          console.error('[useTwilioDevice] Microphone permission denied or error:', permErr);
          if (isMounted) {
              const message = permErr instanceof Error ? permErr.message : 'Unknown permission error';
              setError(`Microphone access is required: ${message}`);
              setIsReady(false); 
              setDevice(null);
          }
          return; // Stop initialization
      }
      
      // Proceed with audio and mic ready
      try {
        // Verify API is available before trying to fetch token
        const isApiAvailable = await checkApiAvailability();
        if (!isApiAvailable) {
          console.error('[useTwilioDevice] API health-check failed, API might be unavailable');
          // Continue anyway, let the token fetch handle any errors
        }
        
        console.log('[useTwilioDevice] Fetching Twilio token...');
        let response;
        try {
          response = await fetch('/api/twilio-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
          
          console.log('[useTwilioDevice] Token API response received:', response.status, response.statusText);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch token: ${response.status} ${response.statusText}`);
          }
        } catch (fetchErr) {
          console.error('[useTwilioDevice] Token fetch network error:', fetchErr);
          throw new Error(`Network error while fetching token: ${fetchErr instanceof Error ? fetchErr.message : 'Unknown error'}`);
        }
        
        let data;
        try {
          data = await response.json();
          console.log('[useTwilioDevice] Token response parsed successfully');
        } catch (jsonErr) {
          console.error('[useTwilioDevice] Failed to parse token response as JSON:', jsonErr);
          throw new Error('Invalid response from token service');
        }
        
        if (!data || !data.token) {
          console.error('[useTwilioDevice] Token response missing token:', data);
          throw new Error('No token returned from service');
        }
        
        const token = data.token;
        console.log('[useTwilioDevice] Token fetched successfully.');

        if (!isMounted) {
          console.log('[useTwilioDevice] Component unmounted during initialization, aborting');
          return;
        }

        console.log('[useTwilioDevice] Creating new Twilio Device instance...');
        try {
          // Try with minimal options first
          localDevice = new Device(token, {
            logLevel: 2, // Increasing log level to better debug
          });
          console.log('[useTwilioDevice] Twilio Device instance created successfully');
        } catch (deviceErr) {
          console.error('[useTwilioDevice] Error creating Twilio Device:', deviceErr);
          throw new Error(`Failed to create Twilio Device: ${deviceErr instanceof Error ? deviceErr.message : 'Unknown error'}`);
        }
        
        // Ensure the device has time to initialize
        try {
          console.log('[useTwilioDevice] Registering device...');
          
          // Add a listener for the 'ready' event before registering
          localDevice.on('ready', () => {
            console.log('[useTwilioDevice] Device emitted ready event');
            if (isMounted) {
              setIsReady(true);
              // Clear the timeout since initialization was successful
              if (initializationTimeout) {
                clearTimeout(initializationTimeout);
                initializationTimeout = null;
              }
            }
          });
          
          // Add an error listener
          localDevice.on('error', (err) => {
            console.error('[useTwilioDevice] Device emitted error during initialization:', err);
          });
          
          await localDevice.register();
          console.log('[useTwilioDevice] Device registered successfully.');
        } catch (registerErr) {
          console.error('[useTwilioDevice] Error registering Twilio Device:', registerErr);
          throw new Error(`Failed to register Twilio Device: ${registerErr instanceof Error ? registerErr.message : 'Unknown error'}`);
        }

        if (isMounted) {
          setDevice(localDevice);
          // setIsReady(true); - We're now setting this in the 'ready' event handler
          setError(null);
          console.log('[useTwilioDevice] Device initialization complete, state updated');
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
      
      // Clear the timeout if it exists
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
        initializationTimeout = null;
      }
      
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
      
      // Also clean up AudioContext if it exists
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
          audioContextRef.current = null;
        } catch (err) {
          console.error('[useTwilioDevice] Error closing AudioContext:', err);
        }
      }
    };
  }, [userId, ensureAudioContext, isReady]);

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
        
        // Handle specific error codes
        switch(error.code) {
          case 31000:
            errorMessage = "Twilio Device Error: WebRTC error. Please check browser compatibility.";
            break;
          case 31001:
            errorMessage = "Twilio Device Error: Could not find microphone. Please check your audio settings.";
            break;
          case 31002:
            errorMessage = "Twilio Device Error: Browser does not support microphone access.";
            break;
          case 31003:
            errorMessage = "Twilio Device Error: Permissions error. Please ensure microphone access is granted.";
            break;
          case 31005:
            errorMessage = "Twilio Device Error: Connection to Twilio failed. Please check your internet connection.";
            break;
          case 31009:
            errorMessage = "Twilio Device Error: Token expired. Please refresh the page.";
            break;
          case 31205:
            errorMessage = "Twilio Device Error: Connection failed. Please try again.";
            break;
          // Add more specific error codes as needed
        }
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
    
    // Try to ensure AudioContext is resumed before making call, but continue anyway
    try {
      const audioReady = await ensureAudioContext();
      console.log(`[useTwilioDevice] makeCall: AudioContext ready: ${audioReady}`);
    } catch (err) {
      console.error('[useTwilioDevice] makeCall: AudioContext error:', err);
      // Continue anyway to try to make the call
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
  }, [device, isReady, ensureAudioContext]);

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
  const answerCall = useCallback(async () => {
    if (!call) {
      console.log('[useTwilioDevice] answerCall: No incoming call to answer.');
      return;
    }
    
    // Try to ensure AudioContext is resumed before answering call, but continue anyway
    try {
      const audioReady = await ensureAudioContext();
      console.log(`[useTwilioDevice] answerCall: AudioContext ready: ${audioReady}`);
    } catch (err) {
      console.error('[useTwilioDevice] answerCall: AudioContext error:', err);
      // Continue anyway to try to answer the call
    }
    
    console.log('[useTwilioDevice] answerCall: Accepting incoming call...');
    call.accept();
    // isAccepted/isConnected state change handled by listener on call object
  }, [call, ensureAudioContext]);

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