import axios from 'axios';

const API_URL = 'http://184.174.39.148/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// SUPUESTOS
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