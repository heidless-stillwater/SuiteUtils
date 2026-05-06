
export const getApiUrl = () => {
  if (import.meta.env.PROD) {
    // In production, the API is likely served from the same origin or a known subdomain
    return window.location.origin;
  }
  // Local development
  return 'http://localhost:5185';
};

export const API_URL = getApiUrl();
