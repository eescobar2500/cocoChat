import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "../services/apiKeyService.js";
import {
  addMember,
  listMembers,
  login,
  validateEmail,
  validatePassword,
} from "../services/authService.js";
import {
  createOrganization,
  getOrganization,
  listOrganizations,
  validateSlug,
} from "../services/organizationService.js";
import {
  listCredentials,
  revokeCredential,
  setOpenAIKey,
} from "../services/providerCredentialService.js";

import ApiError from "../utils/ApiError.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const requireUuid = (value, name) => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw ApiError.badRequest(`El campo '${name}' no es un identificador válido`);
  }

  return value;
};

const requireText = (value, name, max = 120) => {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    throw ApiError.badRequest(`El campo '${name}' es obligatorio (texto de hasta ${max} caracteres)`);
  }

  return value.trim();
};

// --- plataforma (x-admin-token) --------------------------------------------

// Alta de una organización con su primer owner. Es el único camino para
// crear tenants mientras no haya registro público.
export const postOrganization = async (req, res) => {
  const { name, slug, owner } = req.body ?? {};

  const organizationName = requireText(name, "name");

  if (!validateSlug(slug)) {
    throw ApiError.badRequest(
      "El campo 'slug' debe tener entre 3 y 64 caracteres: minúsculas, dígitos y guiones"
    );
  }

  if (!owner || !validateEmail(owner.email)) {
    throw ApiError.badRequest("El campo 'owner.email' es obligatorio y debe ser un correo");
  }

  if (!validatePassword(owner.password)) {
    throw ApiError.badRequest("El campo 'owner.password' debe tener al menos 10 caracteres");
  }

  const organization = await createOrganization({ name: organizationName, slug });

  const { user } = await addMember(organization.id, {
    email: owner.email,
    password: owner.password,
    name: typeof owner.name === "string" ? owner.name.trim() || null : null,
    role: "owner",
  });

  res.status(201).json({ organization, owner: user });
};

export const getOrganizations = async (req, res) => {
  res.json({ organizations: await listOrganizations() });
};

// --- sesión ----------------------------------------------------------------

export const postLogin = async (req, res) => {
  const { email, password, organization } = req.body ?? {};

  if (!validateEmail(email) || typeof password !== "string" || !validateSlug(organization)) {
    throw ApiError.badRequest(
      "Hacen falta 'email', 'password' y el slug de 'organization'"
    );
  }

  res.json(await login({ email, password, organizationSlug: organization }));
};

// --- organización en sesión (token de usuario) -----------------------------

export const getCurrentOrganization = async (req, res) => {
  res.json({
    organization: await getOrganization(req.auth.organizationId),
    role: req.auth.role,
    userId: req.auth.userId,
  });
};

export const getMembers = async (req, res) => {
  res.json({ members: await listMembers(req.auth.organizationId) });
};

export const postMember = async (req, res) => {
  const { email, password, name, role } = req.body ?? {};

  if (!validateEmail(email)) {
    throw ApiError.badRequest("El campo 'email' es obligatorio y debe ser un correo");
  }

  // Solo un owner puede nombrar owners.
  if (role === "owner" && req.auth.role !== "owner") {
    throw ApiError.forbidden("Solo un owner puede añadir otro owner");
  }

  const result = await addMember(req.auth.organizationId, {
    email,
    password,
    name: typeof name === "string" ? name.trim() || null : null,
    role: role ?? "member",
  });

  res.status(201).json(result);
};

export const getApiKeys = async (req, res) => {
  res.json({ apiKeys: await listApiKeys(req.auth.organizationId) });
};

export const postApiKey = async (req, res) => {
  const { name } = req.body ?? {};

  const apiKey = await createApiKey(req.auth.organizationId, {
    name: requireText(name, "name"),
  });

  res.status(201).json({ apiKey });
};

export const deleteApiKey = async (req, res) => {
  await revokeApiKey(req.auth.organizationId, requireUuid(req.params.id, "id"));

  res.status(204).end();
};

export const getProviderCredentials = async (req, res) => {
  res.json({ credentials: await listCredentials(req.auth.organizationId) });
};

export const putOpenAIKey = async (req, res) => {
  const { apiKey, label } = req.body ?? {};

  const credential = await setOpenAIKey(req.auth.organizationId, {
    apiKey,
    label: typeof label === "string" ? label.trim().slice(0, 120) || null : null,
  });

  res.status(201).json({ credential });
};

export const deleteProviderCredential = async (req, res) => {
  await revokeCredential(req.auth.organizationId, requireUuid(req.params.id, "id"));

  res.status(204).end();
};
