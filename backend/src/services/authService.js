import {
  createHmac,
  hkdfSync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import env from "../config/env.js";
import { withOrganization, withPlatform } from "../db/prisma.js";

import ApiError from "../utils/ApiError.js";

// Usuarios del panel y sus sesiones.
//
// Contraseñas con scrypt (sal por usuario). Sesiones sin estado: un token
// firmado con HMAC que lleva usuario, organización y caducidad. La clave
// de firma se deriva de la clave maestra, así rotarla invalida sesiones
// —que es lo que se quiere al rotar—.

export const ROLES = ["owner", "admin", "member"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

export function validateEmail(email) {
  return typeof email === "string" && EMAIL_PATTERN.test(email) && email.length <= 254;
}

export function validatePassword(password) {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

// --- contraseñas -----------------------------------------------------------

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, SCRYPT_PARAMS);

  return `scrypt$${SCRYPT_PARAMS.N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password, stored) {
  const [scheme, n, salt, hash] = String(stored).split("$");

  if (scheme !== "scrypt") {
    return false;
  }

  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(password, Buffer.from(salt, "base64"), expected.length, {
    ...SCRYPT_PARAMS,
    N: Number(n),
  });

  return timingSafeEqual(actual, expected);
}

// --- tokens de sesión ------------------------------------------------------

let signingKey;

function getSigningKey() {
  signingKey ??= Buffer.from(
    hkdfSync("sha256", env.secrets.masterKey, "", "cocochat/session-token", 32)
  );

  return signingKey;
}

const b64url = (buffer) => Buffer.from(buffer).toString("base64url");

const sign = (payload) =>
  createHmac("sha256", getSigningKey()).update(payload).digest("base64url");

export function issueSessionToken({ userId, organizationId, role }) {
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      org: organizationId,
      role,
      exp: Math.floor(Date.now() / 1000) + env.sessionTtlSeconds,
    })
  );

  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  const [payload, signature] = String(token ?? "").split(".");

  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) {
      return null;
    }

    return { userId: claims.sub, organizationId: claims.org, role: claims.role };
  } catch {
    return null;
  }
}

// --- usuarios y membresías -------------------------------------------------

export const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name ?? null,
  createdAt: user.createdAt,
});

// Da de alta (o reutiliza) un usuario y lo añade a la organización. El
// alta del usuario es de plataforma porque `users` no tiene tenant; la
// membresía se crea ya en contexto de la organización.
export async function addMember(organizationId, { email, password, name, role }) {
  if (!ROLES.includes(role)) {
    throw ApiError.badRequest(`El rol debe ser uno de: ${ROLES.join(", ")}`);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await withPlatform(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      return existing;
    }

    if (!validatePassword(password)) {
      throw ApiError.badRequest(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
      );
    }

    return tx.user.create({
      data: { email: normalizedEmail, passwordHash: hashPassword(password), name },
    });
  });

  const membership = await withOrganization(organizationId, async (tx) => {
    const current = await tx.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });

    if (current) {
      throw ApiError.conflict("El usuario ya pertenece a la organización");
    }

    return tx.membership.create({
      data: { organizationId, userId: user.id, role, acceptedAt: new Date() },
    });
  });

  return { user: publicUser(user), membership: { id: membership.id, role } };
}

export function listMembers(organizationId) {
  return withOrganization(organizationId, async (tx) => {
    const memberships = await tx.membership.findMany({
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      ...publicUser(m.user),
      role: m.role,
      membershipId: m.id,
    }));
  });
}

let dummyHash;

// Inicia sesión en una organización concreta (por slug). Un usuario puede
// pertenecer a varias; el token queda ligado a una.
export async function login({ email, password, organizationSlug }) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  const found = await withPlatform(async (tx) => {
    const user = await tx.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return null;
    }

    const membership = await tx.membership.findFirst({
      where: { userId: user.id, organization: { slug: organizationSlug, status: "active" } },
      include: { organization: true },
    });

    return { user, membership };
  });

  // Se verifica la contraseña aunque no exista el usuario para no revelar
  // por tiempo de respuesta qué correos están registrados.
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));

  const passwordOk = verifyPassword(
    String(password ?? ""),
    found?.user.passwordHash ?? dummyHash
  );

  if (!found?.membership || !passwordOk) {
    throw ApiError.unauthorized("Correo, contraseña u organización incorrectos");
  }

  const { user, membership } = found;

  withPlatform((tx) =>
    tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  ).catch(() => {});

  return {
    token: issueSessionToken({
      userId: user.id,
      organizationId: membership.organizationId,
      role: membership.role,
    }),
    expiresIn: env.sessionTtlSeconds,
    user: publicUser(user),
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
    },
    role: membership.role,
  };
}
