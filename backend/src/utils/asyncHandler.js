// Envuelve un handler async para que sus errores lleguen a errorHandle.
// Express 5 ya propaga promesas rechazadas, pero hacerlo explícito evita
// depender de esa diferencia entre versiones.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
