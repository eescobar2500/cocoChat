import { useCallback, useEffect, useState } from "react";

import * as api from "../services/panelApi.js";

import { AgentEditor } from "./AgentEditor.jsx";
import { LoginForm } from "./LoginForm.jsx";

import "./panel.css";

// Panel mínimo de administración (Etapa 2): entrar, ver los agentes de la
// organización, editar instrucciones como nueva versión, publicar, volver
// a una versión anterior y probar el agente. Sin router: vive en `#/panel`.
export default function Panel() {
  const [me, setMe] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(api.session.get()));
  const [showArchived, setShowArchived] = useState(false);

  const loadAgents = useCallback(async () => {
    const { agents: list } = await api.listAgents({ includeArchived: showArchived });

    setAgents(list);
    setSelectedId((current) =>
      list.some((agent) => agent.id === current) ? current : (list[0]?.id ?? null)
    );
  }, [showArchived]);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getMe();

      setMe(data);
      await loadAgents();
    } catch (err) {
      setMe(null);

      if (err.statusCode !== 401) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [loadAgents]);

  useEffect(() => {
    if (api.session.get()) {
      loadSession();
    }
  }, [loadSession]);

  const handleArchived = async () => {
    setShowArchived(true);
    const { agents: list } = await api.listAgents({ includeArchived: true });

    setAgents(list);
  };

  const handleLogin = async (credentials) => {
    const { token } = await api.login(
      credentials.email,
      credentials.password,
      credentials.organization
    );

    api.session.set(token);
    await loadSession();
  };

  const handleLogout = () => {
    api.session.clear();
    setMe(null);
    setAgents([]);
    setSelectedId(null);
  };

  const handleCreate = async () => {
    const name = window.prompt("Nombre del agente");

    if (!name) {
      return;
    }

    try {
      const { agent } = await api.createAgent({
        name,
        instructions: "Eres un asistente útil y conciso. Respondes en el idioma en que te escriban.",
      });

      await loadAgents();
      setSelectedId(agent.id);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!me) {
    return (
      <div className="panel panel--center">
        <LoginForm onSubmit={handleLogin} busy={loading} />
        {error && <p className="panel-error">{error}</p>}
      </div>
    );
  }

  const canManage = me.role === "owner" || me.role === "admin";
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;

  return (
    <div className="panel">
      <header className="panel-header">
        <div>
          <h1 className="panel-title">{me.organization.name}</h1>
          <p className="panel-subtitle">
            Panel de agentes · {me.role}
          </p>
        </div>
        <nav className="panel-nav">
          <a href="#/" className="panel-link">Chat</a>
          <button type="button" className="panel-button panel-button--ghost" onClick={handleLogout}>
            Salir
          </button>
        </nav>
      </header>

      {error && (
        <p className="panel-error" role="alert">
          {error}{" "}
          <button type="button" className="panel-link" onClick={() => setError(null)}>
            cerrar
          </button>
        </p>
      )}

      <div className="panel-body">
        <aside className="panel-sidebar">
          <div className="panel-sidebar-head">
            <h2>Agentes</h2>
            {canManage && (
              <button type="button" className="panel-button panel-button--small" onClick={handleCreate}>
                + Nuevo
              </button>
            )}
          </div>

          {agents.length === 0 && (
            <p className="panel-muted">Todavía no hay agentes. Creá el primero.</p>
          )}

          <label className="panel-check">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            <span>Mostrar archivados</span>
          </label>

          <ul className="panel-agent-list">
            {agents.map((agent) => (
              <li key={agent.id}>
                <button
                  type="button"
                  className={`panel-agent${agent.id === selectedId ? " is-selected" : ""}`}
                  onClick={() => setSelectedId(agent.id)}
                >
                  <span className="panel-agent-name">{agent.name}</span>
                  <span className={`panel-badge panel-badge--${agent.status}`}>
                    {agent.status === "published"
                      ? `v${agent.activeConfiguration?.version} publicada`
                      : agent.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="panel-main">
          {selected ? (
            <AgentEditor
              key={selected.id}
              agent={selected}
              canManage={canManage}
              onChanged={loadAgents}
              onArchived={handleArchived}
              onError={setError}
            />
          ) : (
            <p className="panel-muted">Seleccioná un agente para editarlo.</p>
          )}
        </main>
      </div>
    </div>
  );
}
