import pg from 'pg';

// Un único pool para toda la aplicación (lee la config de .env)
// "options" fija el esquema, así las consultas usan nombres de tabla sin prefijo.
export const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  options: '-c search_path=practica_prestamos',
});

// Error con código HTTP para respuestas controladas
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
