import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CheckIcon, CopyIcon } from "./icons.jsx";

// Los enlaces del agente se abren en pestaña nueva para no perder el chat.
// rel="noreferrer" evita que la página destino acceda a window.opener.
//
// Descartamos `node` (el nodo del árbol de Markdown que pasa react-markdown):
// si no, acabaría en el DOM como un atributo node="[object Object]".
const components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
};

// Componente de presentación: recibe props y pinta.
// El único estado que tiene es el "copiado", que es puramente visual
// y no le importa a nadie fuera de este componente.
export function Message({ role, content }) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Copiamos el Markdown original, no el texto renderizado: es lo que
      // el usuario esperaría pegar en otro sitio.
      await navigator.clipboard.writeText(content);
      setCopied(true);
      // Volvemos al icono normal tras un momento: confirma la acción
      // sin dejar la interfaz en un estado raro.
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // El portapapeles puede estar bloqueado (permisos, http sin
      // certificado). No es crítico: el mensaje sigue en pantalla.
    }
  };

  return (
    <article className={`message message--${role}`}>
      <div className="message__avatar" aria-hidden="true">
        {isUser ? "TÚ" : "YVR"}
      </div>

      <div className="message__body">
        <div className="message__meta">
          <span>{isUser ? "Vos" : "YVR Assistant"}</span>

          <span className="message__actions">
            <button
              type="button"
              className={`icon-btn ${copied ? "icon-btn--done" : ""}`}
              onClick={handleCopy}
              aria-label={copied ? "Copiado" : "Copiar mensaje"}
              title={copied ? "Copiado" : "Copiar"}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </span>
        </div>

        <div className="message__bubble">
          {isUser ? (
            // Lo que escribe el usuario se muestra tal cual: si escribiera
            // algo con asteriscos no queremos interpretarlo como formato.
            content
          ) : (
            // El agente responde en Markdown (negritas, listas, enlaces).
            // react-markdown escapa el HTML por defecto, así que una
            // respuesta con etiquetas se ve como texto, no se ejecuta.
            <Markdown remarkPlugins={[remarkGfm]} components={components}>
              {content}
            </Markdown>
          )}
        </div>
      </div>
    </article>
  );
}
