import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Target, PlusCircle, BookOpen, Star } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useApi } from '../hooks/useApi';
import { obtenerHistorial } from '../services/api';

export default function MiProgreso() {
  const api = useApi();
  const [progreso, setProgreso] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/usuarios/progreso'),
      obtenerHistorial()
    ])
      .then(([pRes, h]) => {
        setProgreso(pRes.data);
        setHistorial(h);
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">

        <h1 className="text-2xl font-bold text-policial-azul mb-8">Mi progreso</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            {
              label: 'Supuestos realizados',
              valor: progreso?.total_supuestos ?? '—',
              icon: Target,
              color: 'text-policial-azul',
              bg: 'bg-policial-azulClaro'
            },
            {
              label: 'Esta semana',
              valor: progreso?.esta_semana ?? '—',
              icon: TrendingUp,
              color: 'text-green-600',
              bg: 'bg-green-50'
            },
            {
              label: 'Puntuación media',
              valor: progreso?.puntuacion_media ? `${progreso.puntuacion_media}/10` : '—',
              icon: Star,
              color: 'text-yellow-500',
              bg: 'bg-yellow-50'
            },
          ].map(({ label, valor, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className={`inline-flex p-3 rounded-xl ${bg} mb-3`}>
                <Icon size={20} className={color} />
              </div>
              <p className="text-2xl font-bold text-gray-800">{valor}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Por materia */}
        {progreso?.por_materia?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-policial-azul" />
              Por materia
            </h2>
            <div className="space-y-3">
              {progreso.por_materia.map((m) => (
                <div key={m.materia} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{m.materia}</span>
                      <span className="text-xs text-gray-400">{m.total} supuestos</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-policial-azul h-2 rounded-full"
                        style={{ width: `${Math.min((m.total / (progreso.total_supuestos || 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  {m.media && (
                    <span className={`ml-4 text-sm font-bold ${m.media >= 7 ? 'text-green-600' :
                        m.media >= 5 ? 'text-yellow-600' :
                          'text-red-600'
                      }`}>
                      {m.media}/10
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evolución */}
        {progreso?.evolucion?.length > 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-policial-azul" />
              Evolución de puntuaciones
            </h2>
            <div className="flex items-end gap-2 h-24">
              {progreso.evolucion.map((e, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-lg ${e.puntuacion >= 7 ? 'bg-green-400' :
                        e.puntuacion >= 5 ? 'bg-yellow-400' :
                          'bg-red-400'
                      }`}
                    style={{ height: `${(e.puntuacion / 10) * 80}px` }}
                  />
                  <span className="text-xs text-gray-400">{e.puntuacion.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Historial */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-gray-800">Historial completo</h2>
            <Link
              to="/generar"
              className="flex items-center gap-2 bg-policial-azul text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-policial-azulMedio transition-colors"
            >
              <PlusCircle size={14} />
              Nuevo
            </Link>
          </div>

          {cargando ? (
            <div className="text-center py-8 text-gray-400">Cargando...</div>
          ) : historial.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-3">Aún no has realizado ningún supuesto</p>
              <Link to="/generar" className="text-policial-azulMedio text-sm hover:underline">
                Empieza ahora →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {historial.map((s, i) => (
                <div key={s.id} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-400 w-6 text-right shrink-0">{i + 1}</span>
                  <p className="text-sm text-gray-600 flex-1 line-clamp-1">{s.enunciado}</p>
                  {s.puntuacion && (
                    <span className={`text-xs font-bold shrink-0 ${s.puntuacion >= 7 ? 'text-green-600' :
                        s.puntuacion >= 5 ? 'text-yellow-600' :
                          'text-red-600'
                      }`}>
                      {s.puntuacion.toFixed(1)}/10
                    </span>
                  )}
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(s.created_at).toLocaleDateString('es-ES')}
                  </span>
                  <Link
                    to={`/correccion/${s.id}`}
                    className="text-xs text-policial-azulMedio hover:underline shrink-0"
                  >
                    Ver →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}