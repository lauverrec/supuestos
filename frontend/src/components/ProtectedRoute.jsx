import { useAuth, useUser, SignIn } from '@clerk/react';
import { useEffect } from 'react';
import { setTokenGetter } from '../services/tokenStore';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (isSignedIn) {
      setTokenGetter(getToken);
    } else {
      setTokenGetter(null);
    }
  }, [isSignedIn, getToken]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Cargando...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SignIn routing="hash" />
      </div>
    );
  }

  if (requireAdmin && user?.publicMetadata?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg font-medium">Acceso restringido</p>
          <p className="text-gray-400 text-sm mt-1">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return children;
}