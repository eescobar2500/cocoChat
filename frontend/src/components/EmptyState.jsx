// Ilustración original COMPLETA, solo optimizada a WebP: es la misma
// imagen que boot.png, sin recortes ni reencuadres. Por eso el contenedor
// es rectangular y no circular.
import ilustracion from "../assets/img/yvr-hero.webp";

// Sugerencias de arranque. Un campo vacío intimida; estas dan un punto de
// partida y, sobre todo, muestran de qué sabe el asistente.
const PROMPTS = [
  "¿Cómo me registro?",
  "¿En qué bancos puedo depositar?",
  "¿Cuánto gano por cada recarga?",
];

export function EmptyState({ onPick }) {
  return (
    <div className="empty">
      {/* Luz ambiental detrás de la ilustración: un degradado
          desenfocado, sin bordes, que da la sensación de que el robot
          ilumina el fondo. */}
      <div className="hero-glow" aria-hidden="true" />

      <div className="hero-art" aria-hidden="true">
        <img
          className="hero-art__img"
          src={ilustracion}
          alt=""
          width={1536}
          height={1024}
        />
      </div>

      <h2 className="empty__title">¿En qué te ayudo?</h2>

      <p className="empty__hint">
        Preguntame sobre registro, depósitos, comisiones o soporte de
        YoVendoRecarga.
      </p>

      <div className="empty__prompts">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="prompt-chip"
            onClick={() => onPick(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
