import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Upload, CheckCircle, AlertCircle, BarChart2, Database,
  ChevronRight, ChevronDown, FolderTree, Folder, FileText, Trash2, X
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useApi } from '../hooks/useApi';

export default function Admin() {
  const api = useApi();

  const [bloquesTematicos, setBloquesTematicos] = useState([]); // tabla materias
  const [materias, setMaterias] = useState([]);                 // tabla submaterias
  const [contenidos, setContenidos] = useState([]);             // tabla bloques
  const [stats, setStats] = useState(null);

  const [expandidos, setExpandidos] = useState({}); // { [id]: bool }

  // Modal genérico: { tipo, contexto } | null
  const [modal, setModal] = useState(null);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    try {
      const [btRes, cRes, sRes, mRes] = await Promise.all([
        api.get('/admin/materias'),     // bloques temáticos
        api.get('/admin/bloques'),      // contenidos
        api.get('/admin/stats'),
        api.get('/admin/submaterias'),  // materias
      ]);
      setBloquesTematicos(btRes.data);
      setContenidos(cRes.data);
      setStats(sRes.data);
      setMaterias(mRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const toggle = (id) => setExpandidos(e => ({ ...e, [id]: !e[id] }));

  // --- Estructura jerárquica derivada ---
  const materiasDe = (btId) => materias.filter(m => m.materia_id === btId);
  const contenidosDeMateria = (subId) => contenidos.filter(c => c.submateria_id === subId);
  const contenidosSinMateria = (btId) =>
    contenidos.filter(c => c.materia_id === btId && !c.submateria_id);

  // --- Acciones ---
  const borrarContenido = async (c) => {
    if (!confirm(`¿Eliminar el contenido "${c.titulo}"?`)) return;
    await api.delete(`/admin/bloques/${c.id}`);
    await cargarDatos();
  };

  const borrarBloque = async (bt) => {
    if (!confirm(`¿Eliminar el bloque "${bt.nombre}"? Debe estar vacío.`)) return;
    try {
      await api.delete(`/admin/materias/${bt.id}`);
      await cargarDatos();
    } catch {
      alert('No se pudo eliminar. Puede que tenga materias o contenidos asociados.');
    }
  };

  const borrarMateria = async (m) => {
    if (!confirm(`¿Eliminar la materia "${m.nombre}"?`)) return;
    try {
      await api.delete(`/admin/submaterias/${m.id}`);
      await cargarDatos();
    } catch {
      alert('No se pudo eliminar. Puede que tenga contenidos asociados.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-policial-azul">Panel de administración</h1>
          <Link to="/dashboard" className="text-sm text-gray-500 hover:underline">← Volver</Link>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Contenidos', valor: stats.total_bloques },
              { label: 'Chunks RAG', valor: stats.total_chunks },
              { label: 'Supuestos generados', valor: stats.total_supuestos },
              { label: 'Puntuación media', valor: stats.puntuacion_media ?? '—' },
            ].map(({ label, valor }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-2xl font-bold text-policial-azul">{valor}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Árbol */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <FolderTree size={18} className="text-policial-azul" />
              Estructura de contenidos
            </h2>
            <button
              onClick={() => setModal({ tipo: 'bloque' })}
              className="flex items-center gap-1.5 text-sm bg-policial-azul text-white font-medium px-3 py-2 rounded-lg hover:bg-policial-azulMedio transition-colors"
            >
              <Plus size={15} /> Nuevo bloque
            </button>
          </div>

          {bloquesTematicos.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No hay bloques todavía</p>
          ) : (
            <div className="space-y-1">
              {bloquesTematicos.map(bt => {
                const abierto = expandidos[bt.id];
                const mats = materiasDe(bt.id);
                const sueltos = contenidosSinMateria(bt.id);
                return (
                  <div key={bt.id}>
                    {/* Nivel 1: BLOQUE */}
                    <div className="flex items-center justify-between group rounded-lg hover:bg-gray-50 px-2 py-2">
                      <button onClick={() => toggle(bt.id)} className="flex items-center gap-2 flex-1 text-left">
                        {abierto ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                        <Folder size={16} className="text-policial-azul" />
                        <span className="text-sm font-semibold text-gray-800">{bt.nombre}</span>
                        <span className="text-xs text-gray-400">
                          ({mats.length} materia{mats.length !== 1 ? 's' : ''})
                        </span>
                      </button>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal({ tipo: 'materia', bloqueId: bt.id, bloqueNombre: bt.nombre })}
                          className="text-xs text-policial-azulMedio hover:underline"
                        >
                          + materia
                        </button>
                        <button
                          onClick={() => setModal({ tipo: 'contenido', bloqueId: bt.id, submateriaId: null, bloqueNombre: bt.nombre })}
                          className="text-xs text-policial-azulMedio hover:underline"
                        >
                          + contenido
                        </button>
                        <button onClick={() => borrarBloque(bt)} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Hijos */}
                    {abierto && (
                      <div className="ml-6 border-l border-gray-100 pl-3 space-y-1 pb-1">
                        {/* Nivel 2: MATERIAS */}
                        {mats.map(m => {
                          const mAbierto = expandidos[m.id];
                          const conts = contenidosDeMateria(m.id);
                          return (
                            <div key={m.id}>
                              <div className="flex items-center justify-between group rounded-lg hover:bg-gray-50 px-2 py-1.5">
                                <button onClick={() => toggle(m.id)} className="flex items-center gap-2 flex-1 text-left">
                                  {mAbierto ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
                                  <FileText size={14} className="text-policial-azulMedio" />
                                  <span className="text-sm text-gray-700">{m.nombre}</span>
                                  <span className="text-xs text-gray-400">({conts.length})</span>
                                </button>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => setModal({ tipo: 'contenido', bloqueId: bt.id, submateriaId: m.id, bloqueNombre: bt.nombre, materiaNombre: m.nombre })}
                                    className="text-xs text-policial-azulMedio hover:underline"
                                  >
                                    + contenido
                                  </button>
                                  <button onClick={() => borrarMateria(m)} className="text-gray-300 hover:text-red-500">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                              {/* Nivel 3: CONTENIDOS de la materia */}
                              {mAbierto && (
                                <div className="ml-6 border-l border-gray-100 pl-3 space-y-0.5 pb-1">
                                  {conts.length === 0
                                    ? <p className="text-xs text-gray-300 px-2 py-1">Sin contenidos</p>
                                    : conts.map(c => <FilaContenido key={c.id} c={c} onIndexar={() => setModal({ tipo: 'indexar', contenido: c })} onBorrar={() => borrarContenido(c)} />)}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Contenidos directos del bloque (sin materia) */}
                        {sueltos.length > 0 && (
                          <div className="space-y-0.5">
                            {sueltos.map(c => <FilaContenido key={c.id} c={c} onIndexar={() => setModal({ tipo: 'indexar', contenido: c })} onBorrar={() => borrarContenido(c)} />)}
                          </div>
                        )}

                        {mats.length === 0 && sueltos.length === 0 && (
                          <p className="text-xs text-gray-300 px-2 py-1">Vacío — añade una materia o un contenido</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {modal?.tipo === 'bloque' && <ModalBloque api={api} onClose={() => setModal(null)} onDone={cargarDatos} />}
      {modal?.tipo === 'materia' && <ModalMateria api={api} ctx={modal} onClose={() => setModal(null)} onDone={cargarDatos} />}
      {modal?.tipo === 'contenido' && <ModalContenido api={api} ctx={modal} onClose={() => setModal(null)} onDone={cargarDatos} />}
      {modal?.tipo === 'indexar' && <ModalIndexar api={api} ctx={modal} onClose={() => setModal(null)} onDone={cargarDatos} />}
    </div>
  );
}

/* ---------- Fila de contenido (nivel 3) ---------- */
function FilaContenido({ c, onIndexar, onBorrar }) {
  return (
    <div className="flex items-center justify-between group rounded-lg hover:bg-gray-50 px-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <FileText size={13} className="text-gray-400 shrink-0" />
        <span className="text-sm text-gray-600 truncate">{c.titulo}</span>
        {c.chunks > 0
          ? <span className="flex items-center gap-1 text-xs text-green-600 shrink-0"><CheckCircle size={11} />{c.chunks}</span>
          : <span className="flex items-center gap-1 text-xs text-yellow-600 shrink-0"><AlertCircle size={11} />sin indexar</span>}
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onIndexar} className="text-xs text-policial-azulMedio hover:underline">indexar</button>
        <button onClick={onBorrar} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

/* ---------- Marco de modal ---------- */
function Modal({ titulo, subtitulo, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800">{titulo}</h3>
            {subtitulo && <p className="text-xs text-gray-400 mt-0.5">{subtitulo}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-policial-azul";
const btnCls = "w-full bg-policial-azul text-white font-bold py-3 rounded-xl hover:bg-policial-azulMedio transition-colors disabled:opacity-40 flex items-center justify-center gap-2";

/* ---------- Crear BLOQUE (tabla materias) ---------- */
function ModalBloque({ api, onClose, onDone }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [orden, setOrden] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre) return;
    setGuardando(true);
    try {
      await api.post('/admin/materias', { nombre, descripcion, orden: parseInt(orden) || 1 });
      await onDone(); onClose();
    } catch { alert('Error creando el bloque'); }
    finally { setGuardando(false); }
  };

  return (
    <Modal titulo="Nuevo bloque" subtitulo="Penal, Tráfico, Seguridad ciudadana..." onClose={onClose}>
      <div className="space-y-4">
        <input className={inputCls} placeholder="Nombre (ej: Tráfico y transportes)" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input className={inputCls} placeholder="Descripción (opcional)" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
        <input className={inputCls} type="number" placeholder="Orden (ej: 2)" value={orden} onChange={e => setOrden(e.target.value)} />
        <button className={btnCls} onClick={guardar} disabled={guardando || !nombre}>
          <Plus size={16} />{guardando ? 'Creando...' : 'Crear bloque'}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Crear MATERIA (tabla submaterias) ---------- */
function ModalMateria({ api, ctx, onClose, onDone }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre) return;
    setGuardando(true);
    try {
      await api.post('/admin/submaterias', { materia_id: ctx.bloqueId, nombre, descripcion });
      await onDone(); onClose();
    } catch { alert('Error creando la materia'); }
    finally { setGuardando(false); }
  };

  return (
    <Modal titulo="Nueva materia" subtitulo={`Dentro de: ${ctx.bloqueNombre}`} onClose={onClose}>
      <div className="space-y-4">
        <input className={inputCls} placeholder="Nombre (ej: Infracciones, Permisos...)" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input className={inputCls} placeholder="Descripción (opcional)" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
        <button className={btnCls} onClick={guardar} disabled={guardando || !nombre}>
          <Plus size={16} />{guardando ? 'Creando...' : 'Crear materia'}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Crear CONTENIDO (tabla bloques) ---------- */
function ModalContenido({ api, ctx, onClose, onDone }) {
  const [titulo, setTitulo] = useState('');
  const [numero, setNumero] = useState('');
  const [normativa, setNormativa] = useState('');
  const [guardando, setGuardando] = useState(false);

  const sub = ctx.materiaNombre ? `${ctx.bloqueNombre} › ${ctx.materiaNombre}` : ctx.bloqueNombre;

  const guardar = async () => {
    if (!titulo || !numero) return;
    setGuardando(true);
    try {
      await api.post('/admin/bloques', {
        materia_id: ctx.bloqueId,
        submateria_id: ctx.submateriaId || null,
        titulo,
        numero_bloque: parseInt(numero),
        normativa_principal: normativa.split(',').map(n => n.trim()).filter(Boolean)
      });
      await onDone(); onClose();
    } catch { alert('Error creando el contenido'); }
    finally { setGuardando(false); }
  };

  return (
    <Modal titulo="Nuevo contenido" subtitulo={sub} onClose={onClose}>
      <div className="space-y-4">
        <input className={inputCls} placeholder="Título (ej: Velocidad)" value={titulo} onChange={e => setTitulo(e.target.value)} />
        <input className={inputCls} type="number" placeholder="Número (ej: 8)" value={numero} onChange={e => setNumero(e.target.value)} />
        <input className={inputCls} placeholder="Normativa principal, separada por comas (opcional)" value={normativa} onChange={e => setNormativa(e.target.value)} />
        <button className={btnCls} onClick={guardar} disabled={guardando || !titulo || !numero}>
          <Plus size={16} />{guardando ? 'Creando...' : 'Crear contenido'}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Indexar CONTENIDO ---------- */
function ModalIndexar({ api, ctx, onClose, onDone }) {
  const c = ctx.contenido;
  const [texto, setTexto] = useState('');
  const [indexando, setIndexando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const indexar = async () => {
    if (!texto.trim()) return;
    setIndexando(true);
    setResultado(null);
    try {
      const res = await api.post('/admin/bloques/indexar', { bloque_id: c.id, contenido: texto });
      setResultado({ ok: true, msg: `✅ ${res.data.chunks_insertados} chunks indexados` });
      await onDone();
    } catch {
      setResultado({ ok: false, msg: '❌ Error indexando' });
    } finally {
      setIndexando(false);
    }
  };

  return (
    <Modal titulo="Indexar contenido" subtitulo={c.titulo} onClose={onClose}>
      <div className="space-y-4">
        <textarea
          className={`${inputCls} h-64 resize-none`}
          placeholder="Pega aquí el texto completo — normativa, situaciones tipo, infracciones, sanciones..."
          value={texto}
          onChange={e => setTexto(e.target.value)}
        />
        <p className="text-xs text-gray-400 -mt-2">{texto.length} caracteres · ya tiene {c.chunks} chunks</p>
        {resultado && (
          <div className={`text-sm px-4 py-3 rounded-xl ${resultado.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {resultado.msg}
          </div>
        )}
        <button className={btnCls} onClick={indexar} disabled={indexando || !texto.trim()}>
          <Upload size={16} />{indexando ? 'Indexando...' : 'Indexar'}
        </button>
      </div>
    </Modal>
  );
}
