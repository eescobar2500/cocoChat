-- Rol con el que conecta la API (DATABASE_URL). Hereda los permisos de
-- `cocochat_app`, que crea la migración inicial. Ejecutar una vez por
-- entorno con el rol administrador, cambiando la contraseña:
--
--   psql "$MIGRATION_DATABASE_URL" -f prisma/roles.example.sql
--
-- Las migraciones (MIGRATION_DATABASE_URL) usan otro rol, dueño de las
-- tablas. Nunca se despliega la API con ese rol: sería dueño de las tablas
-- y las políticas de RLS no le aplicarían.

CREATE ROLE cocochat_api LOGIN PASSWORD 'cambiar-esta-contrasena'
  NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE
  IN ROLE cocochat_app;
