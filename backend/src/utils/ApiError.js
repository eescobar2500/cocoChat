// Error con status HTTP. errorHandle lee `statusCode` para responder,
// así los controllers lanzan en vez de armar la respuesta de error.
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);

    this.statusCode = statusCode;
    this.name = "ApiError";
  }

  static badRequest(message) {
    return new ApiError(400, message);
  }

  static unauthorized(message = "Credenciales inválidas") {
    return new ApiError(401, message);
  }

  static forbidden(message = "No tenés permiso para esta operación") {
    return new ApiError(403, message);
  }

  static notFound(message = "Recurso no encontrado") {
    return new ApiError(404, message);
  }

  static conflict(message = "El recurso ya existe") {
    return new ApiError(409, message);
  }

  static unprocessable(message = "La petición no se pudo procesar") {
    return new ApiError(422, message);
  }

  static payloadTooLarge(message = "La petición es demasiado grande") {
    return new ApiError(413, message);
  }

  static tooManyRequests(message = "Demasiadas peticiones, intentá más tarde") {
    return new ApiError(429, message);
  }

  static badGateway(message = "El servicio externo no respondió correctamente") {
    return new ApiError(502, message);
  }
}

export default ApiError;
