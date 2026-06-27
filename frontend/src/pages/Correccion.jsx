import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, AlertCircle, BookOpen, PlusCircle, Scale, ShieldAlert, FileText } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useApi } from '../hooks/useApi';

// Formatea una sanción que puede ser número o null
function fmtSancion(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return `${valor.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`;
  return valor; // ya es texto
}

export default function Correccion() {
  const { supuestoId } = useParams();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const api = useApi();

  useEffect(() => {
    api.get(`/supuestos/${supuestoId}`)
      .then(r => setDatos(r.data))
      .catch(() => setError('No se encontró la corrección'))
      .finally(() => setCargando(false));
  }, [supuestoId]);

  if (cargando) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center h-64 text-gray-400">Cargando corrección...</div>
    </div>
  );

  if (error || !datos?.feedback) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500 mb-4">No hay corrección disponible para este supuesto.</p>
        <Link to="/generar" className="text-policial-azulMedio hover:underline">
          Generar nuevo supuesto →
        </Link>
      </div>
    </div>
  );

  const { feedback, puntuacion } = datos;
  const esTest = !!feedback.detalle;
  const sm = datos.solucion_modelo || {};
  const ap = sm.actuacion_policial || {};

  const colorPuntuacion = puntuacion >= 7 ? 'text-green-600' : puntuacion >= 5 ? 'text-yellow-600' : 'text-red-600';
  const bgPuntuacion = puntuacion >= 7 ? 'bg-green-50 border-green-200' : puntuacion >= 5 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  // Apartados de actuación policial estructurada (objeto)
  const apartadosActuacion = [
    ['Aseguramiento de la escena', ap.aseguramiento_escena],
    ['Asistencia', ap.asistencia],
    ['Pruebas', ap.pruebas],
    ['Diligencias', ap.diligencias],
    ['Inmovilización', ap.inmovilizacion],
  ].filter(([, v]) => v);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Enunciado */}
        {datos.enunciado && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <BookOpen size={18} className="text-policial-azul" />
              Enunciado del supuesto
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{datos.enunciado}</p>
          </div>
        )}

        {/* Puntuación */}
        <div className={`rounded-2xl border p-6 ${bgPuntuacion}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Puntuación obtenida</p>
              <p className={`text-5xl font-bold ${colorPuntuacion}`}>
                {puntuacion?.toFixed(1)}<span className="text-2xl text-gray-400">/10</span>
              </p>
              {esTest && (
                <p className="text-sm text-gray-500 mt-1">{feedback.correctas} de {feedback.total} preguntas correctas</p>
              )}
            </div>
            <Link to="/generar" className="flex items-center gap-2 bg-policial-azul text-white font-bold px-5 py-3 rounded-xl hover:bg-policial-azulMedio transition-colors text-sm">
              <PlusCircle size={16} /> Nuevo supuesto
            </Link>
          </div>
          {feedback.resumen && (
            <p className="text-gray-700 text-sm mt-4 leading-relaxed border-t border-gray-200 pt-4">{feedback.resumen}</p>
          )}
        </div>

        {/* MODO TEST */}
        {esTest && feedback.detalle?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 mb-4">Detalle de respuestas</h2>
            <div className="space-y-4">
              {feedback.detalle.map((p, i) => (
                <div key={i} className={`rounded-xl p-4 ${p.es_correcta ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-sm font-medium text-gray-800 mb-2">{i + 1}. {p.pregunta}</p>
                  <p className="text-xs">
                    <span className="font-semibold">Tu respuesta:</span> {p.respuesta_dada}
                    {p.es_correcta
                      ? <span className="text-green-600 ml-2">✅ Correcta</span>
                      : <span className="text-red-600 ml-2">❌ Incorrecta — Correcta: {p.respuesta_correcta} — {p.opcion_correcta_texto}</span>}
                  </p>
                  {!p.es_correcta && p.explicacion && (
                    <p className="text-xs text-gray-600 mt-2 italic">{p.explicacion}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODO DESARROLLO */}
        {!esTest && (
          <>
            {/* Ficha técnica por infracción */}
            {feedback.ficha_tecnica?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                  <Scale size={18} className="text-policial-azul" />
                  Ficha técnica
                </h2>
                <div className="space-y-3">
                  {feedback.ficha_tecnica.map((f, i) => {
                    const filas = [
                      ['Normativa', f.normativa],
                      ['Artículo', f.articulo_completo],
                      ['Precepto', f.precepto],
                      ['Sanción', f.sancion],
                      ['Responsable', f.responsable],
                      ['Órgano competente', f.organo_competente],
                      ['Detracción de puntos', f.detraccion_puntos],
                      ['Medidas provisionales', f.medidas_provisionales],
                      ['Prescripción', f.prescripcion],
                    ].filter(([, v]) => v);
                    return (
                      <div key={i} className="border border-gray-100 rounded-xl p-4">
                        {f.infraccion && <p className="text-sm font-semibold text-gray-800 mb-2">{f.infraccion}</p>}
                        <div className="space-y-1">
                          {filas.map(([k, v]) => (
                            <p key={k} className="text-xs text-gray-600"><span className="font-medium">{k}:</span> {v}</p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Infracciones correctas */}
            {feedback.infracciones_correctas?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                  <CheckCircle size={18} className="text-green-500" /> Infracciones correctas
                </h2>
                <div className="space-y-3">
                  {feedback.infracciones_correctas.map((item, i) => (
                    <div key={i} className="bg-green-50 rounded-xl p-4">
                      <p className="font-medium text-green-800 text-sm">{item.infraccion}</p>
                      {item.observacion && <p className="text-green-700 text-xs mt-1">{item.observacion}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Infracciones omitidas */}
            {feedback.infracciones_omitidas?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                  <AlertCircle size={18} className="text-yellow-500" /> Infracciones omitidas
                </h2>
                <div className="space-y-3">
                  {feedback.infracciones_omitidas.map((item, i) => (
                    <div key={i} className="bg-yellow-50 rounded-xl p-4">
                      <p className="font-medium text-yellow-800 text-sm">{item.infraccion}</p>
                      <div className="mt-2 space-y-1">
                        {item.precepto_correcto && <p className="text-xs text-yellow-700"><span className="font-semibold">Precepto:</span> {item.precepto_correcto}</p>}
                        {item.organo_correcto && <p className="text-xs text-yellow-700"><span className="font-semibold">Órgano:</span> {item.organo_correcto}</p>}
                        {item.explicacion && <p className="text-xs text-yellow-600 mt-2 italic">{item.explicacion}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errores */}
            {feedback.infracciones_erroneas?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                  <XCircle size={18} className="text-red-500" /> Infracciones erróneas
                </h2>
                <div className="space-y-3">
                  {feedback.infracciones_erroneas.map((item, i) => (
                    <div key={i} className="bg-red-50 rounded-xl p-4">
                      <p className="text-xs text-red-600"><span className="font-semibold">Dijiste:</span> {item.lo_que_dijo}</p>
                      <p className="text-xs text-red-700 mt-1"><span className="font-semibold">Correcto:</span> {item.lo_correcto}</p>
                      {item.explicacion && <p className="text-xs text-red-600 mt-2 italic">{item.explicacion}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actuación policial (valoración del corrector) */}
            {feedback.actuacion_policial && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                  {feedback.actuacion_policial.correcta
                    ? <CheckCircle size={18} className="text-green-500" />
                    : <XCircle size={18} className="text-red-500" />}
                  Actuación policial
                </h2>
                <p className="text-sm text-gray-600">{feedback.actuacion_policial.observaciones}</p>
              </div>
            )}

            {/* Puntos fuertes y débiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {feedback.puntos_fuertes?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h2 className="font-bold text-gray-800 mb-3 text-sm">💪 Puntos fuertes</h2>
                  <ul className="space-y-2">
                    {feedback.puntos_fuertes.map((p, i) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-2"><span className="text-green-500 shrink-0">✓</span>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.puntos_debiles?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h2 className="font-bold text-gray-800 mb-3 text-sm">⚠️ Puntos débiles</h2>
                  <ul className="space-y-2">
                    {feedback.puntos_debiles.map((p, i) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-2"><span className="text-yellow-500 shrink-0">!</span>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Consejo de estudio */}
            {feedback.consejo_estudio && (
              <div className="bg-policial-azulClaro border border-policial-azulMedio rounded-2xl p-6">
                <h2 className="font-bold text-policial-azul flex items-center gap-2 mb-3">
                  <BookOpen size={18} /> Consejo de estudio
                </h2>
                <p className="text-sm text-policial-azul leading-relaxed">{feedback.consejo_estudio}</p>
              </div>
            )}

            {/* SOLUCIÓN MODELO (esquema de 5 puntos) */}
            {datos.solucion_modelo && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-6">
                  <BookOpen size={18} className="text-policial-azul" /> Solución modelo
                </h2>

                {/* 1. Hechos relevantes */}
                {sm.hechos_relevantes?.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">1. Hechos relevantes</p>
                    <ul className="space-y-1">
                      {sm.hechos_relevantes.map((h, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-policial-azulMedio shrink-0">•</span>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Consideración previa */}
                {sm.consideracion_previa && (sm.consideracion_previa.tipo_establecimiento || sm.consideracion_previa.hora) && (
                  <div className="mb-6 bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Consideración previa</p>
                    {sm.consideracion_previa.tipo_establecimiento && (
                      <p className="text-sm text-gray-700"><span className="font-medium">Establecimiento:</span> {sm.consideracion_previa.tipo_establecimiento}</p>
                    )}
                    {sm.consideracion_previa.hora && (
                      <p className="text-sm text-gray-700"><span className="font-medium">Hora:</span> {sm.consideracion_previa.hora}</p>
                    )}
                    {sm.consideracion_previa.observaciones && (
                      <p className="text-sm text-gray-700 mt-1">{sm.consideracion_previa.observaciones}</p>
                    )}
                  </div>
                )}

                {/* 2. Infracciones */}
                {sm.infracciones?.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">2. Infracciones administrativas</p>
                    <div className="space-y-3">
                      {sm.infracciones.map((inf, i) => {
                        const sancion = fmtSancion(inf.sancion_impuesta);
                        return (
                          <div key={i} className="border border-gray-100 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-medium text-gray-800">{inf.descripcion}</p>
                              <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${inf.calificacion === 'MUY GRAVE' ? 'bg-red-100 text-red-700' : inf.calificacion === 'GRAVE' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {inf.calificacion}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {inf.precepto && <p className="text-xs text-gray-600"><span className="font-medium">Precepto:</span> {inf.precepto}</p>}
                              {inf.responsable && <p className="text-xs text-gray-600"><span className="font-medium">Responsable:</span> {inf.responsable}</p>}
                              {sancion
                                ? <p className="text-xs text-gray-600"><span className="font-medium">Sanción:</span> {sancion}</p>
                                : <p className="text-xs text-gray-400 italic">Cuantía pendiente de cotejo (no consta en el material)</p>}
                              {inf.justificacion_sancion && <p className="text-xs text-gray-500 italic">{inf.justificacion_sancion}</p>}
                              {inf.organo_sancionador && <p className="text-xs text-gray-600"><span className="font-medium">Órgano:</span> {inf.organo_sancionador}{inf.precepto_organo ? ` (${inf.precepto_organo})` : ''}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Indicios penales */}
                {sm.indicios_penales?.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">3. Posibles ilícitos penales (indicios)</p>
                    <div className="space-y-3">
                      {sm.indicios_penales.map((ind, i) => (
                        <div key={i} className="border border-purple-100 bg-purple-50 rounded-xl p-4">
                          <div className="flex items-start gap-2 mb-1">
                            <ShieldAlert size={15} className="text-purple-500 shrink-0 mt-0.5" />
                            <p className="text-sm font-medium text-purple-900">{ind.tipo_penal_indiciario}</p>
                          </div>
                          {ind.descripcion && <p className="text-xs text-purple-800">{ind.descripcion}</p>}
                          {ind.presunto_autor && <p className="text-xs text-purple-700 mt-1"><span className="font-medium">Presunto autor:</span> {ind.presunto_autor}</p>}
                          {ind.diligencias && <p className="text-xs text-purple-700 mt-1"><span className="font-medium">Diligencias:</span> {ind.diligencias}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Actuación policial */}
                {(apartadosActuacion.length > 0 || ap.documentacion?.length > 0) && (
                  <div className="mb-6">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">4. Actuación policial</p>
                    <div className="space-y-2">
                      {apartadosActuacion.map(([k, v]) => (
                        <div key={k} className="text-sm text-gray-700">
                          <span className="font-medium text-gray-800">{k}:</span> {v}
                        </div>
                      ))}
                    </div>
                    {ap.documentacion?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">Documentación generada</p>
                        <div className="space-y-2">
                          {ap.documentacion.map((doc, i) => (
                            <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-4 py-2">
                              <span className="text-gray-700">{doc.documento}</span>
                              <span className="text-xs text-gray-400">{doc.organismo_destino}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Respuesta teórica */}
                {sm.respuesta_teorica?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">5. Respuesta a las preguntas teóricas</p>
                    <div className="space-y-3">
                      {sm.respuesta_teorica.map((rt, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-4">
                          <p className="text-sm font-medium text-gray-800 flex items-start gap-2">
                            <FileText size={14} className="text-policial-azul shrink-0 mt-0.5" />
                            {rt.pregunta}
                          </p>
                          {rt.respuesta && <p className="text-sm text-gray-700 mt-2">{rt.respuesta}</p>}
                          {rt.articulos?.length > 0 && (
                            <p className="text-xs text-gray-500 mt-2"><span className="font-medium">Artículos:</span> {rt.articulos.join(', ')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
