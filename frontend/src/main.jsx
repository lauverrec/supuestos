import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import GenerarSupuesto from './pages/GenerarSupuesto'
import Correccion from './pages/Correccion'
import MiProgreso from './pages/MiProgreso'
import Admin from './pages/Admin'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/generar" element={<GenerarSupuesto />} />
        <Route path="/correccion/:supuestoId" element={<Correccion />} />
        <Route path="/progreso" element={<MiProgreso />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)