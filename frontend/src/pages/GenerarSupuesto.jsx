import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Send, ChevronDown } from 'lucide-react';
import Navbar from '../components/Navbar';
import { generarSupuesto, responderSupuesto } from '../services/api';
import api from '../services/api';

export default function GenerarSupuesto() {
  const navigate = useNavigate();
  const [fase, setFase] = useState('configurar'); // configurar | resolviendo | enviando
  const [dificultad, setDificultad] = useState(2);
  const [formato, setFormato] = useState('desarrollo');
  const [supuesto, setSupuesto] = useState(null);
  const [respuesta, setRespuesta] = useState('');
  const [error, setError] = useState(null);
  const [tiempoInicio, setTiempoInicio] = useState(null);

  const [materias, setMaterias] = useState([]);
  const [materiaSeleccionada, setMateriaSeleccionada] = useState('');

  useEffect(() => {
    fetch('http://184.174.39.148/api/admin/materias')
      .then(r => r.json())
      .then(data => {
        setMaterias(data);
        setMateriaSeleccionada('aleatorio');
      });
  }, []);

  const handleGenerar = async () => {
    setFase('generando');
    setError(null);
    try {
      let materia = materiaSeleccionada;
      if (materia === 'aleatorio') {
        materia = materias[Math.floor(Math.random() * materias.length)].id;
      }
      const data = await generarSupuesto(materia, dificultad, formato);
      setSupuesto(data);
      setTiempoInicio(Date.now());
      setFase('resolviendo');
    } catch (e) {
      setError(e.response?.data?.detail || 'Error generando el supuesto. Inténtalo de nuevo.');
      setFase('configurar');
    }
  };

  const handleEnviar = async () => {
    if (!respuesta.trim()) return;
    setFase('enviando');
    try {
      const tiempo = Math.floor((Date.now() - tiempoInicio) / 1000);
      await responderSupuesto(supuesto.supuesto_id, respuesta, tiempo);
      navigate(`/correccion/${supuesto.supuesto_id}`);
    } catch (e) {
      setError('Error enviando la respuesta. Inténtalo de nuevo.');
      setFase('resolviendo');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Configuración */}
        {fase === 'configurar' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h1 className="text-2xl font-bold text-policial-azul mb-6">Nuevo supuesto práctico</h1>

            <div className="space-y-6">
              {/* Materia */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Materia</label>
                <select
                  value={materiaSeleccionada}
                  onChange={e => setMateriaSeleccionada(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul"
                >
                  <option value="aleatorio">🎲 Aleatorio</option>
                  {materias.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>
              {/* Dificultad */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Dificultad</label>
                <div className="flex gap-3">
                  {[1, 2, 3].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDificultad(d)}
                      className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors ${dificultad === d
                        ? 'bg-policial-azul text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {d === 1 ? '⭐ Básico' : d === 2 ? '⭐⭐ Medio' : '⭐⭐⭐ Avanzado'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Formato */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Formato</label>
                <div className="flex gap-3">
                  {[
                    { value: 'desarrollo', label: '📝 Desarrollo' },
                    { value: 'test', label: '✅ Test' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setFormato(value)}
                      className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors ${formato === value
                        ? 'bg-policial-azul text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerar}
                className="w-full bg-policial-azul text-white font-bold py-4 rounded-xl hover:bg-policial-azulMedio transition-colors text-lg shadow-md"
              >
                Generar supuesto
              </button>
            </div>
          </div>
        )}

        {/* Generando */}
        {fase === 'generando' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <Loader2 size={48} className="text-policial-azul animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Generando supuesto con IA...</p>
            <p className="text-gray-400 text-sm mt-1">Esto puede tardar unos segundos</p>
          </div>
        )}

        {/* Resolviendo */}
        {fase === 'resolviendo' && supuesto && (
          <div className="space-y-6">
            {/* Enunciado */}
            <div className="bg-policial-azulClaro border-l-4 border-policial-azul rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-policial-azul uppercase tracking-wider">
                  Supuesto práctico
                </span>
                <div className="flex gap-2">
                  <span className="text-xs bg-policial-azul text-white px-2 py-1 rounded-full">
                    Dificultad {supuesto.dificultad}/3
                  </span>
                  <span className="text-xs bg-policial-azulMedio text-white px-2 py-1 rounded-full">
                    {supuesto.formato}
                  </span>
                </div>
              </div>
              <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">
                {supuesto.enunciado}
              </p>
            </div>

            {/* Respuesta */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Tu respuesta
              </label>
              <textarea
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                placeholder="Desarrolla aquí tu respuesta: consideración previa, infracciones con artículo exacto, calificación, sanción con céntimos, órgano sancionador, actuación policial y documentación..."
                className="w-full h-64 text-sm text-gray-700 border border-gray-200 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-policial-azul focus:border-transparent"
              />
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-gray-400">
                  {respuesta.length} caracteres
                </span>
                <button
                  onClick={handleEnviar}
                  disabled={!respuesta.trim()}
                  className="flex items-center gap-2 bg-policial-azul text-white font-bold px-6 py-3 rounded-xl hover:bg-policial-azulMedio transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                  Enviar para corregir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enviando */}
        {fase === 'enviando' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <Loader2 size={48} className="text-policial-azul animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Corrigiendo tu respuesta...</p>
            <p className="text-gray-400 text-sm mt-1">La IA está analizando tu respuesta en detalle</p>
          </div>
        )}

      </div>
    </div>
  );
}