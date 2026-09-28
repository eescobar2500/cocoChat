import { useState } from "react";

import * as api from "../services/panelApi.js";

// Chat de prueba del panel. Permite hablar con cualquier versión (incluso
// un borrador) sin publicarla; con "versión publicada" reproduce lo que ve
// un cliente por API key. Las conversaciones quedan guardadas con canal
// `panel`, así que se distinguen de las reales.
export function TestChat({ agent, versions, versionId, onVersionChange, onError }) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMessages([]);
    setConversationId(null);
  };

  const handleVersion = (event) => {
    onVersionChange(event.target.value || null);
    reset();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const message = input.trim();

    if (!message || busy) {
      return;
    }

    setInput("");
    setBusy(true);
    setMessages((current) => [...current, { role: "user", content: message }]);

    try {
      const result = await api.testChat(agent.id, {
        message,
        ...(conversationId && { conversationId }),
        ...(versionId && { configurationId: versionId }),
      });

      setConversationId(result.conversationId);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.reply,
          meta: `v${result.configurationVersion}${
            result.usage?.total_tokens ? ` · ${result.usage.total_tokens} tokens` : ""
          }`,
        },
      ]);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const canUsePublished = agent.status === "published";

  return (
    <section className="panel-card panel-test">
      <div className="panel-test-head">
        <h3>Probar</h3>
        <label className="panel-field panel-field--inline">
          <span>Versión</span>
          <select value={versionId ?? ""} onChange={handleVersion}>
            <option value="" disabled={!canUsePublished}>
              {canUsePublished ? "Publicada" : "Publicada (no hay)"}
            </option>
            {versions.map((configuration) => (
              <option key={configuration.id} value={configuration.id}>
                v{configuration.version}
              </option>
            ))}
          </select>
        </label>
        {messages.length > 0 && (
          <button type="button" className="panel-link" onClick={reset}>
            Nueva conversación
          </button>
        )}
      </div>

      <div className="panel-test-messages">
        {messages.length === 0 && (
          <p className="panel-muted">
            Escribí un mensaje para probar el agente. Hace falta una clave de OpenAI cargada en
            la organización.
          </p>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`panel-msg panel-msg--${message.role}`}>
            <p>{message.content}</p>
            {message.meta && <span className="panel-msg-meta">{message.meta}</span>}
          </div>
        ))}
        {busy && <p className="panel-muted">Pensando…</p>}
      </div>

      <form className="panel-test-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            !canUsePublished && !versionId
              ? "Elegí una versión para probar"
              : "Mensaje de prueba…"
          }
          disabled={busy || (!canUsePublished && !versionId)}
        />
        <button
          type="submit"
          className="panel-button"
          disabled={busy || !input.trim() || (!canUsePublished && !versionId)}
        >
          Enviar
        </button>
      </form>
    </section>
  );
}
