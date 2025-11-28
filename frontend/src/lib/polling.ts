// Polling utility to replace WebSocket connections
// Use this for real-time updates in serverless environments

export interface PollingOptions {
  interval?: number; // Polling interval in milliseconds (default: 2000)
  maxAttempts?: number; // Maximum polling attempts (default: 150 = 5 minutes)
  onUpdate?: (data: any) => void;
  onComplete?: (data: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Poll an endpoint for updates
 * Useful for replacing WebSocket connections in serverless environments
 */
export function pollEndpoint(
  url: string,
  options: PollingOptions = {}
): () => void {
  const {
    interval = 2000,
    maxAttempts = 150,
    onUpdate,
    onComplete,
    onError,
  } = options;

  let attempts = 0;
  let cancelled = false;

  const poll = async () => {
    if (cancelled) return;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if complete
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        if (onComplete) {
          onComplete(data);
        }
        return; // Stop polling
      }

      // Call update handler
      if (onUpdate) {
        onUpdate(data);
      }

      // Continue polling
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, interval);
      } else {
        if (onError) {
          onError(new Error('Polling timeout: Maximum attempts reached'));
        }
      }
    } catch (error: any) {
      if (onError) {
        onError(error);
      }
    }
  };

  // Start polling
  poll();

  // Return cancel function
  return () => {
    cancelled = true;
  };
}

/**
 * Poll execution status
 */
export function pollExecutionStatus(
  executionId: string,
  options: PollingOptions = {}
): () => void {
  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
  return pollEndpoint(`${apiUrl}/api/poll/execution-status?executionId=${executionId}`, options);
}

