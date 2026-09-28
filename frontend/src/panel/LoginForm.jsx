import { useState } from "react";

export function LoginForm({ onSubmit, busy }) {
  const [form, setForm] = useState({ email: "", password: "", organization: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="panel-card panel-login" onSubmit={handleSubmit}>
      <h1 className="panel-title">CocoChat · Panel</h1>
      <p className="panel-subtitle">Entrá con tu usuario y el identificador de tu organización.</p>

      <label className="panel-field">
        <span>Organización (slug)</span>
        <input
          type="text"
          value={form.organization}
          onChange={update("organization")}
          autoComplete="organization"
          required
        />
      </label>

      <label className="panel-field">
        <span>Correo</span>
        <input
          type="email"
          value={form.email}
          onChange={update("email")}
          autoComplete="username"
          required
        />
      </label>

      <label className="panel-field">
        <span>Contraseña</span>
        <input
          type="password"
          value={form.password}
          onChange={update("password")}
          autoComplete="current-password"
          required
        />
      </label>

      {error && <p className="panel-error" role="alert">{error}</p>}

      <button type="submit" className="panel-button" disabled={submitting || busy}>
        {submitting || busy ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
