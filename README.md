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

## Pruebas manuales con curl

Con el servidor arrancado y la base recién inicializada (`docker compose down -v && docker compose up -d`).
Cada bloque indica la petición y el resultado esperado.

### Alta y modificación
```bash
# Alta correcta -> 201 y cabecera Location
curl -i -X POST http://localhost:3000/api/equipos \
  -H "Content-Type: application/json" \
  -d '{"codigo":"TEST-01","nombre":"Equipo de prueba","categoria":"Prueba"}'

# Código repetido -> 409
curl -i -X POST http://localhost:3000/api/equipos \
  -H "Content-Type: application/json" \
  -d '{"codigo":"TEST-01","nombre":"Repetido","categoria":"Prueba"}'

# Modificación correcta -> 200 (sustituye 12 por el id devuelto en el alta)
curl -i -X PUT http://localhost:3000/api/equipos/12 \
  -H "Content-Type: application/json" \
  -d '{"codigo":"TEST-01","nombre":"Equipo modificado","categoria":"Prueba"}'

# Modificar un id inexistente -> 404
curl -i -X PUT http://localhost:3000/api/equipos/999999 \
  -H "Content-Type: application/json" \
  -d '{"codigo":"X","nombre":"X","categoria":"X"}'
```

### Validación (errores 400)
```bash
# JSON mal formado -> 400
curl -i -X POST http://localhost:3000/api/equipos \
  -H "Content-Type: application/json" -d '{malo'

# Campo vacío -> 400
curl -i -X POST http://localhost:3000/api/equipos \
  -H "Content-Type: application/json" \
  -d '{"codigo":"","nombre":"x","categoria":"y"}'

# Código con más de 20 caracteres -> 400
curl -i -X POST http://localhost:3000/api/equipos \
  -H "Content-Type: application/json" \
  -d '{"codigo":"123456789012345678901","nombre":"x","categoria":"y"}'

# Id no numérico -> 400
curl -i http://localhost:3000/equipos/abc

# Ids de préstamo que no son enteros -> 400
curl -i -X POST http://localhost:3000/api/prestamos \
  -H "Content-Type: application/json" \
  -d '{"equipoId":"1","usuarioId":1}'
```

### Consulta y filtros
```bash
# Búsqueda por nombre (ILIKE) -> solo los 3 portátiles
curl -s "http://localhost:3000/equipos?q=port"

# Filtro por categoría -> solo los 2 monitores
curl -s "http://localhost:3000/equipos?categoria=Monitor"

# Filtro por disponibilidad -> solo equipos prestados
curl -s "http://localhost:3000/equipos?disponible=false"

# Ordenación por nombre
curl -s "http://localhost:3000/equipos?orden=nombre"

# Segunda página -> 5 equipos distintos de la primera
curl -s "http://localhost:3000/equipos?pagina=2"

# Sin resultados -> mensaje "No se han encontrado equipos..."
curl -s "http://localhost:3000/equipos?q=zzz"

# Intento de inyección en el orden -> ordena por código, sin error
curl -s "http://localhost:3000/equipos?orden=nombre;DROP%20TABLE%20equipos"
```

### Préstamo, duplicado y rollback
```bash
# Préstamo correcto -> 201 (el equipo pasa a no disponible)
curl -i -X POST http://localhost:3000/api/prestamos \
  -H "Content-Type: application/json" \
  -d '{"equipoId":1,"usuarioId":1}'

# Mismo equipo otra vez -> 409, sin duplicar filas
curl -i -X POST http://localhost:3000/api/prestamos \
  -H "Content-Type: application/json" \
  -d '{"equipoId":1,"usuarioId":2}'

# Equipo inexistente -> 404
curl -i -X POST http://localhost:3000/api/prestamos \
  -H "Content-Type: application/json" \
  -d '{"equipoId":9999,"usuarioId":1}'

# Rollback: usuario inexistente -> 404; el equipo 2 sigue disponible
curl -i -X POST http://localhost:3000/api/prestamos \
  -H "Content-Type: application/json" \
  -d '{"equipoId":2,"usuarioId":9999}'
curl -s http://localhost:3000/equipos/2     # debe mostrar "Disponible" y sin préstamos
```

### Devolución
```bash
# Devolución correcta -> 200 con fecha_devolucion rellena
curl -i -X POST http://localhost:3000/api/prestamos/1/devolucion

# Segunda devolución -> 409, sin modificar nada
curl -i -X POST http://localhost:3000/api/prestamos/1/devolucion

# Préstamo inexistente -> 404
curl -i -X POST http://localhost:3000/api/prestamos/9999/devolucion
```

### Borrado
```bash
# Equipo con historial (el 1 ya tiene préstamos) -> 409
curl -i -X DELETE http://localhost:3000/api/equipos/1

# Equipo sin historial (el 3, nunca prestado) -> 204
curl -i -X DELETE http://localhost:3000/api/equipos/3

# Mismo id otra vez -> 404
curl -i -X DELETE http://localhost:3000/api/equipos/3
```

### Simultaneidad
```bash
# Dos préstamos a la vez del mismo equipo -> uno 201 y otro 409
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/prestamos \
  -H "Content-Type: application/json" -d '{"equipoId":4,"usuarioId":1}' &
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/prestamos \
  -H "Content-Type: application/json" -d '{"equipoId":4,"usuarioId":2}' &
wait
```

## Limitaciones conocidas
- Sin autenticación ni CSS.
- Las rutas HTML devuelven errores en JSON (no hay página de error).
- No hay endpoints para gestionar usuarios (se crean en `init.sql`).

## Chat con la IA

https://gemini.google.com/share/d/1Vb1dZcTnPtX7GyU7Z2ha0nNk2DYeae_s?usp=sharing
