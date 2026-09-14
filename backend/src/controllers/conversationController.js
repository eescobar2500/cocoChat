import {
  createConversation,
  deleteConversation,
  deleteConversationItem,
  getConversation,
} from "../services/conversationService.js";

import {
  validateConversationId,
  validateItemId,
  validateMetadata,
} from "../utils/validations/conversationValidation.js";

import ApiError from "../utils/ApiError.js";

export const postConversation = async (req, res) => {
  const { metadata } = req.body ?? {};

  const validation = validateMetadata(metadata);

  if (!validation.valid) {
    throw ApiError.badRequest(validation.error);
  }

  const conversation = await createConversation({ metadata });

  res.status(201).json(conversation);
};

export const getConversationById = async (req, res) => {
  const { id } = req.params;

  const validation = validateConversationId(id);

  if (!validation.valid) {
    throw ApiError.badRequest(validation.error);
  }

  const conversation = await getConversation(id);

  res.json(conversation);
};

export const removeConversation = async (req, res) => {
  const { id } = req.params;

  const validation = validateConversationId(id);

  if (!validation.valid) {
    throw ApiError.badRequest(validation.error);
  }

  const result = await deleteConversation(id);

  res.json({
    message: "Conversación eliminada",
    ...result,
  });
};

export const removeConversationItem = async (req, res) => {
  const { id, itemId } = req.params;

  const conversationCheck = validateConversationId(id);

  if (!conversationCheck.valid) {
    throw ApiError.badRequest(conversationCheck.error);
  }

  const itemCheck = validateItemId(itemId);

  if (!itemCheck.valid) {
    throw ApiError.badRequest(itemCheck.error);
  }

  await deleteConversationItem(id, itemId);

  res.json({
    message: "Mensaje eliminado",
    conversationId: id,
    itemId,
  });
};
