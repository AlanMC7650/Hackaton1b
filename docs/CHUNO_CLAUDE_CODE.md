# Banca por Internet CHUNO – Guía de implementación para Claude Code

**Contexto:** hackathon universitario de Arquitectura de Software, 24/11/2026, de 18:30 a 20:45. Hay que entregar código funcionando, pantallas y evidencias. **El tiempo manda:** primero que funcione el flujo completo, después lo bonito.

**Cómo usar este archivo:** cada integrante del equipo usa su propio Claude Code con este mismo archivo. Al empezar, el integrante te dice qué HU le toca. **Implementa solo las secciones de esa HU** y no toques carpetas de otros servicios. Las HU completas, con sus CA, están en `CHUNO_BACKLOG.md`.

| HU | Resp. | Carpeta que te pertenece |
|---|---|---|
| HU | Resp. | En `chuno-backend` | En `chuno-frontend` |
|---|---|---|---|
| HU-01, HU-02, HU-11 | I1 | `docs/`, `docker-compose.yml`, `packages/shared/`, `gateway/`, `services/ms-prestamos/` | `src/app/`, `src/modules/prestamos/` |
| HU-03, HU-04, HU-12 | I2 | `services/ms-clientes/` | `src/modules/clientes/`, `src/modules/auth/` |
| HU-05, HU-06 | I3 | `services/ms-cuentas/` | `src/modules/cuentas/` |
| HU-07, HU-08 | I4 | `services/mock-externos/`, `services/ms-pagos/` | `src/modules/pagos/` |
| HU-09, HU-10 | I5 | `services/ms-transferencias/` | `src/modules/transferencias/` |

Si necesitas algo de una carpeta que no es tuya, no la edites: dime qué falta y yo lo coordino.

---

## 1. Stack (no cambiar)

- Node.js 20 + **TypeScript** + Express.
- **TypeORM** con migraciones. Prohibido: `synchronize: true`, SQL crudo, Prisma.
- **PostgreSQL 16 en Docker**, una sola instancia con **un schema por servicio**. Ningún servicio lee el schema de otro; los datos ajenos se piden por API.
- Zod para validar entradas. bcrypt + jsonwebtoken para la seguridad.
- Frontend: React + Vite + TypeScript + Tailwind, una sola SPA con un módulo por servicio.
- Docker Compose para levantar todo.

---

## 2. Arquitectura

```
Frontend (5173) ──► API Gateway (8080) ──► ms-clientes       (3001)  schema clientes
                         │  valida JWT       ms-cuentas        (3002)  schema cuentas
                         │                   ms-pagos          (3003)  schema pagos
                         │                   ms-transferencias (3004)  schema transferencias
                         │                   ms-prestamos      (3005)  schema prestamos
                         ▼
                    mock-externos (3010)  ← simula empresas de servicios y red interbancaria, sin BD
```

**Quién llama a quién por `/internal/*`:**
- `ms-cuentas` → `ms-clientes`: validar cliente.
- `ms-pagos`, `ms-transferencias`, `ms-prestamos` → `ms-cuentas`: leer cuentas, debitar, acreditar, transferir.
- `ms-pagos`, `ms-transferencias` → `mock-externos`.
- `ms-prestamos` → `ms-clientes`: validar cliente.

No hay más dependencias. Ningún servicio llama a `ms-pagos`, `ms-transferencias` ni `ms-prestamos`.

---

## 3. Estructura de los repos

Son **dos repositorios**: `chuno-backend` con todos los microservicios y `chuno-frontend` con la SPA. El frontend no entra al `docker-compose`: corre con `npm run dev` en el puerto 5173 y llama al gateway en `http://localhost:8080` mediante la variable `VITE_API_URL`.

```
chuno-backend/
├── docker-compose.yml
├── .env.example
├── packages/shared/src/
│   ├── enums.ts
│   ├── errors.ts              AppError + errorHandler
│   ├── validate.ts            middleware Zod
│   ├── numeric.transformer.ts numeric → number
│   ├── internal-auth.ts       middleware X-Internal-Key
│   ├── http-client.ts         cliente interno con timeout 3 s y 1 reintento
│   └── identity.ts            lee X-User-Id y X-User-Rol
├── gateway/src/
├── services/
│   ├── ms-clientes/  ms-cuentas/  ms-pagos/  ms-transferencias/  ms-prestamos/
│   └── mock-externos/
└── docs/

chuno-frontend/
├── .env.example      VITE_API_URL=http://localhost:8080
└── src/
    ├── app/          layout, router, api client, sesión
    └── modules/      auth/ clientes/ cuentas/ pagos/ transferencias/ prestamos/
```

**Plantilla de cada microservicio:**
```
ms-x/
├── Dockerfile
├── package.json  tsconfig.json
└── src/
    ├── server.ts  app.ts  data-source.ts
    ├── routes/        x.routes.ts, internal.routes.ts
    ├── controllers/   solo HTTP ↔ DTO, sin lógica
    ├── services/      reglas de negocio
    ├── repositories/  único lugar con TypeORM
    ├── entities/      clases @Entity
    ├── schemas/       Zod
    ├── clients/       HTTP a otros servicios
    ├── migrations/
    └── seeds/
```

---

## 4. Convenciones (todos igual)

1. **Capas:** route → controller → service → repository → entity. El controller no tiene lógica; el service nunca usa TypeORM directo.
2. **DataSource por servicio:**
   ```ts
   new DataSource({
     type: 'postgres', url: process.env.DATABASE_URL, schema: process.env.DB_SCHEMA,
     namingStrategy: new SnakeNamingStrategy(),
     entities: [__dirname + '/entities/*.entity.{ts,js}'],
     migrations: [__dirname + '/migrations/*.{ts,js}'],
     migrationsTableName: 'migrations', synchronize: false,
   });
   ```
   Al arrancar, `server.ts` corre `AppDataSource.runMigrations()` y luego la semilla si la tabla está vacía. Así `docker compose up` deja todo listo.
3. **Nombres:** camelCase en TypeScript y snake_case en la BD, mediante `SnakeNamingStrategy`.
4. **PK:** `uuid` con `@PrimaryGeneratedColumn('uuid')`.
5. **Dinero:** `numeric(14,2)` con `numericTransformer`. Moneda siempre `BOB`.
6. **Fechas de negocio** como `date` y `string` `'YYYY-MM-DD'` en TypeScript. Los instantes son `timestamptz` con `@CreateDateColumn`.
7. **Errores:** siempre `{ code, message, details }`. Códigos: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `BUSINESS_RULE` 422, `SERVICE_UNAVAILABLE` 503, `INTERNAL_ERROR` 500.
8. **Identidad:** el gateway valida el JWT y reenvía `X-User-Id` y `X-User-Rol` (`ADMIN` o `CLIENTE`). Un `CLIENTE` solo ve y opera lo suyo; si pide algo ajeno, responde 403.
9. **Rutas internas** `/internal/*`: no pasan por el gateway y exigen la cabecera `X-Internal-Key` igual a `INTERNAL_API_KEY`.
10. **Referencia de operación:** toda operación de dinero lleva una `referencia` única, un uuid generado por quien inicia la operación. Si llega dos veces la misma, se devuelve el resultado anterior y no se cobra de nuevo.
11. **CHECK con nombre:** `@Check('ck_cuenta_saldo', '"saldo" >= 0')`, con columnas en snake_case y entre comillas.

**`.env.example`**
```
POSTGRES_PASSWORD=chuno
DATABASE_URL=postgres://postgres:chuno@postgres:5432/chuno
INTERNAL_API_KEY=chuno-internal-dev
JWT_SECRET=chuno-jwt-dev
CLIENTES_URL=http://ms-clientes:3001
CUENTAS_URL=http://ms-cuentas:3002
EXTERNOS_URL=http://mock-externos:3010
```

---

## 5. HU-02 · Infraestructura base y gateway (I1)

**docker-compose.yml:**
- `postgres:16` con un volumen y un script de arranque que crea los schemas `clientes`, `cuentas`, `pagos`, `transferencias` y `prestamos`. Es la configuración del contenedor, no código de la aplicación.
- Un servicio por microservicio, con `DB_SCHEMA` propio y `depends_on` de postgres con healthcheck.
- `gateway` es el único servicio que publica su puerto hacia afuera, el 8080. El frontend no va en el compose porque vive en su propio repo.

**Gateway** (Express + `http-proxy-middleware`):
- `/api/clientes/*` → ms-clientes, `/api/cuentas/*` → ms-cuentas, `/api/pagos/*` → ms-pagos, `/api/transferencias/*` → ms-transferencias, `/api/prestamos/*` → ms-prestamos.
- Ruta pública: solo `POST /api/clientes/auth/login`. Todas las demás exigen `Authorization: Bearer <jwt>`.
- Reenvía `X-User-Id` y `X-User-Rol` y bloquea con 404 cualquier ruta que contenga `/internal`.
- CORS para `http://localhost:5173`.

**Frontend shell, en el repo `chuno-frontend`:** layout con barra lateral (Clientes, Cuentas, Pagos, Transferencias, Préstamos), un router con **una ruta ya creada por módulo** apuntando a `modules/<x>/pages/index.tsx` vacío, un cliente HTTP con el token y un guard que manda al login. Así cada integrante solo edita su carpeta y nadie choca en el router.

**Hazlo en este orden y súbelo cuanto antes**, porque los demás dependen de esto: en `chuno-backend` shared → plantilla de un servicio → compose → gateway; después, en `chuno-frontend`, el shell.

---

## 6. ms-clientes · HU-03 y HU-04 (I2)

**Schema `clientes` · tabla `cliente`**

| Columna | Tipo | Regla |
|---|---|---|
| id | uuid | PK |
| ci | varchar(15) | único |
| nombres, apellidos | varchar(100) | |
| email | varchar(150) | único, en minúsculas |
| telefono | varchar(20) | nulo permitido |
| direccion | varchar(200) | nulo permitido |
| password_hash | varchar(100) | `select: false` |
| rol | enum `ADMIN`, `CLIENTE` | default `CLIENTE` |
| estado | enum `ACTIVO`, `BAJA` | default `ACTIVO` |
| intentos_fallidos | smallint | default 0 |
| bloqueado_hasta | timestamptz | nulo |
| created_at, updated_at | timestamptz | |

**Endpoints**
| Método y ruta | Rol | Qué hace |
|---|---|---|
| POST /auth/login | público | JWT de 2 h con `sub` = id y `rol`; 3 fallos bloquean 5 min; `BAJA` no entra |
| POST /clientes | ADMIN | alta; CI y email únicos → 409 |
| GET /clientes?q= | ADMIN | lista con búsqueda por CI o nombre |
| GET /clientes/me | CLIENTE | sus datos |
| GET /clientes/:id | ADMIN | detalle |
| PATCH /clientes/:id | ADMIN | solo email, teléfono, dirección |
| DELETE /clientes/:id | ADMIN | baja lógica: estado `BAJA` |
| GET /internal/clientes/:id | interno | `{ id, nombreCompleto, estado }` |

**Semilla:** `admin@chuno.bo` con contraseña `Admin123!` y rol ADMIN, más 3 clientes de prueba con contraseña `Cliente123!`.
**Pantallas:** login; tabla de clientes con búsqueda; formulario de alta y edición; botón de baja con confirmación.

---

## 7. ms-cuentas · HU-05 y HU-06 (I3)

Es el servicio central: Pagos, Transferencias y Préstamos dependen de sus endpoints internos. **Sube los internos lo antes posible**, aunque las pantallas vengan después.

**Tabla `cuenta`**
| Columna | Tipo | Regla |
|---|---|---|
| id | uuid | PK |
| numero | varchar(10) | único, 10 dígitos generados |
| cliente_id | uuid | índice, sin FK porque vive en otro schema |
| alias | varchar(50) | nulo permitido |
| tipo | enum `AHORRO` | |
| moneda | varchar(3) | `BOB` |
| saldo | numeric(14,2) | default 0, `CHECK saldo >= 0` |
| estado | enum `ACTIVA`, `CERRADA` | |
| created_at, updated_at | timestamptz | |

**Tabla `movimiento`**
| Columna | Tipo | Regla |
|---|---|---|
| id | uuid | PK |
| cuenta_id | uuid | FK → cuenta |
| tipo | enum `CREDITO`, `DEBITO` | |
| origen | enum `DEPOSITO`, `RETIRO`, `PAGO_SERVICIO`, `TRANSFERENCIA`, `DESEMBOLSO`, `REVERSION` | |
| monto | numeric(14,2) | `CHECK monto > 0` |
| saldo_resultante | numeric(14,2) | |
| referencia | uuid | `UNIQUE (cuenta_id, tipo, referencia)` |
| glosa | varchar(150) | |
| created_at | timestamptz | |

**Reglas**
- Abrir: el cliente debe existir y estar `ACTIVO`; se valida con `GET /internal/clientes/:id`.
- Cerrar: solo con saldo 0; queda `CERRADA`, nunca se borra.
- Toda operación de dinero va en `AppDataSource.transaction()` y lee la cuenta con `setLock('pessimistic_write')` antes de cambiar el saldo.
- Cuenta `CERRADA` no opera → 422. Sin saldo → 422 con code `BUSINESS_RULE` y `details.motivo = 'SALDO_INSUFICIENTE'`.
- Si ya existe un movimiento con la misma `cuenta_id`, `tipo` y `referencia`, se devuelve ese movimiento sin tocar el saldo.

**Endpoints públicos**
| Método y ruta | Qué hace |
|---|---|
| POST /cuentas | abrir; el CLIENTE abre para sí mismo y el ADMIN indica `clienteId` |
| GET /cuentas | el CLIENTE ve las suyas; el ADMIN ve todas o filtra por `clienteId` |
| GET /cuentas/:id | detalle |
| PATCH /cuentas/:id | solo alias |
| DELETE /cuentas/:id | cerrar |
| POST /cuentas/:id/depositos | `{ monto, glosa }` |
| POST /cuentas/:id/retiros | `{ monto, glosa }` |
| GET /cuentas/:id/movimientos | extracto, del más reciente al más antiguo |

**Endpoints internos (contrato fijo, no cambiar)**
| Método y ruta | Body | Respuesta |
|---|---|---|
| GET /internal/cuentas/:id | — | `{ id, numero, clienteId, saldo, estado }` |
| GET /internal/cuentas/numero/:numero | — | igual |
| POST /internal/cuentas/:id/debitar | `{ monto, referencia, origen, glosa }` | el movimiento |
| POST /internal/cuentas/:id/acreditar | `{ monto, referencia, origen, glosa }` | el movimiento |
| POST /internal/transferir | `{ cuentaOrigenId, cuentaDestinoId, monto, referencia, glosa }` | `{ debito, credito }` en una sola transacción; bloquea las dos cuentas en orden de id para evitar deadlock |

**Semilla:** una o dos cuentas con saldo para cada cliente de prueba, usando los ids de la semilla de ms-clientes. Coordínalo con I2 para que los ids sean fijos.
**Pantallas:** mis cuentas en tarjetas con saldo; abrir cuenta; depositar y retirar; extracto de movimientos.

---

## 8. mock-externos · HU-07 (I4)

Servicio Express sin base de datos, con datos en memoria. **Hazlo primero:** son 15 minutos y desbloquea a I5.

| Método y ruta | Qué hace |
|---|---|
| GET /empresas | lista fija: `LUZ` Electricidad, `AGUA` Agua Potable, `TEL` Telefonía, `GAS` Gas Domiciliario |
| GET /empresas/:codigo/deudas/:codigoCliente | `{ codigoCliente, titular, periodo, monto }`; el monto sale del código para que siempre dé lo mismo; un código inexistente devuelve 404 |
| POST /empresas/:codigo/pagos | `{ codigoCliente, monto, referencia }` → `{ comprobante }`; **si `codigoCliente` termina en `999`, responde 502** |
| POST /ach/transferencias | `{ bancoDestino, cuentaDestino, titular, monto, referencia }` → `{ estado: 'ACEPTADA', codigoAch }`; **si `cuentaDestino` termina en `999`, responde 422 `RECHAZADA`** |
| GET /ach/bancos | lista fija de 4 bancos ficticios |

Agrega una espera de 300 a 800 ms en cada respuesta para que parezca un sistema real.

---

## 9. ms-pagos · HU-08 (I4)

**Tabla `empresa`:** id, codigo único, nombre, tipo enum `LUZ`, `AGUA`, `TELEFONO`, `GAS`, `OTRO`, activo. Semilla igual a la de `mock-externos`.

**Tabla `pago`**
| Columna | Tipo | Regla |
|---|---|---|
| id | uuid | PK |
| referencia | uuid | única, la usa para debitar y acreditar |
| cliente_id | uuid | índice |
| cuenta_id | uuid | índice |
| empresa_id | uuid | FK → empresa |
| codigo_cliente_servicio | varchar(30) | |
| periodo | varchar(7) | |
| monto | numeric(14,2) | > 0 |
| estado | enum `PENDIENTE`, `COMPLETADO`, `RECHAZADO`, `REVERTIDO` | |
| comprobante | varchar(40) | nulo |
| motivo | varchar(200) | nulo; por qué se rechazó o revirtió |
| created_at, updated_at | timestamptz | |

**Flujo de `POST /pagos`** con body `{ cuentaId, empresaCodigo, codigoClienteServicio }`:
1. Verificar que la cuenta sea del cliente con `GET /internal/cuentas/:id`; si no, 403.
2. Consultar la deuda al mock y crear el pago `PENDIENTE` con una referencia nueva.
3. Debitar con `origen = PAGO_SERVICIO`. Si no hay saldo, el pago queda `RECHAZADO` y se corta aquí.
4. Confirmar con el mock. Si responde bien, el pago queda `COMPLETADO` con su comprobante.
5. **Compensación:** si el mock falla, acreditar el mismo monto con la misma referencia y `origen = REVERSION`; el pago queda `REVERTIDO` con el motivo.

**Endpoints:** `GET /pagos/empresas`, `GET /pagos/deuda?empresa=&codigo=`, `POST /pagos`, `GET /pagos` con el historial del cliente.
**Pantalla:** elegir empresa, escribir código, ver deuda, elegir cuenta, pagar; resultado con comprobante o motivo; historial.

---

## 10. ms-transferencias · HU-09 y HU-10 (I5)

**Tabla `transferencia`**
| Columna | Tipo | Regla |
|---|---|---|
| id | uuid | PK |
| referencia | uuid | única |
| cliente_id | uuid | índice |
| tipo | enum `PROPIA`, `TERCERO`, `INTERBANCARIA` | |
| cuenta_origen_id | uuid | |
| cuenta_destino_id | uuid | nulo en interbancaria |
| cuenta_destino_numero | varchar(30) | |
| banco_destino | varchar(50) | `CHUNO` si es interna |
| titular_destino | varchar(150) | |
| monto | numeric(14,2) | > 0 y ≤ 50 000 |
| glosa | varchar(150) | |
| estado | enum `COMPLETADA`, `RECHAZADA`, `REVERTIDA` | |
| codigo_externo | varchar(40) | código del intermediario, nulo |
| motivo | varchar(200) | nulo |
| created_at | timestamptz | |

**Flujo de `POST /transferencias`:**
- **PROPIA y TERCERO:** buscar el destino con `GET /internal/cuentas/numero/:numero`. PROPIA exige el mismo `clienteId` que el origen; TERCERO exige uno distinto. Luego llamar a `POST /internal/transferir`: es atómico, o pasan los dos movimientos o ninguno. Sin saldo, queda `RECHAZADA`.
- **INTERBANCARIA:** debitar el origen; enviar al mock `POST /ach/transferencias`; si acepta, queda `COMPLETADA` con el código del intermediario; **si rechaza o falla, acreditar de vuelta** con `origen = REVERSION` y queda `REVERTIDA`.
- Siempre: la cuenta de origen debe ser del cliente que opera; si no, 403.

**Endpoints:** `POST /transferencias`, `GET /transferencias`, `GET /transferencias/bancos` que reenvía la lista del mock.
**Pantalla:** pestañas Propia, Tercero, Otro banco; confirmación con resumen antes de enviar; historial.

---

## 11. ms-prestamos · HU-11 (I1, plus del 30 %)

**Tabla `prestamo`:** id, cliente_id, cuenta_desembolso_id, monto numeric > 0, tasa_anual numeric(5,2), plazo_meses smallint entre 1 y 60, cuota_mensual numeric, estado enum `SOLICITADO`, `APROBADO`, `RECHAZADO`, `CANCELADO`, referencia_desembolso uuid nulo, created_at, updated_at.
**Tabla `cuota`:** id, prestamo_id FK, numero, fecha_vencimiento date, capital, interes, cuota, saldo. `UNIQUE (prestamo_id, numero)`.

**Cuota fija, sistema francés:** con `i = tasa_anual / 12 / 100`, la cuota es `monto × i / (1 − (1 + i)^−n)`. Redondea a 2 decimales y ajusta la última cuota para que el saldo cierre en 0.

**Endpoints:** `POST /prestamos` crea `SOLICITADO` y su plan · `GET /prestamos` · `GET /prestamos/:id` con cuotas · `PATCH /prestamos/:id` solo si está `SOLICITADO` · `POST /prestamos/:id/aprobar` solo ADMIN: acredita en la cuenta con `origen = DESEMBOLSO` y pasa a `APROBADO` · `POST /prestamos/:id/rechazar` · `DELETE /prestamos/:id` cancela si está `SOLICITADO`; uno aprobado nunca se borra.
**Pantalla:** simulador de cuota, solicitudes, aprobación para el ADMIN y tabla del plan de cuotas.

---

## 12. Qué priorizar si no alcanza el tiempo

1. Clientes con login, y Cuentas con depósito y retiro: es el 75 %.
2. Pagos con compensación y Transferencias propias y a terceros: llega al 100 %.
3. Transferencia interbancaria.
4. Préstamos: es el plus.
5. Pulir pantallas.

Antes que una pantalla linda, prioriza que el flujo funcione completo: **login → abrir cuenta → depositar → pagar luz → transferir → ver extracto.** Ese es el flujo de la demo.

## 13. Checklist de cada integrante antes de las 20:15

- ☐ Mi servicio levanta con `docker compose up` y responde `/health`.
- ☐ Migración propia aplicada; ningún `synchronize: true`.
- ☐ Todas las capas existen, con TypeORM solo en los repositories.
- ☐ Mi pantalla funciona contra el gateway.
- ☐ Probé el caso de error principal de mi HU: sin saldo, código `999`, CI duplicado, etc.
- ☐ Tengo capturas de la pantalla y del código para el documento.
