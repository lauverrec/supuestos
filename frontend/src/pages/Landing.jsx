import { Link } from 'react-router-dom';
import { Shield, Brain, Target, TrendingUp } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-policial-azul to-policial-azulMedio text-white">
      
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="flex justify-center mb-6">
          <Shield size={64} className="text-policial-azulClaro" />
        </div>
        <h1 className="text-4xl font-bold mb-4 leading-tight">
          Supuestos prácticos para<br />Policía Local de Andalucía
        </h1>
        <p className="text-lg text-blue-200 mb-10 max-w-2xl mx-auto">
          Generador de supuestos con IA basado en normativa real. 
          Corrección automática con feedback de nivel tribunal.
        </p>
        <Link
          to="/generar"
          className="inline-block bg-white text-policial-azul font-bold px-8 py-4 rounded-xl text-lg hover:bg-blue-50 transition-colors shadow-lg"
        >
          Empezar a practicar
        </Link>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: Brain,
            titulo: 'IA especializada',
            desc: 'Supuestos generados con normativa andaluza real. Nunca el mismo supuesto dos veces.',
          },
          {
            icon: Target,
            titulo: 'Corrección de tribunal',
            desc: 'Feedback detallado por infracción: artículo, calificación, sanción exacta y órgano.',
          },
          {
            icon: TrendingUp,
            titulo: 'Progreso medible',
            desc: 'Detecta tus puntos débiles y te dice exactamente qué normativa repasar.',
          },
        ].map(({ icon: Icon, titulo, desc }) => (
          <div key={titulo} className="bg-white bg-opacity-10 rounded-xl p-6 backdrop-blur">
            <Icon size={32} className="text-policial-azulClaro mb-3" />
            <h3 className="font-bold text-lg mb-2">{titulo}</h3>
            <p className="text-blue-200 text-sm">{desc}</p>
          </div>
        ))}
      </div>

    </div>
  );
}