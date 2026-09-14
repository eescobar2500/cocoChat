import { useRef } from "react";

import { AIBackground } from "./components/AIBackground.jsx";
import { ChatInput } from "./components/ChatInput.jsx";
import { MessageList } from "./components/MessageList.jsx";
import { UsageBar } from "./components/UsageBar.jsx";
import { AlertIcon, TrashIcon } from "./components/icons.jsx";
import { useChat } from "./hooks/useChat.js";

// Versión pequeña del avatar, generada al tamaño exacto del header
// para que se vea nítida y no cargue la ilustración grande.
import avatar from "./assets/img/yvr-avatar-sm.webp";

import "./App.css";

// App solo compone: toda la lógica vive en useChat y los componentes son de
// presentación. Así se puede probar el hook sin renderizar nada, y reutilizar
// los componentes con otra fuente de datos.
export default function App() {
  const { messages, isLoading, error, usage, sendMessage, cancel, clearChat } =
    useChat();

  // Referencia al contenedor con scroll: MessageList la necesita para
  // saber si el usuario está al final antes de auto-scrollear.
  const scrollRef = useRef(null);

  // Referencia al input, para rellenarlo desde las sugerencias.
  const inputRef = useRef(null);

  // Estado visible en el header. Un solo indicador cubre los tres casos.
  const status = isLoading ? "busy" : error ? "error" : "idle";
  const statusLabel = {
    busy: "Pensando…",
    error: "Error",
    idle: "En línea",
  }[status];

  const handleClear = () => {
    // Confirmamos solo si hay algo que perder. Preguntar siempre
    // sería molesto; no preguntar nunca, arriesgado.
    if (messages.length > 0 && !window.confirm("¿Borrar la conversación?")) {
      return;
    }

    clearChat();
  };

  return (
    <>
      {/* Fondo ambiental. Va fuera de .app para cubrir toda la ventana,
          no solo la columna central donde vive el chat. */}
      <AIBackground />

      <div className="app">
        <header className="header">
          <div className="brand">
            {/* El robot en pequeño: refuerza la identidad mejor que un
                cuadrado con iniciales. */}
            <div className="avatar avatar--sm" aria-hidden="true">
              <img
                className="avatar__img"
                src={avatar}
                alt=""
                width={128}
                height={128}
              />
            </div>

            <div className="brand__text">
              <h1 className="brand__title">YVR Assistant</h1>

              <span className={`brand__status brand__status--${status}`}>
                <span className="brand__dot" aria-hidden="true" />
                {statusLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn"
            onClick={handleClear}
            disabled={messages.length === 0 || isLoading}
          >
            <TrashIcon className="btn__icon" />
            Limpiar
          </button>
        </header>

        <main className="main" ref={scrollRef}>
          <MessageList
            messages={messages}
            isLoading={isLoading}
            scrollRef={scrollRef}
            onPickPrompt={(prompt) => inputRef.current?.fill(prompt)}
          />
        </main>

        <footer className="footer">
          {error && (
            <div className="error" role="alert">
              <AlertIcon className="error__icon" />
              <span className="error__text">{error}</span>
            </div>
          )}

          <ChatInput
            ref={inputRef}
            onSend={sendMessage}
            onCancel={cancel}
            isLoading={isLoading}
          />

          <div className="composer-meta">
            <span className="hint">
              <kbd>Enter</kbd> enviar
              <span aria-hidden="true">·</span>
              <kbd>Shift</kbd>
              <kbd>Enter</kbd> nueva línea
            </span>

            <UsageBar usage={usage} />
          </div>
        </footer>
      </div>
    </>
  );
}
