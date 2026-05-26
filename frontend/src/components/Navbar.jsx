import { Link, useLocation } from 'react-router-dom';
import { BookOpen, BarChart2, PlusCircle, Shield } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();

  const links = [
    { to: '/dashboard', label: 'Inicio', icon: Shield },
    { to: '/generar', label: 'Nuevo supuesto', icon: PlusCircle },
    { to: '/progreso', label: 'Mi progreso', icon: BarChart2 },
  ];

  return (
    <nav className="bg-policial-azul text-white shadow-lg">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg tracking-wide">
          <BookOpen size={22} />
          <span>PolicialMVP</span>
        </Link>
        <div className="flex gap-6">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-100 ${
                location.pathname === to ? 'opacity-100 border-b-2 border-white pb-0.5' : 'opacity-70'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}