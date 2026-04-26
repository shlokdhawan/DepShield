const isProd = import.meta.env.PROD;
export const API_BASE = import.meta.env.VITE_API_BASE_URL || (isProd ? '' : 'http://localhost:5000');
