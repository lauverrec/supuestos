import { useAuth } from '@clerk/react';
import { useMemo } from 'react';
import axios from 'axios';

const API_URL = 'http://184.174.39.148/api';

export function useApi() {
  const { getToken, isSignedIn } = useAuth();
  
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    instance.interceptors.request.use(async (config) => {
      try {
        if (isSignedIn) {
          const token = await getToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
      } catch (e) {
        console.error('Error getting token:', e);
      }
      return config;
    });

    return instance;
  }, [getToken, isSignedIn]);
  
  return api;
}