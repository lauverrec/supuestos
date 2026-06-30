import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Clock, Target } from 'lucide-react';
import Navbar from '../components/Navbar';
import { obtenerHistorial } from '../services/api';

export default function Dashboard() {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerHistorial()
      .then(setHistorial)
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Bienvenida */}
        <div className="bg-policial-azul text-white rounded-2xl p-6 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Panel de estudio</h1>
            <p className="text-blue-200 text-sm">Policía Administrativa — Espectáculos Públicos Andalucía</p>
          </div>
          <Link
            to="/generar"
            className="flex items-center justify-center gap-2 bg-white text-policial-azul font-bold px-5 py-3 rounded-xl hover:bg-blue-50 transition-colors shrink-0"
          >
            <PlusCircle size={18} />
            Nuevo supuesto
          </Link>
        </div>

        {/* Historial */}
        <h2 className="text-lg font-bold text-gray-800 mb-4">Últimos supuestos</h2>

        {cargando ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : historial.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Target size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aún no has hecho ningún supuesto</p>
            <Link to="/generar" className="text-policial-azulMedio text-sm mt-2 inline-block hover:underline">
              Empieza ahora →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {historial.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-shadow"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{s.enunciado}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(s.created_at).toLocaleDateString('es-ES')}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      s.formato === 'desarrollo' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {s.formato}
                    </span>
                    <span className="text-xs text-gray-400">
                      Dificultad {s.dificultad}/3
                    </span>
                  </div>
                </div>
                <Link
                  to={`/correccion/${s.id}`}
                  className="ml-4 text-sm text-policial-azulMedio font-medium hover:underline shrink-0"
                >
                  Ver →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}