import { useCallback, useEffect, useState } from "react";

import * as api from "../services/panelApi.js";

import { TestChat } from "./TestChat.jsx";

const formatDate = (value) =>
  value ? new Date(value).toLocaleString() : "—";

// Edición de un agente: cada guardado crea una versión nueva (las
// configuraciones son inmutables), y publicar/volver mueven el puntero
// `activeConfiguration`. Lo que responde el chat con API key es siempre la
// versión publicada; acá se puede probar cualquier versión sin publicarla.
export function AgentEditor({ agent, canManage, onChanged, onArchived, onError }) {
  const [versions, setVersions] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testVersionId, setTestVersionId] = useState(null);

  const loadVersions = useCallback(async () => {
    try {
      const { configurations } = await api.listConfigurations(agent.id);

      setVersions(configurations);
      setForm((current) => current ?? fromConfiguration(configurations[0]));
    } catch (err) {
      onError(err.message);
    }
  }, [agent.id, onError]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  if (!form) {
    return <p className="panel-muted">Cargando…</p>;
  }

  const latest = versions[0];
  const dirty =
    form.instructions !== latest?.instructions ||
    form.model !== latest?.model ||
    form.temperature !== paramString(latest?.params?.temperature);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const run = async (action, refresh = onChanged) => {
    setSaving(true);

    try {
      await action();
      await Promise.all([loadVersions(), refresh()]);
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () =>
    run(async () => {
      const params = {};

      if (form.temperature !== "") {
        params.temperature = Number(form.temperature);
      }

      const { configuration } = await api.createConfiguration(agent.id, {
        instructions: form.instructions,
        model: form.model,
        params,
      });

      setForm(fromConfiguration(configuration));
    });

  const handlePublish = (configurationId) =>
    run(() => api.publishConfiguration(agent.id, configurationId));

  const handleArchive = () => {
    if (!window.confirm(`¿Archivar "${agent.name}"? Dejará de responder en el chat.`)) {
      return;
    }

    run(() => api.archiveAgent(agent.id), onArchived);
  };

  const handleRename = () => {
    const name = window.prompt("Nuevo nombre", agent.name);

    if (name && name !== agent.name) {
      run(() => api.updateAgent(agent.id, { name }));
    }
  };

  const isArchived = agent.status === "archived";

  return (
    <div className="panel-editor">
      <div className="panel-editor-head">
        <div>
          <h2 className="panel-agent-title">{agent.name}</h2>
          <p className="panel-muted">
            {agent.status === "published"
              ? `Publicada la versión ${agent.activeConfiguration?.version}`
              : isArchived
                ? `Archivado el ${formatDate(agent.archivedAt)}`
                : "Sin publicar: el chat con API key no lo usa todavía"}
          </p>
        </div>
        {canManage && !isArchived && (
          <div className="panel-actions">
            <button type="button" className="panel-button panel-button--ghost" onClick={handleRename}>
              Renombrar
            </button>
            <button type="button" className="panel-button panel-button--danger" onClick={handleArchive}>
              Archivar
            </button>
          </div>
        )}
      </div>

      <div className="panel-columns">
        <section className="panel-card">
          <h3>Instrucciones</h3>

          <label className="panel-field">
            <span>Instrucciones del sistema</span>
            <textarea
              rows={12}
              value={form.instructions}
              onChange={update("instructions")}
              disabled={!canManage || isArchived}
            />
          </label>

          <div className="panel-row">
            <label className="panel-field">
              <span>Modelo</span>
              <input
                type="text"
                value={form.model}
                onChange={update("model")}
                disabled={!canManage || isArchived}
              />
            </label>
            <label className="panel-field">
              <span>Temperatura (0–2)</span>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={form.temperature}
                onChange={update("temperature")}
                disabled={!canManage || isArchived}
              />
            </label>
          </div>

          {canManage && !isArchived && (
            <button
              type="button"
              className="panel-button"
              onClick={handleSave}
              disabled={saving || !dirty || !form.instructions.trim()}
            >
              {saving ? "Guardando…" : `Guardar como versión ${(latest?.version ?? 0) + 1}`}
            </button>
          )}
        </section>

        <section className="panel-card">
          <h3>Versiones</h3>
          <ul className="panel-versions">
            {versions.map((configuration) => {
              const isActive = configuration.id === agent.activeConfigurationId;

              return (
                <li key={configuration.id} className={isActive ? "is-active" : ""}>
                  <div className="panel-version-head">
                    <strong>v{configuration.version}</strong>
                    <span className="panel-muted">{configuration.model}</span>
                    {isActive && <span className="panel-badge panel-badge--published">publicada</span>}
                  </div>
                  <p className="panel-version-preview">{configuration.instructions}</p>
                  <div className="panel-version-foot">
                    <span className="panel-muted">{formatDate(configuration.createdAt)}</span>
                    <div className="panel-actions">
                      <button
                        type="button"
                        className="panel-link"
                        onClick={() => setForm(fromConfiguration(configuration))}
                      >
                        Cargar en el editor
                      </button>
                      {canManage && !isArchived && !isActive && (
                        <button
                          type="button"
                          className="panel-button panel-button--small"
                          onClick={() => handlePublish(configuration.id)}
                          disabled={saving}
                        >
                          {agent.activeConfiguration &&
                          configuration.version < agent.activeConfiguration.version
                            ? "Volver a esta versión"
                            : "Publicar"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {!isArchived && (
        <TestChat
          agent={agent}
          versions={versions}
          versionId={testVersionId}
          onVersionChange={setTestVersionId}
          onError={onError}
        />
      )}
    </div>
  );
}

const paramString = (value) => (typeof value === "number" ? String(value) : "");

const fromConfiguration = (configuration) => ({
  instructions: configuration?.instructions ?? "",
  model: configuration?.model ?? "",
  temperature: paramString(configuration?.params?.temperature),
});
