// Mantiene la misma estructura que Message para que el indicador
// aparezca exactamente donde va a aparecer la respuesta: así no hay
// salto visual cuando el texto real la reemplaza.
export function TypingIndicator() {
  return (
    <article className="message message--assistant">
      <div className="message__avatar" aria-hidden="true">
        YVR
      </div>

      <div className="message__body">
        <div className="message__meta">
          <span>YVR Assistant</span>
        </div>

        <div className="message__bubble">
          {/* Los puntos son decorativos; el texto accesible va en el
              aria-label para que un lector de pantalla lo anuncie. */}
          <span className="typing" role="status" aria-label="Generando respuesta">
            <span className="typing__dot" />
            <span className="typing__dot" />
            <span className="typing__dot" />
          </span>
        </div>
      </div>
    </article>
  );
}
