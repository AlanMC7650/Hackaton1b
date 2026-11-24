# Banca por Internet – STARTUP CHUNO · Product Backlog (Hackathon 24/11/2026)

**Sprint único:** 18:30 – 20:45 · **Equipo:** 5 integrantes (I1 a I5) · **Regla:** cada HU tiene un solo responsable.
**Arquitectura:** microservicios, Node.js + TypeScript + Express + TypeORM, PostgreSQL con un schema por servicio, React + Vite, Docker Compose.
**Repositorios:** `chuno-backend` con todos los microservicios y `chuno-frontend` con la SPA.

| Ponderación del kata | Módulos |
|---|---|
| 75 % | Clientes + Cuentas |
| 100 % | + Pagos de servicios + Transferencias |
| +30 % | Préstamos |

## Resumen

| HU | Título | Épica | SP | Resp. | Depende de |
|---|---|---|---|---|---|
| HU-01 | Definir arquitectura y contratos entre servicios | E0 Fundaciones | 2 | I1 | — |
| HU-02 | Montar infraestructura base y API Gateway | E0 Fundaciones | 5 | I1 | HU-01 |
| HU-03 | Registrar y gestionar clientes | E1 Clientes | 5 | I2 | HU-02 |
| HU-04 | Iniciar sesión y proteger el acceso | E1 Clientes | 3 | I2 | HU-03 |
| HU-05 | Abrir, consultar y cerrar cuentas de ahorro | E2 Cuentas | 5 | I3 | HU-02 |
| HU-06 | Depositar, retirar y registrar movimientos | E2 Cuentas | 5 | I3 | HU-05 |
| HU-07 | Simular los proveedores externos y el intermediario interbancario | E3 Pagos | 3 | I4 | HU-02 |
| HU-08 | Pagar servicios básicos desde una cuenta | E3 Pagos | 5 | I4 | HU-06, HU-07 |
| HU-09 | Transferir entre cuentas propias y a terceros del banco | E4 Transferencias | 5 | I5 | HU-06 |
| HU-10 | Transferir a cuentas de otros bancos | E4 Transferencias | 3 | I5 | HU-07, HU-09 |
| HU-11 | Gestionar préstamos con plan de cuotas | E5 Préstamos | 5 | I1 | HU-02, HU-06 |
| HU-12 | Armar el documento de entrega y las evidencias | E6 Entrega | 2 | I2 | Todas |

**Total: 48 SP.** Carga: I1 12 · I2 10 · I3 10 · I4 8 · I5 8.

## Definition of Done común

- ☐ Cumple sus criterios de aceptación
- ☐ Capas route → controller → service → repository → entity, sin saltarse ninguna
- ☐ Entrada validada con Zod y errores con el formato `{ code, message, details }`
- ☐ Migración de TypeORM, sin `synchronize: true` ni SQL crudo
- ☐ Levanta con `docker compose up`
- ☐ Pantalla del módulo funcionando contra el gateway
- ☐ Captura de evidencia guardada para el documento

---

## E0 · Fundaciones

### HU-01 — Definir arquitectura y contratos entre servicios
**Resp.:** I1 · **SP:** 2
> Como equipo, queremos definir los microservicios, sus datos y cómo se comunican, para trabajar en paralelo sin pisarnos.

**Criterios de aceptación**
- CA-01: Existe el C4 Nivel 1 con Cliente, Operador del banco, Empresas de servicios y Red interbancaria como sistemas externos.
- CA-02: Existe el C4 Nivel 2 con frontend, gateway, 5 microservicios, el simulador de externos y PostgreSQL con 5 schemas.
- CA-03: Están definidos los endpoints internos de `ms-cuentas` que usan Pagos, Transferencias y Préstamos: debitar, acreditar y transferir entre cuentas del banco.
- CA-04: Está escrita la regla de compensación: si un externo falla después de debitar, se devuelve el dinero.

**Tareas**
- T1_HU01 Diagramas C4 N1 y N2
  - ST1.1 Nivel 1 contexto
  - ST1.2 Nivel 2 contenedores
- T2_HU01 Contratos internos de ms-cuentas
- T3_HU01 Tabla de servicios, puertos y schemas

### HU-02 — Montar infraestructura base y API Gateway
**Resp.:** I1 · **SP:** 5
> Como equipo, queremos los repos de backend y frontend con Docker Compose, la base de datos y el gateway listos, para que cada uno arranque su servicio sobre la misma base.

**Criterios de aceptación**
- CA-01: En `chuno-backend`, `docker compose up` levanta Postgres, gateway, los 5 servicios y el simulador de externos. El frontend vive en `chuno-frontend` y corre con `npm run dev`.
- CA-02: Postgres tiene los schemas `clientes`, `cuentas`, `pagos`, `transferencias`, `prestamos`.
- CA-03: `packages/shared` trae los enums, el manejador de errores, el middleware de Zod, el `numericTransformer`, el cliente HTTP interno con timeout y el middleware `X-Internal-Key`.
- CA-04: El gateway enruta `/api/<modulo>/*`, valida el JWT y reenvía `X-User-Id` y `X-User-Rol`.
- CA-05: Cada servicio expone `GET /health`.
- CA-06: El repo `chuno-frontend` tiene el layout con menú por módulo y el cliente HTTP apuntando al gateway.

**Tareas**
- T1_HU02 Repos chuno-backend y chuno-frontend, y docker-compose
- T2_HU02 Paquete shared
- T3_HU02 API Gateway con proxy y validación de JWT
- T4_HU02 Plantilla de microservicio con capas
- T5_HU02 Shell del frontend con React + Vite

---

## E1 · Clientes (`ms-clientes`)

### HU-03 — Registrar y gestionar clientes
**Resp.:** I2 · **SP:** 5
> Como operador del banco, quiero dar de alta, modificar, consultar y dar de baja clientes, para tener el registro de quienes usan la banca.

**Criterios de aceptación**
- CA-01: El alta pide CI, nombres, apellidos, correo, teléfono, dirección y contraseña inicial.
- CA-02: El CI y el correo son únicos; si se repiten se responde 409.
- CA-03: La contraseña se guarda con bcrypt y nunca vuelve en una respuesta.
- CA-04: Se pueden modificar correo, teléfono y dirección; el CI no se edita.
- CA-05: La baja es lógica: el estado pasa a `BAJA` y no se borra nada.
- CA-06: La lista de clientes se puede buscar por CI o nombre.
- CA-07: Existe `GET /internal/clientes/:id` para que los otros servicios validen que el cliente existe y está activo.

**Tareas**
- T1_HU03 Entity, repository y migración de cliente
- T2_HU03 ClienteService con validaciones
- T3_HU03 Endpoints CRUD y endpoint interno
- T4_HU03 Pantalla de clientes con tabla y formulario

### HU-04 — Iniciar sesión y proteger el acceso
**Resp.:** I2 · **SP:** 3
> Como cliente, quiero entrar con mi correo y contraseña, para usar mi banca de forma segura.

**Criterios de aceptación**
- CA-01: `POST /api/clientes/auth/login` devuelve un JWT de 2 horas con `sub` y `rol`.
- CA-02: Con datos incorrectos responde 401 con un mensaje genérico.
- CA-03: Tras 3 intentos fallidos la cuenta se bloquea 5 minutos.
- CA-04: Un cliente en `BAJA` no puede entrar.
- CA-05: Roles: `ADMIN` gestiona clientes; `CLIENTE` solo ve y opera lo suyo.
- CA-06: Existe un usuario `ADMIN` semilla.

**Tareas**
- T1_HU04 AuthService con bcrypt, JWT y bloqueo
- T2_HU04 Endpoint de login y semilla del admin
- T3_HU04 Pantalla de login y manejo de sesión

---

## E2 · Cuentas (`ms-cuentas`)

### HU-05 — Abrir, consultar y cerrar cuentas de ahorro
**Resp.:** I3 · **SP:** 5
> Como operador o cliente, quiero abrir y administrar cuentas de ahorro, para guardar y mover dinero.

**Criterios de aceptación**
- CA-01: Una cuenta se abre para un cliente activo, validado con `GET /internal/clientes/:id`.
- CA-02: Cada cuenta recibe un número único de 10 dígitos, moneda `BOB` y saldo inicial 0.
- CA-03: Un cliente ve solo sus cuentas; el admin ve todas.
- CA-04: Solo se puede modificar el alias de la cuenta.
- CA-05: Cerrar una cuenta solo es posible con saldo 0; queda en estado `CERRADA` y no se borra.

**Tareas**
- T1_HU05 Entity, repository y migración de cuenta
- T2_HU05 CuentaService con generación de número y reglas de cierre
- T3_HU05 Endpoints CRUD
- T4_HU05 Pantalla de mis cuentas

### HU-06 — Depositar, retirar y registrar movimientos
**Resp.:** I3 · **SP:** 5
> Como cliente, quiero depositar y retirar dinero y ver mis movimientos, para controlar mi saldo.

**Criterios de aceptación**
- CA-01: Depositar y retirar exigen monto mayor a 0.
- CA-02: Un retiro sin saldo suficiente se rechaza con 422; el saldo nunca queda negativo.
- CA-03: Cada operación crea un movimiento con tipo, monto, saldo resultante, origen y referencia.
- CA-04: El débito bloquea la fila de la cuenta para que dos operaciones al mismo tiempo no dejen saldo negativo.
- CA-05: Una cuenta `CERRADA` no acepta operaciones.
- CA-06: Existen los endpoints internos `debitar`, `acreditar` y `transferir`, con referencia única para que un reintento no cobre dos veces.

**Tareas**
- T1_HU06 Entity, repository y migración de movimiento
- T2_HU06 Operaciones en transacción con bloqueo de fila
- T3_HU06 Endpoints de depósito, retiro y movimientos
- T4_HU06 Endpoints internos para otros servicios
- T5_HU06 Pantalla de operaciones y extracto

---

## E3 · Pagos de servicios (`ms-pagos`)

### HU-07 — Simular los proveedores externos y el intermediario interbancario
**Resp.:** I4 · **SP:** 3
> Como equipo, queremos un servicio que simule a las empresas de luz, agua, teléfono y gas y a la red interbancaria, para probar las integraciones sin depender de sistemas reales.

**Criterios de aceptación**
- CA-01: `mock-externos` responde la deuda de un código de cliente por empresa.
- CA-02: Recibe la confirmación de un pago y devuelve un número de comprobante.
- CA-03: Recibe transferencias interbancarias y las acepta o rechaza.
- CA-04: Un código que termina en `999` siempre falla, para demostrar la compensación.

**Tareas**
- T1_HU07 Endpoints de empresas de servicios
- T2_HU07 Endpoint de red interbancaria
- T3_HU07 Datos de prueba de deudas

### HU-08 — Pagar servicios básicos desde una cuenta
**Resp.:** I4 · **SP:** 5
> Como cliente, quiero pagar luz, agua, teléfono o gas desde mi cuenta, para no ir a una ventanilla.

**Criterios de aceptación**
- CA-01: El cliente elige empresa, escribe su código de servicio y ve la deuda antes de pagar.
- CA-02: Al pagar se debita la cuenta, se confirma con la empresa y el pago queda `COMPLETADO` con su comprobante.
- CA-03: Si la empresa falla después del débito, se acredita de vuelta y el pago queda `REVERTIDO`.
- CA-04: Sin saldo, el pago queda `RECHAZADO` y no se llama a la empresa.
- CA-05: El cliente ve su historial de pagos.

**Tareas**
- T1_HU08 Entities, repositories y migración de empresa y pago
- T2_HU08 PagoService con débito, confirmación y compensación
- T3_HU08 Endpoints de consulta de deuda, pago e historial
- T4_HU08 Pantalla de pago de servicios

---

## E4 · Transferencias (`ms-transferencias`)

### HU-09 — Transferir entre cuentas propias y a terceros del banco
**Resp.:** I5 · **SP:** 5
> Como cliente, quiero transferir dinero a otra cuenta mía o de otro cliente del banco, para mover mi dinero al instante.

**Criterios de aceptación**
- CA-01: Tipo `PROPIA` exige que el destino sea del mismo cliente; tipo `TERCERO` exige que sea de otro cliente.
- CA-02: La cuenta de origen debe ser del cliente que opera.
- CA-03: El débito y el crédito se hacen juntos en `ms-cuentas` con el endpoint interno `transferir`: o pasan los dos o ninguno.
- CA-04: Monto mayor a 0 y como máximo 50 000 Bs por transferencia.
- CA-05: El cliente ve su historial de transferencias.

**Tareas**
- T1_HU09 Entity, repository y migración de transferencia
- T2_HU09 TransferenciaService con validación de tipo y límite
- T3_HU09 Endpoints de transferir e historial
- T4_HU09 Pantalla de transferencias

### HU-10 — Transferir a cuentas de otros bancos
**Resp.:** I5 · **SP:** 3
> Como cliente, quiero enviar dinero a una cuenta de otro banco, para pagar a quien no está en Chuno.

**Criterios de aceptación**
- CA-01: Se pide banco destino, número de cuenta y nombre del titular.
- CA-02: Se debita la cuenta y se envía la orden al intermediario interbancario simulado.
- CA-03: Si el intermediario rechaza, se acredita de vuelta y la transferencia queda `REVERTIDA`.
- CA-04: Si acepta, queda `COMPLETADA` con el código del intermediario.

**Tareas**
- T1_HU10 Cliente HTTP hacia el intermediario
- T2_HU10 Flujo con compensación
- T3_HU10 Opción interbancaria en la pantalla

---

## E5 · Préstamos (`ms-prestamos`) · plus de 30 %

### HU-11 — Gestionar préstamos con plan de cuotas
**Resp.:** I1 · **SP:** 5
> Como operador del banco, quiero registrar, aprobar y consultar préstamos con su plan de cuotas, para ofrecer crédito a los clientes.

**Criterios de aceptación**
- CA-01: Una solicitud pide cliente, cuenta de desembolso, monto, plazo en meses y tasa anual.
- CA-02: Se calcula la cuota fija con el sistema francés y se genera el plan de cuotas.
- CA-03: Aprobar cambia el estado a `APROBADO` y acredita el monto en la cuenta del cliente.
- CA-04: Se puede rechazar o cancelar un préstamo `SOLICITADO`; uno aprobado no se borra.
- CA-05: El cliente ve sus préstamos y su plan de cuotas.

**Tareas**
- T1_HU11 Entities, repositories y migración de préstamo y cuota
- T2_HU11 PrestamoService con cálculo de cuota y desembolso
- T3_HU11 Endpoints CRUD y aprobación
- T4_HU11 Pantalla de préstamos

---

## E6 · Entrega

### HU-12 — Armar el documento de entrega y las evidencias
**Resp.:** I2 · **SP:** 2
> Como equipo, queremos el documento con carátula, HU, código y capturas, para subirlo al LMS antes de las 20:45.

**Criterios de aceptación**
- CA-01: Carátula con los integrantes presentes y la fecha 24/11/2026.
- CA-02: Incluye arquitectura, HU con CA, modelo de datos, fragmentos de código y capturas de cada módulo.
- CA-03: Está subido al LMS a las 20:30 como máximo.

**Tareas**
- T1_HU12 Carátula y estructura del documento
- T2_HU12 Recolectar capturas de cada integrante
- T3_HU12 Subir al LMS

---

## Cronograma sugerido

| Hora | Qué |
|---|---|
| 18:40 – 19:00 | I1 sube HU-02. Los demás preparan sus entities y services contra la plantilla del .md |
| 19:00 – 20:00 | Cada uno implementa su servicio y su pantalla |
| 20:00 – 20:15 | Integración: pagos y transferencias contra cuentas real |
| 20:15 – 20:30 | Capturas, documento y ensayo del flujo |
| 20:30 – 20:45 | Subida al LMS |
