const logger = (req, res, next) => {
  const start = Date.now();

  console.log("=================================");
  console.log(`Fecha:      ${new Date().toISOString()}`);
  console.log(`Método:     ${req.method}`);
  console.log(`URL:        ${req.originalUrl}`);
  console.log(`IP:         ${req.ip}`);

  res.on("finish", () => {
    const duration = Date.now() - start;

    console.log(`Status:     ${res.statusCode}`);
    console.log(`Duración:   ${duration} ms`);
    console.log("=================================");
  });

  next();
};

export default logger;
