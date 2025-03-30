import React, { useState, useEffect, useRef } from 'react';

interface CallTimerProps {
  startTime: number | null;
  isActive: boolean;
}

const CallTimer: React.FC<CallTimerProps> = ({ startTime, isActive }) => {
  const [elapsed, setElapsed] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // For debugging
  useEffect(() => {
    console.log(`[CallTimer] Props updated: startTime=${startTime}, isActive=${isActive}`);
  }, [startTime, isActive]);

  useEffect(() => {
    // Always clean up any existing interval first to prevent multiple intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Only start timer if we have both requirements: startTime and isActive
    if (startTime && isActive) {
      console.log(`[CallTimer] Starting timer with startTime: ${startTime}, current time: ${Date.now()}`);
      
      // Calculate initial elapsed time
      const initialElapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(initialElapsed);
      console.log(`[CallTimer] Initial elapsed time: ${initialElapsed} seconds`);
      
      // Start interval to update elapsed time every second
      intervalRef.current = setInterval(() => {
        if (startTime) { // Double-check startTime still exists
          const newElapsed = Math.floor((Date.now() - startTime) / 1000);
          setElapsed(newElapsed);
        }
      }, 1000);
      
      console.log(`[CallTimer] Timer interval started with ID: ${intervalRef.current}`);
    } else {
      // Reset to 0 when call is not active or no start time
      console.log('[CallTimer] Timer inactive, resetting to 00:00');
      setElapsed(0);
    }
    
    // Cleanup function to clear interval when component unmounts or dependencies change
    return () => {
      if (intervalRef.current) {
        console.log(`[CallTimer] Clearing interval ${intervalRef.current}`);
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startTime, isActive]); // Only re-run effect when these values change

  // Format seconds into MM:SS
  const formatTime = (seconds: number): string => {
    if (seconds < 0) seconds = 0;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calculate what to display
  const displayTime = isActive && startTime ? formatTime(elapsed) : '00:00';

  return (
    <div className="font-mono text-lg">
      {displayTime}
    </div>
  );
};

export default CallTimer; 