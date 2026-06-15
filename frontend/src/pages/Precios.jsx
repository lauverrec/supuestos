import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Shield } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useApi } from '../hooks/useApi';
import { useState } from 'react';

const planes = [
  {
    id: null,
    nombre: 'Gratuito',
    precio: '0€',
    periodo: '',
    descripcion: 'Para probar la plataforma',
    caracteristicas: [
      '3 supuestos prácticos',
      'Corrección automática',
      'Solución modelo',
      'Todos los niveles de dificultad',
    ],
    cta: 'Tu plan actual',
    destacado: false,
    disabled: true,
  },
  {
    id: 'mensual',
    nombre: 'Mensual',
    precio: '14,99€',
    periodo: '/mes',
    descripcion: 'Acceso ilimitado mes a mes',
    caracteristicas: [
      'Supuestos ilimitados',
      'Corrección automática',
      'Solución modelo',
      'Todos los niveles de dificultad',
      'Todas las materias',
      'Historial completo',
    ],
    cta: 'Empezar ahora',
    destacado: true,
    disabled: false,
  },
  {
    id: 'anual',
    nombre: 'Anual',
    precio: '149€',
    periodo: '/año',
    descripcion: 'Ahorra 2 meses',
    caracteristicas: [
      'Supuestos ilimitados',
      'Corrección automática',
      'Solución modelo',
      'Todos los niveles de dificultad',
      'Todas las materias',
      'Historial completo',
      '2 meses gratis vs mensual',
    ],
    cta: 'Empezar ahora',
    destacado: false,
    disabled: false,
  },
];

export default function Precios() {
  const api = useApi();
  const [cargando, setCargando] = useState(null);
  const [searchParams] = useSearchParams();
  const pagoOk = searchParams.get('pago') === 'ok';

  const handlePago = async (planId) => {
    setCargando(planId);
    try {
      const res = await api.post('/stripe/crear-sesion', { plan: planId });
      window.location.href = res.data.url;
    } catch (e) {
      alert('Error iniciando el pago. Inténtalo de nuevo.');
    } finally {
      setCargando(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-16">

        {pagoOk && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl p-4 mb-8 text-center font-medium">
            ✅ ¡Pago completado! Ya tienes acceso ilimitado.
          </div>
        )}

        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-policial-azul mb-3">Planes y precios</h1>
          <p className="text-gray-500">Empieza gratis y desbloquea el acceso ilimitado cuando estés listo.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planes.map((plan) => (
            <div
              key={plan.nombre}
              className={`bg-white rounded-2xl border shadow-sm p-8 flex flex-col ${
                plan.destacado
                  ? 'border-policial-azul shadow-lg scale-105'
                  : 'border-gray-100'
              }`}
            >
              {plan.destacado && (
                <span className="text-xs font-bold text-policial-azul bg-policial-azulClaro px-3 py-1 rounded-full self-start mb-4">
                  Más popular
                </span>
              )}

              <h2 className="text-xl font-bold text-gray-800 mb-1">{plan.nombre}</h2>
              <p className="text-gray-400 text-sm mb-4">{plan.descripcion}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-policial-azul">{plan.precio}</span>
                <span className="text-gray-400 text-sm">{plan.periodo}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.caracteristicas.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-green-500 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>

              <button
                disabled={plan.disabled || cargando === plan.id}
                onClick={() => plan.id && handlePago(plan.id)}
                className={`w-full font-bold py-3 rounded-xl transition-colors ${
                  plan.disabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : plan.destacado
                    ? 'bg-policial-azul text-white hover:bg-policial-azulMedio'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                }`}
              >
                {cargando === plan.id ? 'Redirigiendo...' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mt-12 text-sm text-gray-400">
          <Shield size={16} className="inline mr-1" />
          Pago seguro · Cancela cuando quieras · Sin permanencia
        </div>

      </div>
    </div>
  );
}