import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Target, PlusCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import { obtenerHistorial } from '../services/api';

export default function MiProgreso() {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerHistorial()
      .then(setHistorial)
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  const totalSupuestos = historial.length;

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
              valor: totalSupuestos,
              icon: Target,
              color: 'text-policial-azul',
              bg: 'bg-policial-azulClaro'
            },
            {
              label: 'Esta semana',
              valor: historial.filter(s => {
                const fecha = new Date(s.created_at);
                const semana = new Date();
                semana.setDate(semana.getDate() - 7);
                return fecha > semana;
              }).length,
              icon: TrendingUp,
              color: 'text-green-600',
              bg: 'bg-green-50'
            },
            {
              label: 'Materia activa',
              valor: 'Pol. Admin.',
              icon: Target,
              color: 'text-policial-azulMedio',
              bg: 'bg-blue-50'
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

        {/* Historial completo */}
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
                  <p className="text-sm text-gray-600 flex-1 truncate">{s.enunciado}</p>
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