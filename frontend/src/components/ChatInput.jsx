import { useEffect, useImperativeHandle, useRef, useState } from "react";

import { SendIcon, StopIcon } from "./icons.jsx";

export function ChatInput({ onSend, onCancel, isLoading, ref }) {
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);

  // Permite que App rellene el input desde las sugerencias del estado
  // vacío. Exponemos solo lo que hace falta, no el nodo entero.
  useImperativeHandle(ref, () => ({
    fill(value) {
      setText(value);
      textareaRef.current?.focus();
    },
  }));

  // El textarea crece con el contenido hasta el máximo que fija el CSS.
  // Hay que resetear a "auto" primero: si no, scrollHeight nunca baja
  // al borrar texto y la caja se quedaría grande.
  useEffect(() => {
    const el = textareaRef.current;

    if (!el) {
      return;
    }

    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  // Devolvemos el foco al terminar de cargar, para poder seguir
  // escribiendo sin tocar el ratón.
  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus();
    }
  }, [isLoading]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!text.trim() || isLoading) {
      return;
    }

    onSend(text);
    setText("");
  };

  const handleKeyDown = (event) => {
    // Enter envía; Shift+Enter hace salto de línea, como en ChatGPT.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const canSend = text.trim().length > 0;

  return (
    <form
      className={`composer ${isFocused ? "composer--focused" : ""}`}
      onSubmit={handleSubmit}
    >
      <textarea
        ref={textareaRef}
        className="composer__input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={
          isLoading ? "Esperando respuesta…" : "Escribí tu mensaje…"
        }
        rows={1}
        disabled={isLoading}
        aria-label="Mensaje"
      />

      {isLoading ? (
        <button
          type="button"
          className="send-btn send-btn--cancel"
          onClick={onCancel}
          aria-label="Detener generación"
          title="Detener"
        >
          <StopIcon />
        </button>
      ) : (
        <button
          type="submit"
          className="send-btn"
          disabled={!canSend}
          aria-label="Enviar mensaje"
          title="Enviar"
        >
          <SendIcon />
        </button>
      )}
    </form>
  );
}
