import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import GenerarSupuesto from './pages/GenerarSupuesto'
import Correccion from './pages/Correccion'
import MiProgreso from './pages/MiProgreso'
import Admin from './pages/Admin'
import ProtectedRoute from './components/ProtectedRoute'
import Precios from './pages/Precios'
import { useAuth } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import Perfil from './pages/Perfil'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  
  if (!isLoaded) return null;
  if (isSignedIn) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/precios" element={<Precios />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/generar" element={<ProtectedRoute><GenerarSupuesto /></ProtectedRoute>} />
          <Route path="/correccion/:supuestoId" element={<ProtectedRoute><Correccion /></ProtectedRoute>} />
          <Route path="/progreso" element={<ProtectedRoute><MiProgreso /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
          <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
)