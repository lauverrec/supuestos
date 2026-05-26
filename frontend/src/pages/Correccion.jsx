import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, AlertCircle, BookOpen, PlusCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../services/api';

export default function Correccion() {
  const { supuestoId } = useParams();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/supuestos/${supuestoId}`)
      .then(r => setDatos(r.data))
      .catch(() => setError('No se encontró la corrección'))
      .finally(() => setCargando(false));
  }, [supuestoId]);

  if (cargando) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center h-64 text-gray-400">Cargando corrección...</div>
    </div>
  );

  if (error || !datos?.feedback) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500 mb-4">No hay corrección disponible para este supuesto.</p>
        <Link to="/generar" className="text-policial-azulMedio hover:underline">
          Generar nuevo supuesto →
        </Link>
      </div>
    </div>
  );

  const { feedback, puntuacion } = datos;

  const colorPuntuacion = puntuacion >= 7 
    ? 'text-green-600' 
    : puntuacion >= 5 
    ? 'text-yellow-600' 
    : 'text-red-600';

  const bgPuntuacion = puntuacion >= 7
    ? 'bg-green-50 border-green-200'
    : puntuacion >= 5
    ? 'bg-yellow-50 border-yellow-200'
    : 'bg-red-50 border-red-200';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Puntuación */}
        <div className={`rounded-2xl border p-6 ${bgPuntuacion}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Puntuación obtenida</p>
              <p className={`text-5xl font-bold ${colorPuntuacion}`}>
                {puntuacion?.toFixed(1)}<span className="text-2xl text-gray-400">/10</span>
              </p>
            </div>
            <div className="text-right">
              <Link
                to="/generar"
                className="flex items-center gap-2 bg-policial-azul text-white font-bold px-5 py-3 rounded-xl hover:bg-policial-azulMedio transition-colors text-sm"
              >
                <PlusCircle size={16} />
                Nuevo supuesto
              </Link>
            </div>
          </div>
          {feedback.resumen && (
            <p className="text-gray-700 text-sm mt-4 leading-relaxed border-t border-gray-200 pt-4">
              {feedback.resumen}
            </p>
          )}
        </div>

        {/* Infracciones correctas */}
        {feedback.infracciones_correctas?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
              <CheckCircle size={18} className="text-green-500" />
              Infracciones correctas
            </h2>
            <div className="space-y-3">
              {feedback.infracciones_correctas.map((item, i) => (
                <div key={i} className="bg-green-50 rounded-xl p-4">
                  <p className="font-medium text-green-800 text-sm">{item.infraccion}</p>
                  {item.observacion && (
                    <p className="text-green-700 text-xs mt-1">{item.observacion}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Infracciones omitidas */}
        {feedback.infracciones_omitidas?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
              <AlertCircle size={18} className="text-yellow-500" />
              Infracciones omitidas
            </h2>
            <div className="space-y-3">
              {feedback.infracciones_omitidas.map((item, i) => (
                <div key={i} className="bg-yellow-50 rounded-xl p-4">
                  <p className="font-medium text-yellow-800 text-sm">{item.infraccion}</p>
                  <div className="mt-2 space-y-1">
                    {item.precepto_correcto && (
                      <p className="text-xs text-yellow-700">
                        <span className="font-semibold">Precepto:</span> {item.precepto_correcto}
                      </p>
                    )}
                    {item.sancion_correcta && (
                      <p className="text-xs text-yellow-700">
                        <span className="font-semibold">Sanción:</span> {item.sancion_correcta}
                      </p>
                    )}
                    {item.organo_correcto && (
                      <p className="text-xs text-yellow-700">
                        <span className="font-semibold">Órgano:</span> {item.organo_correcto}
                      </p>
                    )}
                    {item.explicacion && (
                      <p className="text-xs text-yellow-600 mt-2 italic">{item.explicacion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errores */}
        {feedback.infracciones_erroneas?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
              <XCircle size={18} className="text-red-500" />
              Infracciones erróneas
            </h2>
            <div className="space-y-3">
              {feedback.infracciones_erroneas.map((item, i) => (
                <div key={i} className="bg-red-50 rounded-xl p-4">
                  <p className="text-xs text-red-600">
                    <span className="font-semibold">Dijiste:</span> {item.lo_que_dijo}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    <span className="font-semibold">Correcto:</span> {item.lo_correcto}
                  </p>
                  {item.explicacion && (
                    <p className="text-xs text-red-600 mt-2 italic">{item.explicacion}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actuación policial */}
        {feedback.actuacion_policial && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
              {feedback.actuacion_policial.correcta
                ? <CheckCircle size={18} className="text-green-500" />
                : <XCircle size={18} className="text-red-500" />
              }
              Actuación policial
            </h2>
            <p className="text-sm text-gray-600">{feedback.actuacion_policial.observaciones}</p>
          </div>
        )}

        {/* Puntos fuertes y débiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {feedback.puntos_fuertes?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-bold text-gray-800 mb-3 text-sm">💪 Puntos fuertes</h2>
              <ul className="space-y-2">
                {feedback.puntos_fuertes.map((p, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-green-500 shrink-0">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {feedback.puntos_debiles?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-bold text-gray-800 mb-3 text-sm">⚠️ Puntos débiles</h2>
              <ul className="space-y-2">
                {feedback.puntos_debiles.map((p, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-yellow-500 shrink-0">!</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Consejo de estudio */}
        {feedback.consejo_estudio && (
          <div className="bg-policial-azulClaro border border-policial-azulMedio rounded-2xl p-6">
            <h2 className="font-bold text-policial-azul flex items-center gap-2 mb-3">
              <BookOpen size={18} />
              Consejo de estudio
            </h2>
            <p className="text-sm text-policial-azul leading-relaxed">{feedback.consejo_estudio}</p>
          </div>
        )}

      </div>
    </div>
  );
}