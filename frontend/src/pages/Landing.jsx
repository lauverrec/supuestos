import { Link } from 'react-router-dom';
import { Shield, BookOpen, Target, TrendingUp, ChevronDown, CheckCircle } from 'lucide-react';
import { useState } from 'react';

const faqs = [
  {
    pregunta: '¿Quién crea los supuestos?',
    respuesta: 'Los supuestos están supervisados por un Policía Local de Andalucía en activo con amplia experiencia en oposiciones. Todo el contenido está basado en normativa real y actualizada.'
  },
  {
    pregunta: '¿Cuántos supuestos puedo hacer gratis?',
    respuesta: 'El plan gratuito incluye 3 supuestos prácticos completos con corrección automática y solución modelo. Sin tarjeta de crédito.'
  },
  {
    pregunta: '¿Puedo cancelar en cualquier momento?',
    respuesta: 'Sí. Sin permanencia ni compromiso. Puedes cancelar tu suscripción cuando quieras desde tu perfil.'
  },
  {
    pregunta: '¿Qué materias están disponibles?',
    respuesta: 'Actualmente cubrimos Policía Administrativa, Tráfico y Seguridad Ciudadana. Seguimos ampliando el catálogo regularmente.'
  },
  {
    pregunta: '¿Cómo funciona la corrección automática?',
    respuesta: 'Una vez envías tu respuesta, el sistema la compara con la solución modelo e identifica infracciones correctas, omitidas y erróneas, con el precepto exacto, la sanción y el órgano sancionador.'
  },
];

function FAQ({ pregunta, respuesta }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="border-b border-gray-100 py-4">
      <button
        onClick={() => setAbierta(!abierta)}
        className="w-full flex items-center justify-between text-left gap-4"
      >
        <span className="font-medium text-gray-800 text-sm">{pregunta}</span>
        <ChevronDown
          size={18}
          className={`text-gray-400 shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`}
        />
      </button>
      {abierta && (
        <p className="text-sm text-gray-500 mt-3 leading-relaxed">{respuesta}</p>
      )}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">

      {/* Navbar */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-policial-azul text-lg">
            <Shield size={22} />
            PolicialMVP
          </div>
          <div className="flex items-center gap-6">
            <a href="#como-funciona" className="text-sm text-gray-500 hover:text-gray-800">Cómo funciona</a>
            <a href="#precios" className="text-sm text-gray-500 hover:text-gray-800">Precios</a>
            <a href="#faq" className="text-sm text-gray-500 hover:text-gray-800">FAQ</a>
            <Link
              to="/dashboard"
              className="bg-policial-azul text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-policial-azulMedio transition-colors"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <span className="inline-block bg-policial-azulClaro text-policial-azul text-xs font-bold px-3 py-1 rounded-full mb-6">
          Supervisado por un Policía Local en activo
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Supuestos prácticos para<br />
          <span className="text-policial-azul">Policía Local de Andalucía</span>
        </h1>
        <p className="text-lg text-gray-500 mb-10 max-w-2xl mx-auto">
          Practica con supuestos reales, recibe corrección detallada por infracción y llega al examen con la máxima preparación.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/dashboard"
            className="bg-policial-azul text-white font-bold px-8 py-4 rounded-xl text-lg hover:bg-policial-azulMedio transition-colors shadow-lg"
          >
            Empezar gratis
          </Link>

          <a href="#como-funciona"
            className="text-policial-azul font-medium px-6 py-4 rounded-xl hover:bg-policial-azulClaro transition-colors"
          >
            Ver cómo funciona →
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-4">3 supuestos gratis · Sin tarjeta de crédito</p>
      </div>

      {/* Cómo funciona */}
      <div id="como-funciona" className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Cómo funciona</h2>
          <p className="text-center text-gray-500 mb-12">En tres pasos, de la práctica al examen.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                numero: '01',
                titulo: 'Elige tu supuesto',
                desc: 'Selecciona materia, dificultad y formato. El sistema genera un supuesto original basado en normativa real.',
                icon: BookOpen,
              },
              {
                numero: '02',
                titulo: 'Resuelve y envía',
                desc: 'Desarrolla tu respuesta como en el examen real: infracciones, sanciones, órgano sancionador y actuación policial.',
                icon: Target,
              },
              {
                numero: '03',
                titulo: 'Recibe tu corrección',
                desc: 'Corrección detallada por infracción con nota, puntos fuertes, errores y solución modelo completa.',
                icon: TrendingUp,
              },
            ].map(({ numero, titulo, desc, icon: Icon }) => (
              <div key={numero} className="text-center">
                <div className="w-12 h-12 bg-policial-azul text-white rounded-2xl flex items-center justify-center font-bold text-lg mx-auto mb-4">
                  {numero}
                </div>
                <h3 className="font-bold text-gray-800 mb-2">{titulo}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Precios */}
      <div id="precios" className="py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Precios</h2>
          <p className="text-gray-500 mb-12">Empieza gratis. Sin compromisos.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              {
                nombre: 'Gratuito',
                precio: '0€',
                caracteristicas: ['3 supuestos prácticos', 'Corrección automática', 'Solución modelo'],
                cta: 'Empezar gratis',
                href: '/dashboard',
                destacado: false,
              },
              {
                nombre: 'Mensual',
                precio: '14,99€/mes',
                caracteristicas: ['Supuestos ilimitados', 'Corrección automática', 'Solución modelo', 'Todas las materias', 'Historial completo'],
                cta: 'Empezar ahora',
                href: '/precios',
                destacado: true,
              },
              {
                nombre: 'Anual',
                precio: '149€/año',
                caracteristicas: ['Supuestos ilimitados', 'Corrección automática', 'Solución modelo', 'Todas las materias', 'Historial completo', '2 meses gratis'],
                cta: 'Empezar ahora',
                href: '/precios',
                destacado: false,
              },
            ].map((plan) => (
              <div key={plan.nombre} className={`rounded-2xl border p-6 ${plan.destacado ? 'border-policial-azul shadow-lg' : 'border-gray-100'}`}>
                {plan.destacado && (
                  <span className="text-xs font-bold text-policial-azul bg-policial-azulClaro px-2 py-1 rounded-full mb-3 inline-block">Más popular</span>
                )}
                <h3 className="font-bold text-gray-800 mb-1">{plan.nombre}</h3>
                <p className="text-2xl font-bold text-policial-azul mb-4">{plan.precio}</p>
                <ul className="space-y-2 mb-6">
                  {plan.caracteristicas.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle size={14} className="text-green-500 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.href}
                  className={`block text-center font-bold py-3 rounded-xl transition-colors ${plan.destacado
                      ? 'bg-policial-azul text-white hover:bg-policial-azulMedio'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="bg-gray-50 py-20">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Preguntas frecuentes</h2>
          <div>
            {faqs.map((faq, i) => (
              <FAQ key={i} {...faq} />
            ))}
          </div>
        </div>
      </div>

      {/* CTA final */}
      <div className="bg-policial-azul py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Empieza a practicar hoy</h2>
          <p className="text-blue-200 mb-8">3 supuestos gratis. Sin tarjeta de crédito.</p>
          <Link
            to="/dashboard"
            className="inline-block bg-white text-policial-azul font-bold px-8 py-4 rounded-xl text-lg hover:bg-blue-50 transition-colors shadow-lg"
          >
            Crear cuenta gratis
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-2 font-bold text-policial-azul">
            <Shield size={16} />
            PolicialMVP
          </div>
          <p>© 2025 PolicialMVP. Todos los derechos reservados.</p>
        </div>
      </footer>

    </div>
  );
}