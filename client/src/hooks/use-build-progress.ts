import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface BuildProgress {
  step: string;
  progress: number;
  message: string;
}

export interface BuildResult {
  buildId: string;
  success: boolean;
  apkPath?: string;
  aabPath?: string;
  error?: string;
}

export function useBuildProgress(buildId: string | null) {
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [result, setResult] = useState<BuildResult | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!buildId) return;

    const newSocket = io();
    setSocket(newSocket);

    // Join the build room
    newSocket.emit('join-build', buildId);

    // Listen for progress updates
    newSocket.on('build-progress', (data: BuildProgress & { buildId: string }) => {
      if (data.buildId === buildId) {
        setProgress(data);
      }
    });

    // Listen for completion
    newSocket.on('build-complete', (data: BuildResult) => {
      if (data.buildId === buildId) {
        setResult(data);
        setIsComplete(true);
        setProgress({
          step: data.success ? 'complete' : 'error',
          progress: data.success ? 100 : 0,
          message: data.success ? 'Build completed successfully!' : (data.error || 'Build failed')
        });
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [buildId]);

  return {
    progress,
    isComplete,
    result,
    socket
  };
}