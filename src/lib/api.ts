/**
 * Helper to get the correct API URL.
 * When running in the browser (standard web app), we use relative paths.
 * When running in Capacitor (Android/iOS), we use the production URL.
 */
export const getApiUrl = (path: string) => {
  // If we are in Capacitor, use the absolute URL from environment
  // Otherwise use relative path
  const isCapacitor = (window as any).Capacitor !== undefined;
  
  if (isCapacitor) {
    const baseUrl = (import.meta as any).env.VITE_APP_URL || '';
    // Remove trailing slash from baseUrl and leading slash from path
    const cleanBase = baseUrl.replace(/\/$/, '');
    const cleanPath = path.replace(/^\//, '');
    return `${cleanBase}/${cleanPath}`;
  }
  
  return path;
};
