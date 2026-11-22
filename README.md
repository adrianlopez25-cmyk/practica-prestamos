# Práctica: gestión de préstamos de material informático

Aplicación con Node.js, Express 5, PostgreSQL 18 (Docker), `pg` 8 y EJS 3.

## Requisitos
- Node.js 24
- Docker con Docker Compose

## Instalación y arranque
```bash
npm install
cp .env.example .env        # y edita DB_USER / DB_PASSWORD
docker compose up -d        # arranca PostgreSQL; la primera vez ejecuta init.sql
npm start                   # arranca el servidor en http://localhost:3000
```

**Inicialización de la base:** `init.sql` se ejecuta automáticamente solo cuando el volumen está vacío.
Para reiniciar desde cero: `docker compose down -v && docker compose up -d`.

## Estructura
```
compose.yaml           PostgreSQL 18 con volumen persistente
init.sql               esquema, restricciones y datos de ejemplo
src/server.mjs         arranque de Express, rutas y validaciones
src/db.mjs             pool de conexiones y clase HttpError
src/equipos.repo.mjs   consultas SQL de equipos
src/prestamos.service.mjs   transacciones de préstamo y devolución
src/views/             equipos.ejs y equipo.ejs
pruebas.mjs            script de pruebas con fetch
```

## Rutas
| Método y ruta | Descripción |
|---|---|
| GET `/equipos` | Listado con `q`, `categoria`, `disponible`, `orden` (codigo/nombre) y `pagina` |
| GET `/equipos/:id` | Detalle e historial de préstamos |
| POST `/api/equipos` | Crea equipo `{codigo, nombre, categoria}` |
| PUT `/api/equipos/:id` | Modifica equipo |
| DELETE `/api/equipos/:id` | Borra equipo (409 si tiene préstamos) |
| POST `/api/prestamos` | Presta `{equipoId, usuarioId}` |
| POST `/api/prestamos/:id/devolucion` | Devuelve un préstamo |

## Datos iniciales
11 equipos (portátiles, tabletas, proyectores, monitores y periféricos) y 3 usuarios
(ids 1, 2 y 3: Ana López, Carlos Ruiz y Lucía Fernández).

## Pruebas realizadas
Con el servidor arrancado: `npm run pruebas` (usa `fetch`; la simultaneidad con `Promise.all`).

| Caso | Petición | Esperado | Obtenido |
|---|---|---|---|
| Alta | POST /api/equipos | 201 + Location | 201 |
| Código repetido | POST /api/equipos (mismo código) | 409 | 409 |
| Modificación | PUT /api/equipos/12 | 200 | 200 |
| Modificar inexistente | PUT /api/equipos/999999 | 404 | 404 |
| Préstamo correcto | POST /api/prestamos | 201 | 201 |
| Préstamo duplicado | mismo equipo otra vez | 409 sin duplicar filas | 409 |
| Rollback | usuarioId inexistente | equipo sigue disponible, sin préstamo | 404 y equipo disponible |
| Devolución | POST /api/prestamos/1/devolucion | 200 | 200 |
| Segunda devolución | misma petición | sin cambios | 409 |
| Borrado con historial | DELETE equipo prestado alguna vez | 409 | 409 |
| Borrado sin historial | DELETE equipo nuevo | 204 | 204 |
| Borrado inexistente | DELETE mismo id otra vez | 404 | 404 |
| Simultaneidad | dos POST /api/prestamos a la vez | solo uno confirmado | 201 y 409 |
| Id mal formado | GET /equipos/abc | 400 | 400 |
| Equipo inexistente | GET /equipos/999999 | 404 | 404 |
| Filtros | `/equipos?q=port&orden=nombre`, `?disponible=false&categoria=Proyector` | resultados filtrados / mensaje sin resultados | correcto |

## Limitaciones conocidas
- Sin autenticación ni CSS.
- Las rutas HTML devuelven errores en JSON (no hay página de error).
- No hay endpoints para gestionar usuarios (se crean en `init.sql`).
