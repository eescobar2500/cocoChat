import { useCallback, useEffect, useRef, useState } from "react";

import { sendChat } from "../services/chatApi.js";

const STORAGE_KEY = "cocochat:conversation";

// Guardamos mensajes y sessionId JUNTOS, en una sola clave. Si se guardaran
// por separado podrían desincronizarse (mensajes en pantalla que el agente
// ya no recuerda, o al revés), y eso confunde mucho al usuario.
function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return { messages: [], sessionId: null };
    }

    const parsed = JSON.parse(raw);

    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      sessionId:
        typeof parsed.sessionId === "string" ? parsed.sessionId : null,
    };
  } catch {
    // localStorage puede fallar (modo privado) o contener JSON corrupto de
    // una versión anterior: preferimos empezar limpio antes que romper la app.
    return { messages: [], sessionId: null };
  }
}

/**
 * Encapsula todo el estado de la conversación.
 *
 * OJO con el cambio de modelo mental respecto a la versión anterior:
 * el array `messages` ya NO es la memoria de la conversación, solo sirve
 * para pintarla en pantalla. La memoria real vive en OpenAI, dentro de una
 * sesión, y lo único que la identifica es el `sessionId`.
 */
export function useChat() {
  // Estado inicial en una sola lectura: así mensajes y sesión siempre
  // arrancan coherentes entre sí.
  const [stored] = useState(loadStored);

  const [messages, setMessages] = useState(stored.messages);
  const [sessionId, setSessionId] = useState(stored.sessionId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usage, setUsage] = useState(null);

  // Guarda la petición en curso para poder cancelarla.
  const abortRef = useRef(null);

  // Persistimos para que la conversación sobreviva a un refresco. El
  // sessionId es lo importante: sin él, el agente no reconocería el hilo
  // y los mensajes en pantalla quedarían huérfanos.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, sessionId }));
    } catch {
      // Sin espacio o en modo privado: la app sigue funcionando en memoria.
    }
  }, [messages, sessionId]);

  // Al desmontar, cancelamos cualquier petición pendiente para no intentar
  // actualizar el estado de un componente que ya no existe.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (text) => {
      const content = text.trim();

      if (!content || isLoading) {
        return;
      }

      const userMessage = { role: "user", content };

      // Pintamos el mensaje del usuario de inmediato, sin esperar la
      // respuesta: la interfaz se siente instantánea aunque el agente tarde
      // (suele tardar 10-20s, porque razona y consulta su conocimiento).
      setMessages((previous) => [...previous, userMessage]);
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Mandamos SOLO el mensaje nuevo + el id de sesión. El historial ya
        // lo tiene OpenAI; no hace falta reenviarlo.
        const data = await sendChat(content, sessionId, {
          signal: controller.signal,
          // El backend solo usa esto en modo de respaldo, donde no hay
          // sesiones del lado del servidor. En modo agentes lo ignora.
          history: messages,
        });

        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: data.reply },
        ]);

        // En el primer turno esto guarda la sesión recién creada; después
        // devuelve la misma, así que la asignación es inocua.
        setSessionId(data.sessionId);
        setUsage(data.usage ?? null);
      } catch (err) {
        // Si el usuario canceló, no es un error que mostrar.
        if (err.name === "AbortError") {
          return;
        }

        setError(err.message);

        // Quitamos el mensaje del usuario que quedó sin respuesta: si se
        // queda en pantalla, la conversación visible no coincidiría con la
        // que el agente tiene guardada.
        setMessages((previous) => previous.slice(0, -1));
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [sessionId, isLoading, messages]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);

    // Descartamos también la sesión: empezar de cero significa que el
    // agente tampoco debe recordar lo anterior. El próximo mensaje creará
    // una sesión nueva.
    setSessionId(null);

    setError(null);
    setUsage(null);
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    error,
    usage,
    sendMessage,
    cancel,
    clearChat,
  };
}
