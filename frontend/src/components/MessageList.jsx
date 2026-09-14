import { useEffect, useRef } from "react";

import { EmptyState } from "./EmptyState.jsx";
import { Message } from "./Message.jsx";
import { TypingIndicator } from "./TypingIndicator.jsx";

// Margen de tolerancia para considerar que el usuario "está abajo".
// Sin él, un par de píxeles de diferencia contarían como scroll hacia arriba.
const BOTTOM_THRESHOLD = 120;

// `scrollRef` apunta al elemento que hace scroll (.main) y lo pasa App.
// Lo recibimos como prop en vez de buscarlo con parentElement para no
// depender de la estructura del HTML: si cambia el marcado, esto sigue
// funcionando.
export function MessageList({ messages, isLoading, onPickPrompt, scrollRef }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    const bottom = bottomRef.current;
    const container = scrollRef?.current;

    if (!bottom || !container) {
      return;
    }

    // Solo bajamos automáticamente si el usuario ya estaba al final.
    // Si subió a releer algo, respetamos su posición en vez de
    // arrastrarlo hacia abajo cada vez que llega un mensaje.
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (distanceFromBottom <= BOTTOM_THRESHOLD) {
      bottom.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isLoading, scrollRef]);

  if (messages.length === 0 && !isLoading) {
    return <EmptyState onPick={onPickPrompt} />;
  }

  return (
    // role="log" + aria-live: un lector de pantalla anuncia los mensajes
    // nuevos sin que el usuario tenga que buscarlos.
    <div className="messages" role="log" aria-live="polite">
      {messages.map((message, index) => (
        // El índice como key es aceptable acá porque los mensajes solo se
        // añaden al final: nunca se reordenan ni se insertan en el medio.
        <Message key={index} role={message.role} content={message.content} />
      ))}

      {isLoading && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  );
}
