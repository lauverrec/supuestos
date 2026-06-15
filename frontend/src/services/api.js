import axios from 'axios';
import { getAuthToken } from './tokenStore';

const API_URL = 'http://184.174.39.148/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.error('Error getting token:', e);
  }
  return config;
});

export const generarSupuesto = async (materiaId, dificultad = 2, formato = 'desarrollo') => {
  const response = await api.post('/supuestos/generar', {
    materia_id: materiaId,
    dificultad,
    formato,
  });
  return response.data;
};

export const responderSupuesto = async (supuestoId, respuestaTexto, tiempoRespuesta = 0) => {
  const response = await api.post('/supuestos/responder', {
    supuesto_id: supuestoId,
    respuesta_texto: respuestaTexto,
    tiempo_respuesta: tiempoRespuesta,
  });
  return response.data;
};

export const obtenerHistorial = async () => {
  const response = await api.get('/supuestos/historial');
  return response.data;
};

export default api;