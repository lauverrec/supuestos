import { Link, useLocation } from 'react-router-dom';
import { BookOpen, BarChart2, PlusCircle, Shield, LogOut, Settings, Menu, X } from 'lucide-react';
import { useClerk, useUser } from '@clerk/react';
import { useState } from 'react';

export default function Navbar() {
  const location = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === 'admin';
  const [abierto, setAbierto] = useState(false);

  const links = [
    { to: '/dashboard', label: 'Inicio', icon: Shield },
    { to: '/generar', label: 'Nuevo supuesto', icon: PlusCircle },
    { to: '/progreso', label: 'Mi progreso', icon: BarChart2 },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: Settings }] : []),
  ];

  return (
    <nav className="bg-policial-azul text-white shadow-lg">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg tracking-wide">
          <BookOpen size={22} />
          <span>PolicialMVP</span>
        </Link>

        {/* Menú desktop */}
        <div className="hidden md:flex items-center gap-6">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-100 ${location.pathname === to ? 'opacity-100 border-b-2 border-white pb-0.5' : 'opacity-70'
                }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          {user && (
            <div className="flex items-center gap-3 ml-4 border-l border-white border-opacity-30 pl-4">
              <Link to="/perfil" className="text-xs opacity-70 hover:opacity-100">
                {user.primaryEmailAddress?.emailAddress}
              </Link>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1 text-sm opacity-70 hover:opacity-100 transition-opacity"
              >
                <LogOut size={16} />
                Salir
              </button>
            </div>
          )}
        </div>

        {/* Botón hamburguesa móvil */}
        <button
          onClick={() => setAbierto(!abierto)}
          className="md:hidden p-1 opacity-90 hover:opacity-100"
          aria-label="Menú"
        >
          {abierto ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Menú desplegable móvil */}
      {abierto && (
        <div className="md:hidden border-t border-white border-opacity-20 px-4 py-3 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setAbierto(false)}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium ${location.pathname === to ? 'bg-white bg-opacity-15' : 'opacity-80 hover:bg-white hover:bg-opacity-10'
                }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          {user && (
            <div className="border-t border-white border-opacity-20 mt-2 pt-2 space-y-1">
              <Link
                to="/perfil"
                onClick={() => setAbierto(false)}
                className="block px-2 py-2 rounded-lg text-xs opacity-80 hover:bg-white hover:bg-opacity-10 truncate"
              >
                {user.primaryEmailAddress?.emailAddress}
              </Link>
              <button
                onClick={() => { setAbierto(false); signOut(); }}
                className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm opacity-80 hover:bg-white hover:bg-opacity-10"
              >
                <LogOut size={18} />
                Salir
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
