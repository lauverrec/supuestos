import { useUser } from '@clerk/react';
import { Link } from 'react-router-dom';
import { User, Mail, CreditCard, ArrowLeft } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';

export default function Perfil() {
  const { user } = useUser();
  const api = useApi();
  const [usuarioDB, setUsuarioDB] = useState(null);

  useEffect(() => {
    api.get('/usuarios/perfil')
      .then(r => setUsuarioDB(r.data))
      .catch(console.error);
  }, []);

  const plan = usuarioDB?.plan || 'free';
  const suscripcionActiva = usuarioDB?.suscripcion_activa || false;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-policial-azul">Mi perfil</h1>
        </div>

        {/* Datos personales */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-800 mb-4">Datos personales</h2>

          <div className="flex items-center gap-3">
            <User size={18} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Nombre</p>
              <p className="text-sm font-medium text-gray-800">
                {user?.fullName || user?.firstName || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Mail size={18} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Email</p>
              <p className="text-sm font-medium text-gray-800">
                {user?.primaryEmailAddress?.emailAddress || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Plan actual */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-800 mb-4">Plan actual</h2>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard size={18} className="text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Suscripción</p>
                <p className="text-sm font-medium text-gray-800 capitalize">
                  {plan === 'pro' ? 'Pro — Acceso ilimitado' : 'Gratuito — 3 supuestos'}
                </p>
              </div>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              plan === 'pro'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {plan === 'pro' ? 'Activo' : 'Free'}
            </span>
          </div>

          {plan !== 'pro' && (
            <div className="mt-4 pt-4 border-t border-gray-50">
              <Link
                to="/precios"
                className="block text-center bg-policial-azul text-white font-bold py-3 rounded-xl hover:bg-policial-azulMedio transition-colors text-sm"
              >
                Actualizar a Pro →
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}