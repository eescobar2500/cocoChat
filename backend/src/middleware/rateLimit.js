import ApiError from "../utils/ApiError.js";

// Límite de peticiones por ventana fija, en memoria.
//
// En memoria significa que el contador no se comparte entre procesos: con
// varias instancias, cada una permite su propio cupo. Es suficiente
// mientras el despliegue sea un solo proceso, y evita arrastrar Redis
// ahora. Cuando haya más de una instancia, se cambia el almacén sin tocar
// las rutas.
export function createRateLimit({ windowMs, max, keyGenerator }) {
  const hits = new Map();

  // Sin esto, la memoria crece con cada IP que pasa por aquí.
  const sweep = (now) => {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) {
        hits.delete(key);
      }
    }
  };

  let lastSweep = Date.now();

  return (req, res, next) => {
    const now = Date.now();

    if (now - lastSweep > windowMs) {
      sweep(now);
      lastSweep = now;
    }

    const key = keyGenerator ? keyGenerator(req) : req.ip;
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

      res.set("Retry-After", String(retryAfter));

      return next(
        ApiError.tooManyRequests(
          `Demasiadas peticiones. Probá de nuevo en ${retryAfter} segundos`
        )
      );
    }

    next();
  };
}

export default createRateLimit;
