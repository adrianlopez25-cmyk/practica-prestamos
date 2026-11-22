-- Esquema propio de la práctica
DROP SCHEMA IF EXISTS practica_prestamos CASCADE;
CREATE SCHEMA practica_prestamos;
SET search_path TO practica_prestamos;

CREATE TABLE equipos (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo     VARCHAR(20) NOT NULL UNIQUE CHECK (char_length(codigo) BETWEEN 1 AND 20),
  nombre     TEXT NOT NULL CHECK (btrim(nombre) <> ''),
  categoria  TEXT NOT NULL CHECK (btrim(categoria) <> ''),
  disponible BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE usuarios (
  id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL CHECK (btrim(nombre) <> '')
);

-- Sin ON DELETE CASCADE: no se puede borrar un equipo con historial
CREATE TABLE prestamos (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  equipo_id        INTEGER NOT NULL REFERENCES equipos(id),
  usuario_id       INTEGER NOT NULL REFERENCES usuarios(id),
  fecha_prestamo   TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_devolucion TIMESTAMPTZ,
  CHECK (fecha_devolucion IS NULL OR fecha_devolucion >= fecha_prestamo)
);

-- Solo un préstamo activo por equipo
CREATE UNIQUE INDEX un_prestamo_activo_por_equipo
  ON prestamos (equipo_id) WHERE fecha_devolucion IS NULL;

INSERT INTO equipos (codigo, nombre, categoria) VALUES
  ('PORT-001', 'Portátil Lenovo ThinkPad', 'Portátil'),
  ('PORT-002', 'Portátil HP ProBook',      'Portátil'),
  ('PORT-003', 'Portátil Dell Latitude',   'Portátil'),
  ('TAB-001',  'Tableta Samsung Galaxy Tab', 'Tableta'),
  ('TAB-002',  'iPad 10.ª generación',     'Tableta'),
  ('PROY-001', 'Proyector Epson EB-X49',   'Proyector'),
  ('PROY-002', 'Proyector BenQ MW535',     'Proyector'),
  ('CAM-001',  'Webcam Logitech C920',     'Periférico'),
  ('MON-001',  'Monitor LG 24 pulgadas',   'Monitor'),
  ('MON-002',  'Monitor Dell 27 pulgadas', 'Monitor'),
  ('AUR-001',  'Auriculares Sony con micro', 'Periférico');

INSERT INTO usuarios (nombre) VALUES ('Ana López'), ('Carlos Ruiz'), ('Lucía Fernández');
