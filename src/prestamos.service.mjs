import { pool, HttpError } from './db.mjs';

export async function prestar(equipoId, usuarioId) {
  const cliente = await pool.connect(); // UN solo cliente para toda la transacción
  try {
    await cliente.query('BEGIN');

    // 1) Actualización condicional: solo si está disponible.
    //    Si dos peticiones llegan a la vez, la segunda espera al COMMIT de la primera
    //    y al reevaluar el WHERE ya no lo encuentra disponible -> rowCount 0.
    const upd = await cliente.query(
      'UPDATE equipos SET disponible = false WHERE id = $1 AND disponible = true',
      [equipoId]
    );

    // 2) Si no se actualizó nada: o no existe o está ocupado
    if (upd.rowCount === 0) {
      const existe = await cliente.query('SELECT 1 FROM equipos WHERE id = $1', [equipoId]);
      throw existe.rowCount === 0
        ? new HttpError(404, 'El equipo no existe')
        : new HttpError(409, 'El equipo no está disponible');
    }

    // 3) Insertamos el préstamo (si el usuario no existe, falla la FK -> 23503)
    const ins = await cliente.query(
      'INSERT INTO prestamos (equipo_id, usuario_id) VALUES ($1, $2) RETURNING id',
      [equipoId, usuarioId]
    );

    // 4) Las dos escrituras han ido bien
    await cliente.query('COMMIT');
    return ins.rows[0].id;
  } catch (err) {
    await cliente.query('ROLLBACK'); // cualquier fallo deshace todo
    if (err.code === '23503') throw new HttpError(404, 'El usuario no existe');
    if (err.code === '23505') throw new HttpError(409, 'El equipo ya tiene un préstamo activo');
    throw err;
  } finally {
    cliente.release(); // siempre se devuelve el cliente al pool
  }
}

export async function devolver(prestamoId) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    // 1) Marca la devolución solo si el préstamo sigue activo
    const upd = await cliente.query(
      `UPDATE prestamos SET fecha_devolucion = now()
       WHERE id = $1 AND fecha_devolucion IS NULL
       RETURNING *`,
      [prestamoId]
    );

    if (upd.rowCount === 0) {
      const existe = await cliente.query('SELECT 1 FROM prestamos WHERE id = $1', [prestamoId]);
      throw existe.rowCount === 0
        ? new HttpError(404, 'El préstamo no existe')
        : new HttpError(409, 'El préstamo ya fue devuelto');
    }

    // 2) Mismo COMMIT: el equipo vuelve a estar disponible
    await cliente.query('UPDATE equipos SET disponible = true WHERE id = $1', [upd.rows[0].equipo_id]);

    await cliente.query('COMMIT');
    return upd.rows[0];
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}
