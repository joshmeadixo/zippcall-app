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
  hangupCall: () => boolean;
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

  // Audio unlock function - must be called on a user interaction event
  const unlockAudio = useCallback(async () => {
    console.log('[useTwilioDevice] Attempting to unlock audio...');
    
    try {
      // Create AudioContext if it doesn't exist
      if (!audioContextRef.current) {
        const windowWithAudioContext = window as unknown as AudioContextWindow;
        const AudioContextClass = windowWithAudioContext.AudioContext || windowWithAudioContext.webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
        console.log('[useTwilioDevice] Created new AudioContext');
      }
      
      // Resume AudioContext if it's suspended
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('[useTwilioDevice] Resumed AudioContext, state:', audioContextRef.current.state);
      }
      
      // Create and play a silent sound to unlock audio on iOS
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0.01; // Nearly silent
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      oscillator.start(0);
      oscillator.stop(0.1); // Very short duration
      
      return true;
    } catch (err) {
      console.error('[useTwilioDevice] Error unlocking audio:', err);
      return false;
    }
  }, []);
  
  // Force audio unlock on page load
  useEffect(() => {
    // Add this inline event listener to unlock audio on first interaction
    const handleFirstInteraction = async () => {
      await unlockAudio();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
    
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [unlockAudio]);

  // Initialize the device
  useEffect(() => {
    console.log('[useTwilioDevice] Initialize Effect Triggered. userId:', userId);
    let isMounted = true;
    let localDevice: Device | null = null; // Keep local reference for cleanup
    let initializationTimeout: NodeJS.Timeout | null = null;

    // Set a timeout for initialization
    initializationTimeout = setTimeout(() => {
      if (isMounted && !isReady) {
        console.error('[useTwilioDevice] Initialization timed out after 15 seconds');
        setError('Connection timed out. Please refresh and try again.');
      }
    }, 15000);

    const initializeDevice = async () => {
      if (!userId) {
        console.log('[useTwilioDevice] No userId, skipping initialization.');
        return;
      }
      
      // --- Explicitly check/request mic permission upfront --- 
      try {
          console.log('[useTwilioDevice] Attempting getUserMedia for permission prompt...');
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          console.log('[useTwilioDevice] Microphone access successfully granted.');
          
          // Create AudioContext - but don't await or make it block our flow
          try {
            if (!audioContextRef.current) {
              const windowWithAudioContext = window as unknown as AudioContextWindow;
              const AudioContextClass = windowWithAudioContext.AudioContext || windowWithAudioContext.webkitAudioContext;
              audioContextRef.current = new AudioContextClass();
            }
          } catch (audioErr) {
            console.warn('[useTwilioDevice] AudioContext creation failed, audio may not work:', audioErr);
            // Continue anyway
          }
      } catch (permErr) {
          console.error('[useTwilioDevice] Microphone permission denied or error:', permErr);
          if (isMounted) {
              const message = permErr instanceof Error ? permErr.message : 'Unknown permission error';
              setError(`Microphone access is required: ${message}`);
          }
          return; // Stop initialization
      }
      
      // Proceed with token fetch and device creation
      try {
        console.log('[useTwilioDevice] Fetching Twilio token...');
        const response = await fetch('/api/twilio-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
          
        if (!response.ok) {
          throw new Error(`Failed to fetch token: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.token) {
          throw new Error('No token returned from service');
        }
        
        const token = data.token;
        console.log('[useTwilioDevice] Token fetched successfully.');

        if (!isMounted) return;

        console.log('[useTwilioDevice] Creating Twilio Device with token...');
        // Create device with options specifically focused on audio
        localDevice = new Device(token, {
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          allowIncomingWhileBusy: true,
          // AudioContext handling - explicitly enable sounds
          disableAudioContextSounds: false,
          // Increase log level for debugging
          logLevel: 'debug'
        });
        
        // Try unlocking audio immediately after device creation
        await unlockAudio();
        
        // First add event listeners
        localDevice.on('error', (err) => {
          console.error('[useTwilioDevice] Device error:', err);
          if (isMounted) {
            setError(`Device error: ${err.message || 'Unknown error'}`);
          }
        });
        
        // Register the device - this returns a promise
        console.log('[useTwilioDevice] Registering device...');
        await localDevice.register();
        
        // If we get here, the device is successfully registered
        console.log('[useTwilioDevice] Device registered successfully');
        
        if (isMounted) {
          setDevice(localDevice);
          setIsReady(true);
          setError(null);
          
          // Clear the timeout
          if (initializationTimeout) {
            clearTimeout(initializationTimeout);
            initializationTimeout = null;
          }
        }
      } catch (err) {
        console.error('[useTwilioDevice] Initialization failed:', err);
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Unknown error during init';
          setError(`Initialization failed: ${message}`);
        }
      }
    };

    // Start the initialization process
    initializeDevice();

    // Cleanup Function
    return () => {
      isMounted = false;
      
      // Clear the timeout if it exists
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
      }
      
      console.log('[useTwilioDevice] Cleanup: Destroying device instance...');
      if (localDevice) {
        try {
          localDevice.disconnectAll(); 
          localDevice.unregister();   
          localDevice.destroy();      
          console.log('[useTwilioDevice] Cleanup: Device destroyed.');
        } catch (err) {
          console.error('[useTwilioDevice] Error during cleanup:', err);
        }
      }
      
      // Clean up AudioContext
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
          audioContextRef.current = null;
        } catch (err) {
          console.error('[useTwilioDevice] Error closing AudioContext:', err);
        }
      }
    };
  }, [userId, isReady, unlockAudio]);

  // Register listeners for device state changes
  useEffect(() => {
    if (!device || !isReady) return; // Only register if device is set and ready

    console.log('[useTwilioDevice] Attaching listeners to device...');

    // Define Handlers with debouncing to prevent rapid state changes
    const handleReady = () => {
      console.log('[useTwilioDevice] Event: Device Ready');
    };

    const handleConnect = (connection: Call) => {
      console.log('[useTwilioDevice] Event: Call connected', connection);
      // Set states in one batch to reduce renders
      setIsConnecting(false);
      setIsConnected(true);
      setCall(connection);
    };

    const handleDisconnect = () => {
      console.log('[useTwilioDevice] Event: Call disconnected');
      // Delay state reset slightly to avoid UI flickering
      setTimeout(() => {
        // Set states in one batch to reduce renders
        setIsConnecting(false);
        setIsConnected(false);
        setIsAccepted(false);
        setCall(null);
        setError(null);
      }, 100);
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
  }, [device, isReady, unlockAudio]); // Re-run ONLY if device instance or isReady state changes

  // Make an outgoing call
  const makeCall = useCallback(async (to: string) => {
    if (!device || !isReady) {
      setError('Device not ready.');
      console.error('[useTwilioDevice] makeCall: Device not ready.');
      return;
    }
    
    // Force unlock audio before call
    try {
      const audioUnlocked = await unlockAudio();
      console.log('[useTwilioDevice] Audio unlocked before call:', audioUnlocked);
    } catch (err) {
      console.warn('[useTwilioDevice] Error unlocking audio:', err);
      // Continue anyway
    }
    
    try {
      console.log(`[useTwilioDevice] makeCall: Initiating call to ${to}`);
      setIsConnecting(true);
      setError(null);
      
      // Connect with a simple params object
      const outgoingCall = await device.connect({ 
        params: { To: to } 
      });
      
      console.log('[useTwilioDevice] makeCall: Call connected');
      setCall(outgoingCall);
      setIsAccepted(true);
      
      // Attach disconnect listener to handle cleanup
      outgoingCall.on('disconnect', () => {
        console.log('[useTwilioDevice] Call disconnected');
        setCall(null);
        setIsConnected(false);
        setIsConnecting(false);
        setIsAccepted(false);
      });
    } catch (err) {
      console.error('[useTwilioDevice] makeCall: Error:', err);
      const message = err instanceof Error ? err.message : 'Failed to initiate call';
      setError(`Failed to make call: ${message}`);
      setIsConnecting(false);
      setCall(null);
    }
  }, [device, isReady, unlockAudio]);

  // Hang up the current call
  const hangupCall = useCallback(() => {
    console.log('[useTwilioDevice] hangupCall: Attempting to hang up call...');
    
    try {
      // Always try device.disconnectAll() first - this is more reliable
      if (device) {
        device.disconnectAll();
        console.log('[useTwilioDevice] hangupCall: Device disconnectAll called');
      }
      
      // Also try call.disconnect as a backup if we have a call object
      if (call) {
        try {
          call.disconnect();
          console.log('[useTwilioDevice] hangupCall: Call disconnect also called');
        } catch (err) {
          console.error('[useTwilioDevice] hangupCall: Error disconnecting call:', err);
        }
      }
    } catch (err) {
      console.error('[useTwilioDevice] hangupCall: Error disconnecting all calls:', err);
    }
    
    // Always reset states regardless of whether we had a call object
    console.log('[useTwilioDevice] hangupCall: Resetting all call states');
    setIsConnecting(false);
    setIsConnected(false);
    setIsAccepted(false);
    setCall(null);
    setError(null);
    
    return true; // Return success to caller
  }, [call, device]);

  // Answer an incoming call
  const answerCall = useCallback(async () => {
    if (!call) {
      console.log('[useTwilioDevice] answerCall: No incoming call to answer.');
      return;
    }
    
    // Force unlock audio before accepting call
    try {
      const audioUnlocked = await unlockAudio();
      console.log('[useTwilioDevice] Audio unlocked before accepting call:', audioUnlocked);
    } catch (err) {
      console.warn('[useTwilioDevice] Could not unlock audio for incoming call:', err);
      // Continue anyway
    }
    
    console.log('[useTwilioDevice] answerCall: Accepting incoming call...');
    try {
      call.accept();
      console.log('[useTwilioDevice] answerCall: Call accepted');
      
      // Manually set states in case events don't fire
      setIsConnected(true);
      setIsAccepted(true);
    } catch (err) {
      console.error('[useTwilioDevice] Error accepting call:', err);
      setError('Failed to accept call');
      
      // Reset states on error
      setCall(null);
      setIsConnected(false);
      setIsAccepted(false);
    }
  }, [call, unlockAudio]);

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