
export const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:5180';
};

export const API_URL = getApiUrl();
