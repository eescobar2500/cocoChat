import { useEffect, useRef, useState } from "react";

// Muestra el consumo de tokens del último turno.
//
// No es decorativo: hace visible que `input_tokens` crece turno a turno
// aunque escribas mensajes igual de cortos. Ese aumento es el historial
// reenviándose, que es lo que sostiene la "memoria" de la conversación.
export function UsageBar({ usage }) {
  const [flash, setFlash] = useState(false);

  // Guardamos el valor del turno anterior para poder compararlo.
  // useRef y no useState: cambiarlo no debe provocar un re-render.
  const previousInput = useRef(null);

  const inputTokens = usage?.input_tokens ?? null;

  useEffect(() => {
    if (inputTokens === null) {
      return;
    }

    const previous = previousInput.current;
    previousInput.current = inputTokens;

    // En el primer turno no hay con qué comparar: no destellamos.
    if (previous === null || previous === inputTokens) {
      return;
    }

    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 700);

    // Limpiamos el timer si llega otro valor antes de que termine
    // o si el componente se desmonta.
    return () => clearTimeout(timer);
  }, [inputTokens]);

  if (!usage) {
    return null;
  }

  return (
    <div className="usage" title="Tokens consumidos en el último turno">
      <span className="usage__item">
        <span>entrada</span>
        <strong className={`usage__value ${flash ? "usage__value--flash" : ""}`}>
          {usage.input_tokens}
        </strong>
      </span>

      <span className="usage__sep" aria-hidden="true" />

      <span className="usage__item">
        <span>salida</span>
        <strong className="usage__value">{usage.output_tokens}</strong>
      </span>
    </div>
  );
}
