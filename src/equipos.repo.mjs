import { pool } from './db.mjs';

// Solo estas opciones de orden existen: nunca se concatena lo que llega en la petición
const ORDENES = {
  codigo: 'codigo ASC',
  nombre: 'nombre ASC',
};
export const POR_PAGINA = 5;

export async function listar({ q, categoria, disponible, orden, pagina }) {
  // Construimos el WHERE sumando condiciones y parámetros ($1, $2...)
  const condiciones = [];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    condiciones.push(`nombre ILIKE $${params.length}`);
  }
  if (categoria) {
    params.push(categoria);
    condiciones.push(`categoria = $${params.length}`);
  }
  if (disponible === 'true' || disponible === 'false') {
    params.push(disponible === 'true');
    condiciones.push(`disponible = $${params.length}`);
  }
  const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';

  // Total de resultados (para saber cuántas páginas hay)
  const total = (await pool.query(`SELECT count(*)::int AS n FROM equipos ${where}`, params)).rows[0].n;

  // Página actual: ORDER BY (de la lista blanca) + LIMIT/OFFSET parametrizados
  const orderBy = ORDENES[orden] ?? ORDENES.codigo;
  const offset = (pagina - 1) * POR_PAGINA;
  const filas = (
    await pool.query(
      `SELECT id, codigo, nombre, categoria, disponible
       FROM equipos ${where}
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, POR_PAGINA, offset]
    )
  ).rows;

  return { filas, total };
}

export async function categorias() {
  const r = await pool.query('SELECT DISTINCT categoria FROM equipos ORDER BY categoria');
  return r.rows.map((f) => f.categoria);
}

// Equipo + usuario que lo tiene ahora (LEFT JOIN: si no hay préstamo activo, sigue saliendo el equipo)
export async function obtenerConPrestatario(id) {
  const r = await pool.query(
    `SELECT e.id, e.codigo, e.nombre, e.categoria, e.disponible, u.nombre AS prestado_a
     FROM equipos e
     LEFT JOIN prestamos p ON p.equipo_id = e.id AND p.fecha_devolucion IS NULL
     LEFT JOIN usuarios u ON u.id = p.usuario_id
     WHERE e.id = $1`,
    [id]
  );
  return r.rows[0]; // undefined si no existe
}

// Historial de préstamos (JOIN con usuarios)
export async function historial(id) {
  const r = await pool.query(
    `SELECT p.id, u.nombre AS usuario, p.fecha_prestamo, p.fecha_devolucion
     FROM prestamos p
     JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.equipo_id = $1
     ORDER BY p.fecha_prestamo DESC`,
    [id]
  );
  return r.rows;
}

export async function crear({ codigo, nombre, categoria }) {
  const r = await pool.query(
    'INSERT INTO equipos (codigo, nombre, categoria) VALUES ($1, $2, $3) RETURNING *',
    [codigo, nombre, categoria]
  );
  return r.rows[0];
}

// No toca "disponible": eso solo cambia al prestar/devolver
export async function actualizar(id, { codigo, nombre, categoria }) {
  const r = await pool.query(
    'UPDATE equipos SET codigo = $1, nombre = $2, categoria = $3 WHERE id = $4 RETURNING *',
    [codigo, nombre, categoria, id]
  );
  return r.rows[0]; // undefined si rowCount = 0
}

export async function borrar(id) {
  const r = await pool.query('DELETE FROM equipos WHERE id = $1', [id]);
  return r.rowCount > 0;
}
