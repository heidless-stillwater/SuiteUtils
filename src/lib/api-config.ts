
export const getApiUrl = () => {
  if (import.meta.env.PROD) {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return 'http://localhost:5185';
    }
    // In production, the API is likely served from the same origin or a known subdomain
    return window.location.origin;
  }
  // Local development
  return 'http://localhost:5185';
};

export const API_URL = getApiUrl();
