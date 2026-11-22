import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError } from './db.mjs';
import * as equipos from './equipos.repo.mjs';
import { prestar, devolver } from './prestamos.service.mjs';

const app = express();
const dir = path.dirname(fileURLToPath(import.meta.url));
app.set('view engine', 'ejs');
app.set('views', path.join(dir, 'views'));
app.use(express.json()); // lee el cuerpo JSON de las peticiones

// ---------- Validaciones ----------
const MAX_INT = 2147483647;

function validarId(valor) {
  if (!/^\d+$/.test(String(valor))) throw new HttpError(400, 'Identificador no válido');
  const n = Number(valor);
  if (n < 1 || n > MAX_INT) throw new HttpError(400, 'Identificador no válido');
  return n;
}

function validarEquipo(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON');
  const { codigo, nombre, categoria } = body;
  for (const [campo, valor] of Object.entries({ codigo, nombre, categoria })) {
    if (typeof valor !== 'string' || valor.trim() === '')
      throw new HttpError(400, `El campo "${campo}" es obligatorio y debe ser texto`);
  }
  if (codigo.trim().length > 20) throw new HttpError(400, 'El código admite como máximo 20 caracteres');
  return { codigo: codigo.trim(), nombre: nombre.trim(), categoria: categoria.trim() };
}

// ---------- Vistas HTML ----------
app.get('/equipos', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const categoria = String(req.query.categoria ?? '');
  const disponible = String(req.query.disponible ?? '');
  const orden = req.query.orden === 'nombre' ? 'nombre' : 'codigo';
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);

  const { filas, total } = await equipos.listar({ q, categoria, disponible, orden, pagina });
  const totalPaginas = Math.max(1, Math.ceil(total / equipos.POR_PAGINA));

  // Enlace a otra página conservando los filtros
  const enlace = (p) => {
    const params = new URLSearchParams({ q, categoria, disponible, orden, pagina: p });
    return '/equipos?' + params.toString();
  };

  res.render('equipos', {
    filas, total, pagina, totalPaginas, enlace,
    filtros: { q, categoria, disponible, orden },
    categorias: await equipos.categorias(),
  });
});

app.get('/equipos/:id', async (req, res) => {
  const id = validarId(req.params.id);
  const equipo = await equipos.obtenerConPrestatario(id);
  if (!equipo) throw new HttpError(404, 'Equipo no encontrado');
  res.render('equipo', { equipo, prestamos: await equipos.historial(id) });
});

// ---------- API ----------
app.post('/api/equipos', async (req, res) => {
  const datos = validarEquipo(req.body);
  const creado = await equipos.crear(datos);
  res.status(201).location(`/api/equipos/${creado.id}`).json(creado);
});

app.put('/api/equipos/:id', async (req, res) => {
  const id = validarId(req.params.id);
  const datos = validarEquipo(req.body);
  const actualizado = await equipos.actualizar(id, datos);
  if (!actualizado) throw new HttpError(404, 'Equipo no encontrado');
  res.json(actualizado);
});

app.delete('/api/equipos/:id', async (req, res) => {
  const id = validarId(req.params.id);
  if (!(await equipos.borrar(id))) throw new HttpError(404, 'Equipo no encontrado');
  res.status(204).end();
});

app.post('/api/prestamos', async (req, res) => {
  const { equipoId, usuarioId } = req.body ?? {};
  if (!Number.isInteger(equipoId) || !Number.isInteger(usuarioId) ||
      equipoId < 1 || usuarioId < 1 || equipoId > MAX_INT || usuarioId > MAX_INT)
    throw new HttpError(400, 'equipoId y usuarioId deben ser enteros positivos');
  const id = await prestar(equipoId, usuarioId);
  res.status(201).json({ id });
});

app.post('/api/prestamos/:id/devolucion', async (req, res) => {
  const id = validarId(req.params.id);
  res.json(await devolver(id));
});

// ---------- Errores ----------
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON mal formado' });
  if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un equipo con ese código' });
  if (err.code === '23503') return res.status(409).json({ error: 'Operación no permitida: hay datos relacionados' });
  console.error(err); // el detalle técnico solo va a la consola
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Servidor en http://localhost:${process.env.PORT || 3000}/equipos`)
);
