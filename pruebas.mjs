// Script de pruebas manuales: con el servidor arrancado, ejecutar "npm run pruebas"
const BASE = `http://localhost:${process.env.PORT || 3000}`;

async function llamar(metodo, ruta, cuerpo) {
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  console.log(`${metodo} ${ruta} -> ${res.status} ${texto.slice(0, 120)}`);
  return { status: res.status, datos: texto ? JSON.parse(texto) : null };
}

const sufijo = Date.now().toString().slice(-6);

console.log('\n== Alta y modificación ==');
const alta = await llamar('POST', '/api/equipos', { codigo: 'T-' + sufijo, nombre: 'Equipo prueba', categoria: 'Prueba' });
await llamar('POST', '/api/equipos', { codigo: 'T-' + sufijo, nombre: 'Repetido', categoria: 'Prueba' }); // 409
await llamar('PUT', `/api/equipos/${alta.datos.id}`, { codigo: 'T-' + sufijo, nombre: 'Equipo modificado', categoria: 'Prueba' }); // 200
await llamar('PUT', '/api/equipos/999999', { codigo: 'X', nombre: 'X', categoria: 'X' }); // 404

console.log('\n== Préstamo, duplicado y rollback ==');
const p1 = await llamar('POST', '/api/prestamos', { equipoId: alta.datos.id, usuarioId: 1 }); // 201
await llamar('POST', '/api/prestamos', { equipoId: alta.datos.id, usuarioId: 2 }); // 409
await llamar('DELETE', `/api/equipos/${alta.datos.id}`); // 409 (tiene préstamos)

console.log('\n== Devolución ==');
await llamar('POST', `/api/prestamos/${p1.datos.id}/devolucion`); // 200
await llamar('POST', `/api/prestamos/${p1.datos.id}/devolucion`); // 409

console.log('\n== Rollback: usuario inexistente ==');
const e2 = await llamar('POST', '/api/equipos', { codigo: 'R-' + sufijo, nombre: 'Equipo rollback', categoria: 'Prueba' });
await llamar('POST', '/api/prestamos', { equipoId: e2.datos.id, usuarioId: 9999 }); // 404
const page = await (await fetch(`${BASE}/equipos/${e2.datos.id}`)).text();
console.log('El equipo sigue disponible:', page.includes('Estado: Disponible'));

console.log('\n== Borrado ==');
await llamar('DELETE', `/api/equipos/${e2.datos.id}`); // 204
await llamar('DELETE', `/api/equipos/${e2.datos.id}`); // 404

console.log('\n== Simultaneidad (dos préstamos a la vez) ==');
const e3 = await llamar('POST', '/api/equipos', { codigo: 'S-' + sufijo, nombre: 'Equipo concurrencia', categoria: 'Prueba' });
const [a, b] = await Promise.all([
  llamar('POST', '/api/prestamos', { equipoId: e3.datos.id, usuarioId: 1 }),
  llamar('POST', '/api/prestamos', { equipoId: e3.datos.id, usuarioId: 2 }),
]);
console.log('Estados:', [a.status, b.status].sort()); // [201, 409]

console.log('\n== Validación ==');
await llamar('GET', '/equipos/abc'); // 400
await llamar('GET', '/equipos/999999'); // 404
await llamar('POST', '/api/equipos', { codigo: '', nombre: 'x', categoria: 'y' }); // 400
