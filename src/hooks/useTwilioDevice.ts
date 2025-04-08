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
  waitingForMicPermission: boolean;
  makeCall: (to: string) => Promise<void>;
  hangupCall: () => boolean;
  answerCall: () => void;
  rejectCall: () => void;
  requestMicrophonePermission: () => Promise<boolean>;
  reinitializeDevice: () => void;
}

export function useTwilioDevice({ userId }: UseTwilioDeviceProps): UseTwilioDeviceReturn {
  const [device, setDevice] = useState<Device | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForMicPermission, setWaitingForMicPermission] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to request microphone permission
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    // Prevent multiple parallel requests
    if (waitingForMicPermission) {
      console.log('[useTwilioDevice] Already waiting for mic permission');
      return false;
    }
    
    setWaitingForMicPermission(true);
    setError(null);
    
    try {
      console.log('[useTwilioDevice] Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('[useTwilioDevice] Microphone permission granted');
      
      // Update permission state and let the effect handle initialization
      setHasPermission(true);
      
      // Small delay before clearing waiting state to avoid UI flicker
      setTimeout(() => {
        setWaitingForMicPermission(false);
      }, 100);
      
      // If not already ready, reset any previous error
      if (!isReady) {
        console.log('[useTwilioDevice] Will continue with initialization after permission granted');
        setError(null);
      }
      
      return true;
    } catch (err) {
      console.error('[useTwilioDevice] Failed to get microphone permission:', err);
      const message = err instanceof Error ? err.message : 'Unknown permission error';
      setError(`Microphone access is required: ${message}`);
      setHasPermission(false);
      setWaitingForMicPermission(false);
      return false;
    }
  }, [isReady, waitingForMicPermission]);

  // Use a separate flag to track if we should initialize after permission
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Function to safely clean up a device instance
  const cleanupDevice = useCallback((deviceToCleanup: Device | null) => {
    if (!deviceToCleanup) return;
    
    console.log('[useTwilioDevice] Manually cleaning up device instance...');
    try {
      deviceToCleanup.disconnectAll();
      deviceToCleanup.unregister();
      deviceToCleanup.destroy();
      console.log('[useTwilioDevice] Device manually destroyed');
    } catch (err) {
      console.error('[useTwilioDevice] Error during manual device cleanup:', err);
    }
  }, []);
  
  // Function to manually trigger device reinitialization
  const reinitializeDevice = useCallback(() => {
    console.log('[useTwilioDevice] Manually reinitializing device...');
    
    // Clean up existing device if any
    if (device) {
      cleanupDevice(device);
    }
    
    // Reset all states to trigger reinitialization
    setDevice(null);
    setIsReady(false);
    setIsConnecting(false);
    setIsConnected(false);
    setIsAccepted(false);
    setCall(null);
    setError(null);
    
    // If we have permission already, no need to reset it
    // This prevents repeated permission prompts
    if (hasPermission === false) {
      setHasPermission(null);
    }
    
    console.log('[useTwilioDevice] Device state reset, will reinitialize on next render');
  }, [device, hasPermission, cleanupDevice]);

  // Initialize the device
  useEffect(() => {
    console.log('[useTwilioDevice] Initialize Effect Triggered. userId:', userId, 
      'isReady:', isReady, 
      'waitingForMicPermission:', waitingForMicPermission,
      'hasPermission:', hasPermission);
    
    // If already ready with an existing device, skip initialization to avoid destroying active device
    if (isReady && device) {
      console.log('[useTwilioDevice] Device already initialized and ready, skipping re-initialization');
      return;
    }
    
    let isMounted = true;
    let localDevice: Device | null = null; // Keep local reference for cleanup
    
    // Clear any existing timeout
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }

    // Only start the timeout if we're not waiting for microphone permission
    if (!waitingForMicPermission && !isReady) {
      // Set a timeout for initialization, but not for mic permissions
      initTimeoutRef.current = setTimeout(() => {
        if (isMounted && !isReady && !waitingForMicPermission) {
          console.error('[useTwilioDevice] Initialization timed out after 20 seconds');
          setError('Connection timed out. Please refresh and try again.');
        }
      }, 20000); // Extended to 20 seconds
    }

    const initializeDevice = async () => {
      // Early return conditions
      if (!userId) {
        console.log('[useTwilioDevice] No userId, skipping initialization.');
        return;
      }
      
      // Skip initialization if already initialized successfully
      if (isReady) {
        console.log('[useTwilioDevice] Already initialized, skipping.');
        return;
      }
      
      // Skip initialization if already waiting for mic permission
      if (waitingForMicPermission) {
        console.log('[useTwilioDevice] Waiting for mic permission, skipping initialization.');
        return;
      }
      
      // Check if we already have permission from a previous check
      if (hasPermission === true) {
        console.log('[useTwilioDevice] Already has microphone permission, skipping permission check.');
        // Continue with initialization without checking permission again
      } else {
        // Need to check permission
        console.log('[useTwilioDevice] Checking microphone permission...');
        
        try {
          console.log('[useTwilioDevice] Attempting getUserMedia for permission prompt...');
          setWaitingForMicPermission(true);
          
          // Attempt to get microphone access
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // Success - immediately stop tracks we don't need them running
          stream.getTracks().forEach(track => track.stop());
          
          // Mark as successful and update permission state
          setWaitingForMicPermission(false);
          setHasPermission(true);
          console.log('[useTwilioDevice] Microphone access successfully granted.');
          
          // Create AudioContext
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
          setWaitingForMicPermission(false);
          setHasPermission(false);
          
          if (isMounted) {
            const message = permErr instanceof Error ? permErr.message : 'Unknown permission error';
            setError(`Microphone access is required: ${message}`);
          }
          return; // Stop initialization if mic permission denied
        }
      }
      
      // By now we should have permission - proceed with token fetch
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
        // Create device with more familiar options - similar to original working version
        localDevice = new Device(token, {
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          allowIncomingWhileBusy: true,
          // Explicitly enable all audio features
          disableAudioContextSounds: false,
          // We'll use the default sound files by not specifying custom ones
          // Set log level for debugging
          logLevel: 'debug'
        });
        
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
          if (initTimeoutRef.current) {
            clearTimeout(initTimeoutRef.current);
            initTimeoutRef.current = null;
          }
        }
      } catch (err) {
        console.error('[useTwilioDevice] Initialization failed:', err);
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Unknown error during init';
          setError(`Initialization failed: ${message}`);
          // Don't reset waitingForMicPermission here as it might cause permission prompt loops
        }
      }
    };

    // Start the initialization process only if conditions are right
    if (!waitingForMicPermission && !isReady && (hasPermission === true || hasPermission === null)) {
      console.log('[useTwilioDevice] Starting initialization process...');
      initializeDevice();
    } else {
      console.log(`[useTwilioDevice] Skipping initializeDevice call. waitingForMicPermission: ${waitingForMicPermission}, isReady: ${isReady}, hasPermission: ${hasPermission}`);
    }

    // Cleanup Function
    return () => {
      isMounted = false;
      
      // Clear the timeout if it exists
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      
      // IMPORTANT: Do NOT destroy the device in cleanup during normal React lifecycle
      // Only destroy it when the component is unmounting completely
      
      // For React's useEffect cleanup, don't destroy the device at all
      // We'll handle device lifecycle separately
      console.log('[useTwilioDevice] Effect cleanup running - preserving device instance');
    };
  }, [userId, isReady, waitingForMicPermission, hasPermission, device]);

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
      
      // Play connection sound when call is connected
      try {
        // Create or resume AudioContext
        if (!audioContextRef.current) {
          const windowWithAudioContext = window as unknown as AudioContextWindow;
          const AudioContextClass = windowWithAudioContext.AudioContext || windowWithAudioContext.webkitAudioContext;
          audioContextRef.current = new AudioContextClass();
        }
        
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(err => {
            console.warn('[useTwilioDevice] Could not resume AudioContext for connection sound:', err);
            return;
          });
        }
        
        const ctx = audioContextRef.current;
        const now = ctx.currentTime;
        
        // Create master gain node
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(ctx.destination);
        
        // Create a more pleasant connection sound with two tones
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        
        // Configure oscillators
        osc1.type = 'sine'; 
        osc1.frequency.setValueAtTime(880, now); // A5 note
        osc1.frequency.linearRampToValueAtTime(587.33, now + 0.2); // D5 note
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1760, now); // A6 note
        osc2.frequency.linearRampToValueAtTime(1174.66, now + 0.2); // D6 note
        
        // Create individual gain nodes for oscillators
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();
        
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.4, now + 0.1);
        gain1.gain.linearRampToValueAtTime(0, now + 0.7);
        
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.3, now + 0.1);
        gain2.gain.linearRampToValueAtTime(0, now + 0.6);
        
        // Connect nodes
        osc1.connect(gain1);
        osc2.connect(gain2);
        gain1.connect(masterGain);
        gain2.connect(masterGain);
        
        // Start and stop oscillators
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.8);
        osc2.stop(now + 0.7);
        
        // Clean up after sound is finished
        setTimeout(() => {
          try {
            gain1.disconnect();
            gain2.disconnect();
            masterGain.disconnect();
          } catch (err) {
            console.warn('[useTwilioDevice] Error cleaning up connection sound:', err);
          }
        }, 1000);
        
        console.log('[useTwilioDevice] Played connection sound');
      } catch (err) {
        console.warn('[useTwilioDevice] Error playing connection sound:', err);
      }
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
      console.log('[useTwilioDevice] Event: Incoming call - automatically rejecting');
      
      // Automatically reject all incoming calls
      connection.reject();
      
      // Log the rejection
      console.log('[useTwilioDevice] Incoming call automatically rejected');
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
    if (!device) {
      setError('Device not available.');
      console.error('[useTwilioDevice] makeCall: Device not available.');
      return;
    }
    
    if (!isReady) {
      setError('Device not ready.');
      console.error('[useTwilioDevice] makeCall: Device not ready.');
      return;
    }
    
    // Check if device is in a valid state
    let isDeviceValid = true;
    try {
      // This is a simple test to see if the device is still valid
      // If it's been destroyed, this will throw an error
      isDeviceValid = !!device.state;
      if (!isDeviceValid) {
        console.error('[useTwilioDevice] makeCall: Device is in an invalid state or destroyed.');
        setError('Error Initializing Device: Failed to make call: Phone device is no longer valid. Please refresh the page.');
        // Since we know device is invalid, reset it completely
        setDevice(null);
        setIsReady(false);
        return;
      }
    } catch (err) {
      console.error('[useTwilioDevice] makeCall: Device is invalid:', err);
      setError('Error Initializing Device: Failed to make call: Phone device is no longer valid. Please refresh the page.');
      // Since we know device is invalid, reset it completely
      setDevice(null);
      setIsReady(false);
      return;
    }
    
    // Try to ensure audio context is active for the call
    try {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('[useTwilioDevice] Resumed AudioContext for call');
      }
    } catch (err) {
      console.warn('[useTwilioDevice] Could not resume AudioContext, audio may not work:', err);
      // Continue anyway
    }
    
    try {
      console.log(`[useTwilioDevice] makeCall: Initiating call to ${to}`);
      setIsConnecting(true);
      setError(null);
      
      // Fetch a random number from our pool to use as the caller ID
      let callerId;
      try {
        const response = await fetch('/api/twilio-numbers', {
          method: 'POST',
        });
        
        if (response.ok) {
          const data = await response.json();
          callerId = data.phoneNumber;
          console.log(`[useTwilioDevice] Using caller ID from pool: ${callerId}`);
        } else {
          console.warn('[useTwilioDevice] Failed to fetch caller ID from pool, will use default');
        }
      } catch (error) {
        console.warn('[useTwilioDevice] Error fetching caller ID:', error);
        // Continue with default caller ID
      }
      
      // Connect with a params object including the caller ID if available
      const outgoingCall = await device.connect({ 
        params: { 
          To: to,
          ...(callerId && { CallerId: callerId }),
          UserId: userId 
        } 
      });
      
      console.log('[useTwilioDevice] makeCall: Call connected');
      setCall(outgoingCall);
      
      // Explicitly set accepted for outgoing calls
      setIsAccepted(true);
      setIsConnected(true);
      
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
      let message = 'Failed to initiate call';
      
      if (err instanceof Error) {
        message = err.message;
        // Check for device destroyed error
        if (message.includes('destroyed')) {
          message = 'Phone device is no longer valid. Please refresh the page.';
          // Reset device state
          setDevice(null);
          setIsReady(false);
        }
      }
      
      setError(`Failed to make call: ${message}`);
      setIsConnecting(false);
      setCall(null);
    }
  }, [device, isReady, userId]);

  // Hang up the current call
  const hangupCall = useCallback(() => {
    console.log('[useTwilioDevice] hangupCall: Attempting to hang up call...');
    
    // If we have a call object, try to disconnect it
    if (call) {
      try {
        call.disconnect();
        console.log('[useTwilioDevice] hangupCall: Call disconnect initiated');
      } catch (err) {
        console.error('[useTwilioDevice] hangupCall: Error disconnecting call:', err);
      }
    } else if (device) {
      // If we don't have a call but have a device, try disconnecting all calls
      try {
        device.disconnectAll();
        console.log('[useTwilioDevice] hangupCall: Device disconnectAll initiated');
      } catch (err) {
        console.error('[useTwilioDevice] hangupCall: Error disconnecting all calls:', err);
      }
    }
    
    // Always reset states regardless of whether we had a call object
    // This ensures the UI is updated even if call state tracking was lost
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
    
    // Try to ensure audio context is active for the call
    try {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('[useTwilioDevice] Resumed AudioContext for incoming call');
      }
    } catch (err) {
      console.warn('[useTwilioDevice] Could not resume AudioContext for incoming call:', err);
      // Continue anyway
    }
    
    console.log('[useTwilioDevice] answerCall: Accepting incoming call...');
    try {
      call.accept();
      // States will be set by event listeners on the call
    } catch (err) {
      console.error('[useTwilioDevice] Error accepting call:', err);
      setError('Failed to accept call');
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
    waitingForMicPermission,
    makeCall,
    hangupCall,
    answerCall,
    rejectCall,
    requestMicrophonePermission,
    reinitializeDevice,
  };
} 