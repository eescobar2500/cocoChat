// Formato de los IDs que devuelve la API de conversaciones.
const CONVERSATION_ID_PATTERN = /^conv_[A-Za-z0-9]{1,128}$/;

// Los items usan otro prefijo (msg_, fc_, rs_… según el tipo), así que
// validamos la forma general en vez de una lista cerrada: si aparece un
// tipo nuevo, esto no lo bloquea.
const ITEM_ID_PATTERN = /^[a-z]{2,8}_[A-Za-z0-9]{1,128}$/;

export function validateConversationId(conversationId) {
  if (
    typeof conversationId !== "string" ||
    !CONVERSATION_ID_PATTERN.test(conversationId)
  ) {
    return {
      valid: false,
      error: "El id de conversación no tiene un formato válido",
    };
  }

  return {
    valid: true,
  };
}

export function validateItemId(itemId) {
  if (typeof itemId !== "string" || !ITEM_ID_PATTERN.test(itemId)) {
    return {
      valid: false,
      error: "El id del mensaje no tiene un formato válido",
    };
  }

  return {
    valid: true,
  };
}

// La metadata de OpenAI admite hasta 16 pares clave-valor, con claves de
// 64 caracteres y valores de 512.
export function validateMetadata(metadata) {
  if (metadata === undefined || metadata === null) {
    return { valid: true };
  }

  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      valid: false,
      error: "La metadata debe ser un objeto de pares clave-valor",
    };
  }

  const entries = Object.entries(metadata);

  if (entries.length > 16) {
    return {
      valid: false,
      error: "La metadata admite como máximo 16 claves",
    };
  }

  for (const [key, value] of entries) {
    if (key.length > 64) {
      return {
        valid: false,
        error: `La clave '${key}' supera los 64 caracteres`,
      };
    }

    if (typeof value !== "string" || value.length > 512) {
      return {
        valid: false,
        error: `El valor de '${key}' debe ser texto de 512 caracteres o menos`,
      };
    }
  }

  return { valid: true };
}
