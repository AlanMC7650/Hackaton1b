-- Bootstrap PostgreSQL local para CHUNO.
-- Ejecutar como el superusuario administrador de la base (normalmente postgres).

BEGIN;
SET LOCAL password_encryption = 'scram-sha-256';

DO $chuno$
DECLARE
  services CONSTANT jsonb := '[
    {"schema_name":"clientes",       "role_name":"user_clientes",       "password":"chuno_local_clientes_2026"},
    {"schema_name":"cuentas",        "role_name":"user_cuentas",        "password":"chuno_local_cuentas_2026"},
    {"schema_name":"pagos",          "role_name":"user_pagos",          "password":"chuno_local_pagos_2026"},
    {"schema_name":"transferencias", "role_name":"user_transferencias", "password":"chuno_local_transferencias_2026"},
    {"schema_name":"prestamos",      "role_name":"user_prestamos",      "password":"chuno_local_prestamos_2026"}
  ]'::jsonb;
  service record;
  target record;
  existing_role record;
  roles_sql text;
  admin_name text := current_user;
  database_name text := current_database();
  database_oid oid;
BEGIN
  SELECT oid INTO database_oid FROM pg_database WHERE datname = database_name;

  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = admin_name) THEN
    RAISE EXCEPTION 'Este bootstrap local requiere un superusuario';
  END IF;
  IF database_name IN ('postgres', 'template0', 'template1') THEN
    RAISE EXCEPTION 'Selecciona la base dedicada de CHUNO, no %', database_name;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_namespace
    WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'
      AND nspname NOT IN (
        'public', 'clientes', 'cuentas', 'pagos', 'transferencias', 'prestamos'
      )
  ) THEN
    RAISE EXCEPTION 'Se requiere una base dedicada, sin schemas ajenos a CHUNO';
  END IF;

  FOR service IN SELECT * FROM jsonb_to_recordset(services)
    AS x(schema_name text, role_name text, password text)
  LOOP
    SELECT * INTO existing_role FROM pg_roles WHERE rolname = service.role_name;
    IF FOUND THEN
      IF existing_role.rolsuper OR existing_role.rolcreatedb
        OR existing_role.rolcreaterole OR existing_role.rolreplication
        OR existing_role.rolbypassrls OR NOT existing_role.rolcanlogin THEN
        RAISE EXCEPTION 'El rol % ya existe con atributos incompatibles', service.role_name;
      END IF;
    ELSE
      EXECUTE format(
        'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',
        service.role_name, service.password
      );
    END IF;
    EXECUTE format('ALTER ROLE %I NOINHERIT', service.role_name);
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION %I', service.schema_name, admin_name);
  END LOOP;

  SELECT string_agg(format('%I', x.role_name), ', ') INTO roles_sql
    FROM jsonb_to_recordset(services) AS x(role_name text);

  EXECUTE format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM PUBLIC, %s', database_name, roles_sql);
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %s', database_name, roles_sql);

  FOR target IN SELECT nspname FROM pg_namespace
    WHERE nspname IN (
      'public', 'clientes', 'cuentas', 'pagos', 'transferencias', 'prestamos'
    )
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON SCHEMA %I FROM PUBLIC, %s', target.nspname, roles_sql);
    EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I FROM PUBLIC, %s', target.nspname, roles_sql);
    EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I FROM PUBLIC, %s', target.nspname, roles_sql);
    EXECUTE format('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC, %s', target.nspname, roles_sql);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, %s', admin_name, target.nspname, roles_sql);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, %s', admin_name, target.nspname, roles_sql);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, %s', admin_name, target.nspname, roles_sql);
  END LOOP;

  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, %s', admin_name, roles_sql);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, %s', admin_name, roles_sql);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, %s', admin_name, roles_sql);

  FOR service IN SELECT * FROM jsonb_to_recordset(services)
    AS x(schema_name text, role_name text, password text)
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', service.schema_name, service.role_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO %I', service.schema_name, service.role_name);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO %I', service.schema_name, service.role_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', admin_name, service.schema_name, service.role_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO %I', admin_name, service.schema_name, service.role_name);
    EXECUTE format('ALTER ROLE %I IN DATABASE %I SET search_path TO %I', service.role_name, database_name, service.schema_name);

    IF NOT has_database_privilege(service.role_name, database_name, 'CONNECT')
      OR has_database_privilege(service.role_name, database_name, 'CREATE')
      OR has_database_privilege(service.role_name, database_name, 'TEMP') THEN
      RAISE EXCEPTION 'Permisos de base incorrectos para %', service.role_name;
    END IF;
    FOR target IN SELECT nspname FROM pg_namespace
      WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'
    LOOP
      IF has_schema_privilege(service.role_name, target.nspname, 'USAGE')
        IS DISTINCT FROM (target.nspname = service.schema_name)
        OR has_schema_privilege(service.role_name, target.nspname, 'CREATE') THEN
        RAISE EXCEPTION 'Aislamiento incorrecto: rol %, schema %', service.role_name, target.nspname;
      END IF;
    END LOOP;
  END LOOP;
END;
$chuno$;

COMMIT;
