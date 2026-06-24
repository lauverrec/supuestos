import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Upload, CheckCircle, AlertCircle, BarChart2, Database } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useApi } from '../hooks/useApi';

export default function Admin() {
  const [materias, setMaterias] = useState([]);
  const [bloques, setBloques] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('bloques');

  const api = useApi();

  // Formulario nuevo bloque
  const [nuevoBloqueForm, setNuevoBloqueForm] = useState({
    materia_id: '',
    titulo: '',
    numero_bloque: '',
    normativa_principal: ''
  });

  // Indexación
  const [indexarForm, setIndexarForm] = useState({
    bloque_id: '',
    contenido: ''
  });
  const [indexando, setIndexando] = useState(false);
  const [resultadoIndexacion, setResultadoIndexacion] = useState(null);
  const [creandoBloque, setCreandoBloque] = useState(false);
  const [resultadoBloque, setResultadoBloque] = useState(null);
  const [submaterias, setSubmaterias] = useState([]);
  const [materiaSubmateria, setMateriaSubmateria] = useState('');
  // Estado para todas las submaterias
  const [todasSubmaterias, setTodasSubmaterias] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [mRes, bRes, sRes, tsRes] = await Promise.all([
        api.get('/admin/materias'),
        api.get('/admin/bloques'),
        api.get('/admin/stats'),
        api.get('/admin/submaterias')
      ]);
      setMaterias(mRes.data);
      setBloques(bRes.data);
      setStats(sRes.data);
      setTodasSubmaterias(tsRes.data);
      if (mRes.data.length > 0 && !nuevoBloqueForm.materia_id) {
        const primeraMateria = mRes.data[0].id;
        setNuevoBloqueForm(f => ({ ...f, materia_id: primeraMateria }));
        const sRes2 = await api.get(`/admin/submaterias/${primeraMateria}`);
        setSubmaterias(sRes2.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const cargarSubmaterias = async (materiaId) => {
    if (!materiaId) return;
    try {
      const res = await api.get(`/admin/submaterias/${materiaId}`);
      console.log('Submaterias cargadas:', res.data);
      setSubmaterias(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCrearBloque = async () => {
    setCreandoBloque(true);
    setResultadoBloque(null);
    try {
      const res = await api.post('/admin/bloques', {
        materia_id: nuevoBloqueForm.materia_id,
        submateria_id: nuevoBloqueForm.submateria_id || null,
        titulo: nuevoBloqueForm.titulo,
        numero_bloque: parseInt(nuevoBloqueForm.numero_bloque),
        normativa_principal: nuevoBloqueForm.normativa_principal
          .split(',').map(n => n.trim()).filter(Boolean)
      });
      setResultadoBloque({ ok: true, mensaje: `Bloque "${res.data.titulo}" creado. ID: ${res.data.id}` });
      setIndexarForm(f => ({ ...f, bloque_id: res.data.id }));
      await cargarDatos();
    } catch (e) {
      setResultadoBloque({ ok: false, mensaje: 'Error creando el bloque' });
    } finally {
      setCreandoBloque(false);
    }
  };

  const handleIndexar = async () => {
    if (!indexarForm.bloque_id || !indexarForm.contenido.trim()) return;
    setIndexando(true);
    setResultadoIndexacion(null);
    try {
      const res = await api.post('/admin/bloques/indexar', {
        bloque_id: indexarForm.bloque_id,
        contenido: indexarForm.contenido
      });
      setResultadoIndexacion({
        ok: true,
        mensaje: `✅ ${res.data.chunks_insertados} chunks indexados correctamente`
      });
      await cargarDatos();
    } catch (e) {
      setResultadoIndexacion({ ok: false, mensaje: '❌ Error indexando el bloque' });
    } finally {
      setIndexando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-policial-azul">Panel de administración</h1>
          <Link to="/dashboard" className="text-sm text-gray-500 hover:underline">← Volver</Link>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Bloques', valor: stats.total_bloques, icon: Database },
              { label: 'Chunks RAG', valor: stats.total_chunks, icon: Database },
              { label: 'Supuestos generados', valor: stats.total_supuestos, icon: BarChart2 },
              { label: 'Puntuación media', valor: stats.puntuacion_media ?? '—', icon: BarChart2 },
            ].map(({ label, valor, icon: Icon }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-2xl font-bold text-policial-azul">{valor}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'bloques', label: 'Bloques indexados' },
            { id: 'nuevo', label: 'Crear bloque' },
            { id: 'indexar', label: 'Indexar contenido' },
            { id: 'materia', label: 'Crear materia' },
            { id: 'submateria', label: 'Crear submateria' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t.id
                ? 'bg-policial-azul text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Bloques indexados */}
        {tab === 'bloques' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 mb-4">Bloques en base de datos</h2>
            {bloques.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No hay bloques todavía</p>
            ) : (
              <div className="space-y-2">
                {bloques.map(b => (
                  <div key={b.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Bloque {b.numero_bloque} — {b.titulo}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {b.materia}{b.submateria ? ` › ${b.submateria}` : ''} · {b.chunks} chunks
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {b.chunks > 0
                        ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle size={12} /> Indexado
                        </span>
                        : <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                          <AlertCircle size={12} /> Sin indexar
                        </span>
                      }
                      <button
                        onClick={() => {
                          setIndexarForm(f => ({ ...f, bloque_id: b.id }));
                          setTab('indexar');
                        }}
                        className="text-xs text-policial-azulMedio hover:underline ml-2"
                      >
                        Indexar →
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`¿Eliminar el bloque "${b.titulo}"?`)) return;
                          await api.delete(`/admin/bloques/${b.id}`);
                          await cargarDatos();
                        }}
                        className="text-xs text-red-500 hover:underline ml-2"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Crear bloque */}
        {tab === 'nuevo' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 mb-6">Crear nuevo bloque</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Submateria (opcional)</label>
                <select
                  value={nuevoBloqueForm.submateria_id || ''}
                  onChange={e => setNuevoBloqueForm(f => ({ ...f, submateria_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul"
                >
                  <option value="">— Sin submateria —</option>
                  {submaterias.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de bloque</label>
                <input
                  type="number"
                  value={nuevoBloqueForm.numero_bloque}
                  onChange={e => setNuevoBloqueForm(f => ({ ...f, numero_bloque: e.target.value }))}
                  placeholder="Ej: 8"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={nuevoBloqueForm.titulo}
                  onChange={e => setNuevoBloqueForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ej: Medidas Cautelares"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Normativa principal <span className="text-gray-400">(separada por comas)</span>
                </label>
                <input
                  type="text"
                  value={nuevoBloqueForm.normativa_principal}
                  onChange={e => setNuevoBloqueForm(f => ({ ...f, normativa_principal: e.target.value }))}
                  placeholder="Ej: LEPARA, Decreto 155/2018, LO 4/2015"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul"
                />
              </div>

              {resultadoBloque && (
                <div className={`text-sm px-4 py-3 rounded-xl ${resultadoBloque.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                  {resultadoBloque.mensaje}
                </div>
              )}

              <button
                onClick={handleCrearBloque}
                disabled={creandoBloque || !nuevoBloqueForm.titulo || !nuevoBloqueForm.numero_bloque}
                className="w-full bg-policial-azul text-white font-bold py-3 rounded-xl hover:bg-policial-azulMedio transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                {creandoBloque ? 'Creando...' : 'Crear bloque'}
              </button>
            </div>
          </div>
        )}

        {/* Tab: Indexar contenido */}
        {tab === 'indexar' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 mb-2">Indexar contenido de un bloque</h2>
            <p className="text-sm text-gray-500 mb-6">
              Pega aquí el contenido del bloque. Se dividirá en chunks y se vectorizará para el RAG.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar bloque</label>
                <select
                  value={indexarForm.bloque_id}
                  onChange={e => setIndexarForm(f => ({ ...f, bloque_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul"
                >
                  <option value="">— Selecciona un bloque —</option>
                  {bloques.map(b => (
                    <option key={b.id} value={b.id}>
                      Bloque {b.numero_bloque} — {b.titulo} ({b.chunks} chunks)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenido del bloque</label>
                <textarea
                  value={indexarForm.contenido}
                  onChange={e => setIndexarForm(f => ({ ...f, contenido: e.target.value }))}
                  placeholder="Pega aquí el contenido completo del bloque — normativa, situaciones tipo, infracciones, sanciones..."
                  className="w-full h-80 text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-policial-azul"
                />
                <p className="text-xs text-gray-400 mt-1">{indexarForm.contenido.length} caracteres</p>
              </div>

              {resultadoIndexacion && (
                <div className={`text-sm px-4 py-3 rounded-xl ${resultadoIndexacion.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                  {resultadoIndexacion.mensaje}
                </div>
              )}

              <button
                onClick={handleIndexar}
                disabled={indexando || !indexarForm.bloque_id || !indexarForm.contenido.trim()}
                className="w-full bg-policial-azul text-white font-bold py-3 rounded-xl hover:bg-policial-azulMedio transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Upload size={16} />
                {indexando ? 'Indexando...' : 'Indexar bloque'}
              </button>
            </div>
          </div>
        )}

        {/* Tab: Crear materia */}
        {tab === 'materia' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 mb-6">Crear nueva materia</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  id="materia-nombre"
                  placeholder="Ej: Tráfico y Seguridad Vial"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  id="materia-descripcion"
                  placeholder="Ej: Normativa de tráfico, vehículos y conductores"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                <input
                  type="number"
                  id="materia-orden"
                  placeholder="Ej: 2"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul"
                />
              </div>
              <button
                onClick={async () => {
                  const nombre = document.getElementById('materia-nombre').value;
                  const descripcion = document.getElementById('materia-descripcion').value;
                  const orden = parseInt(document.getElementById('materia-orden').value) || 1;
                  if (!nombre) return;
                  try {
                    await api.post('/admin/materias', { nombre, descripcion, orden });
                    alert(`Materia "${nombre}" creada correctamente`);
                    await cargarDatos();
                  } catch (e) {
                    alert('Error creando la materia');
                  }
                }}
                className="w-full bg-policial-azul text-white font-bold py-3 rounded-xl hover:bg-policial-azulMedio transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Crear materia
              </button>
              {/* Materias existentes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Materias existentes</label>
                {materias.length === 0 ? (
                  <p className="text-xs text-gray-400">Ninguna todavía</p>
                ) : (
                  <div className="space-y-2">
                    {materias.map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2">
                        <span className="text-sm text-gray-700 font-medium">{m.nombre}</span>
                        <button
                          onClick={async () => {
                            if (!confirm(`¿Eliminar "${m.nombre}"?`)) return;
                            try {
                              await api.delete(`/admin/materias/${m.id}`);
                              await cargarDatos();
                            } catch (e) {
                              alert('Error eliminando la materia. Puede que tenga bloques asociados.');
                            }
                          }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'submateria' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 mb-6">Crear nueva submateria</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Materia</label>
                <select
                  value={materiaSubmateria}
                  onChange={e => {
                    setMateriaSubmateria(e.target.value);
                    cargarSubmaterias(e.target.value);
                  }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul"
                >
                  <option value="">— Selecciona materia —</option>
                  {materias.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  id="submateria-nombre"
                  placeholder="Ej: Animales Potencialmente Peligrosos"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  id="submateria-descripcion"
                  placeholder="Ej: Normativa sobre tenencia de animales peligrosos"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul"
                />
              </div>
              <button
                onClick={async () => {
                  const nombre = document.getElementById('submateria-nombre').value;
                  const descripcion = document.getElementById('submateria-descripcion').value;
                  if (!materiaSubmateria || !nombre) return;
                  await api.post('/admin/submaterias', { materia_id: materiaSubmateria, nombre, descripcion });
                  alert(`Submateria "${nombre}" creada`);
                  cargarSubmaterias(materiaSubmateria);
                  await cargarDatos();
                }}
                className="w-full bg-policial-azul text-white font-bold py-3 rounded-xl hover:bg-policial-azulMedio transition-colors"
              >
                Crear submateria
              </button>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Submaterias existentes</label>
                {todasSubmaterias.length === 0 ? (
                  <p className="text-xs text-gray-400">Ninguna todavía</p>
                ) : (
                  <div className="space-y-2">
                    {todasSubmaterias.map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2">
                        <div>
                          <span className="text-sm text-gray-700 font-medium">{s.nombre}</span>
                          <span className="text-xs text-gray-400 ml-2">· {s.materia}</span>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm(`¿Eliminar "${s.nombre}"?`)) return;
                            await api.delete(`/admin/submaterias/${s.id}`);
                            const tsRes = await api.get('/admin/submaterias');
                            setTodasSubmaterias(tsRes.data);
                          }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}