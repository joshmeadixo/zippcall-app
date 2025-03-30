import React, { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive }) => {
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Set up audio analyzer
  useEffect(() => {
    if (!isActive) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      return;
    }

    let stream: MediaStream | null = null;

    const setupAudioAnalyzer = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
        // Create audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        // Create analyser
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        // Create buffer for analyser data
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        dataArrayRef.current = dataArray;
        
        // Create source from microphone stream
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;
        
        // Start animation loop
        animationLoop();
      } catch (error) {
        console.error('Error setting up audio analyzer:', error);
      }
    };

    // Animation loop to update audio levels
    const animationLoop = () => {
      if (!analyserRef.current || !dataArrayRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      // Calculate average volume level
      let sum = 0;
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        sum += dataArrayRef.current[i];
      }
      const avg = sum / dataArrayRef.current.length;
      
      // Normalize to 0-100 range
      const normalizedLevel = Math.min(100, Math.max(0, avg * 1.5));
      setAudioLevel(normalizedLevel);
      
      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    };

    setupAudioAnalyzer();

    // Clean up
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive]);

  // Generate the bars for the visualizer
  const bars = Array.from({ length: 10 }, (_, i) => {
    const barHeight = Math.min(100, Math.max(5, audioLevel - (i * 10)));
    return (
      <div 
        key={i}
        className="w-1 bg-blue-400 rounded-full mx-px transition-all duration-75"
        style={{ 
          height: `${isActive ? barHeight : 5}%`,
          opacity: isActive ? (barHeight / 100) : 0.2
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