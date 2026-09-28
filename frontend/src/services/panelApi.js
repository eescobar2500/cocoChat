// Cliente del panel de administración (sesión de usuario, no API key).
// Igual que chatApi.js: es la única capa que conoce las rutas del backend.

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const TOKEN_KEY = "cocochat.panel.token";

export class PanelApiError extends Error {
  constructor(message, statusCode) {
    super(message);

    this.name = "PanelApiError";
    this.statusCode = statusCode;
  }
}

export const session = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

async function request(method, path, { body, auth = true } = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth && session.get() && { Authorization: `Bearer ${session.get()}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new PanelApiError("No se pudo conectar con el servidor", 0);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && auth) {
      session.clear();
    }

    throw new PanelApiError(data?.message ?? "Ocurrió un error inesperado", response.status);
  }

  return data;
}

export const login = (email, password, organization) =>
  request("POST", "/api/auth/login", { body: { email, password, organization }, auth: false });

export const getMe = () => request("GET", "/api/organization");

export const listAgents = () => request("GET", "/api/organization/agents");
export const getAgent = (id) => request("GET", `/api/organization/agents/${id}`);
export const createAgent = (input) => request("POST", "/api/organization/agents", { body: input });
export const updateAgent = (id, input) =>
  request("PATCH", `/api/organization/agents/${id}`, { body: input });
export const archiveAgent = (id) => request("DELETE", `/api/organization/agents/${id}`);

export const listConfigurations = (agentId) =>
  request("GET", `/api/organization/agents/${agentId}/configurations`);
export const createConfiguration = (agentId, input) =>
  request("POST", `/api/organization/agents/${agentId}/configurations`, { body: input });
export const publishConfiguration = (agentId, configurationId) =>
  request("POST", `/api/organization/agents/${agentId}/configurations/${configurationId}/publish`);

export const testChat = (agentId, input) =>
  request("POST", `/api/organization/agents/${agentId}/chat`, { body: input });

export const listConversations = (agentId) =>
  request("GET", `/api/organization/conversations${agentId ? `?agentId=${agentId}` : ""}`);
export const getConversation = (id) => request("GET", `/api/organization/conversations/${id}`);
