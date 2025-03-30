import React, { useEffect, useState } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive }) => {
  const [iteration, setIteration] = useState(0);
  
  // Use a simple animation timer instead of real audio analysis
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (isActive) {
      // Create a pulsing effect with interval
      intervalId = setInterval(() => {
        setIteration(prev => (prev + 1) % 20); // Cycle through 0-19 for animation
      }, 150);
    }
    
    // Clean up
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isActive]);

  // Create a simulated audio visualization pattern based on iteration
  const generateBarHeight = (barIndex: number): number => {
    if (!isActive) return 5; // Minimum height when inactive
    
    // Create a sine wave pattern based on the current iteration
    const baseHeight = 20 + Math.sin(((iteration + barIndex) % 10) / 3 * Math.PI) * 30;
    
    // Add variation based on bar position
    const positionVariation = 10 - Math.abs(barIndex - 5) * 2;
    
    return Math.max(5, Math.min(80, baseHeight + positionVariation));
  };

  // Generate the bars for the visualizer
  const bars = Array.from({ length: 10 }, (_, i) => {
    const barHeight = generateBarHeight(i);
    
    return (
      <div 
        key={i}
        className="w-1 bg-blue-400 rounded-full mx-px transition-all duration-75"
        style={{ 
          height: `${barHeight}%`,
          opacity: isActive ? ((barHeight / 100) + 0.2) : 0.2
        }}
      />
    );
  });

  return (
    <div className="h-16 flex items-end justify-center">
      {bars}
    </div>
  );
};

export default AudioVisualizer; 