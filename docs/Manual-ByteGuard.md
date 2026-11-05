# ByteGuard
## Manual de instalación, uso y mantenimiento

Blog educativo de ciberseguridad

Integrantes: __________________________________________________
_____________________________________________________________

Institución: __________________________________________________
_____________________________________________________________

Fecha: ______________________________________________________

Proyecto versión 2.0.0 · Guía para Windows y PowerShell

<!-- page -->
# 1. Introducción y objetivo
## Introducción
Este documento explica cómo preparar, instalar y utilizar ByteGuard, un blog educativo de ciberseguridad en español. Incluye la puesta en marcha local, la creación de cuentas, el proceso editorial, el cambio de contraseñas, el mantenimiento de los datos y la solución de problemas frecuentes.

Está dirigido a estudiantes, docentes, escritores y responsables de administrar la instalación. Las instrucciones parten del código fuente existente del proyecto; no constituyen un tutorial para programar todo el sistema desde cero. Las capturas permiten reconocer las pantallas y relacionar las instrucciones con la interfaz.

## Objetivo general
Orientar al usuario para instalar, ejecutar y administrar ByteGuard, y publicar contenidos educativos mediante un proceso organizado de escritura, revisión y aprobación que conserve la información en una base de datos.

## Objetivos específicos
- Identificar los componentes y requisitos del proyecto.
- Ejecutar el servidor y comprobar el acceso desde el navegador.
- Gestionar cuentas y contraseñas según las funciones de cada usuario.
- Crear, revisar y publicar artículos con fuentes y contenido legible.
- Realizar copias de seguridad y reconocer errores comunes.

## Contenido del manual
1. Introducción y objetivo.
2. Materiales y requisitos.
3. Instalación y arranque.
4. Cuentas y contraseñas.
5. Procedimiento editorial y uso.
6. Mantenimiento y eliminación de cuentas.
7. Solución de problemas y verificación.
8. Evidencias visuales.
9. Buenas prácticas y sugerencias.
10. Conclusiones y referencias del proyecto.

<!-- page -->
# 2. Materiales y requisitos
## Software y archivos necesarios
- Equipo con Windows y PowerShell para seguir los comandos de esta guía.
- Node.js 20 o superior, según package.json. El README registra una validación local con Node.js 20.19; esto no garantiza compatibilidad con cualquier versión futura.
- npm, incluido habitualmente con Node.js, para instalar dependencias y ejecutar tareas.
- Navegador con JavaScript y cookies habilitados. Las pruebas incluidas utilizan Chrome; se puede seleccionar Edge.
- Código completo del proyecto, incluidos package.json, package-lock.json, server.js, config.js, db/, routes/, middleware/, utils/ y scripts/.
- Conexión a Internet durante la descarga de herramientas y dependencias. El uso local del contenido instalado no necesita un servicio externo de base de datos.
- Permiso de escritura en la carpeta del proyecto para crear la base de datos y las copias de seguridad.
- Editor de texto, como el que uses para HTML, CSS y JavaScript, si vas a modificar el código. Microsoft Word es útil para editar este manual, pero no es necesario para ejecutar el sitio.

## Capacidad del equipo
El repositorio no establece un mínimo medido de memoria RAM, procesador o almacenamiento. Se necesita capacidad para ejecutar Node.js y un navegador simultáneamente, y espacio libre para dependencias, base de datos y respaldos. Estas condiciones deben comprobarse en el equipo de destino; no son resultados de una prueba de rendimiento.

## Componentes del proyecto
- Interfaz: index.html, styles.css y script.js.
- Servidor y API: Node.js con Express, server.js y rutas de la carpeta routes/.
- Persistencia: SQLite mediante better-sqlite3. Ruta predeterminada: data/byteguard.db.
- Seguridad y acceso: contraseñas protegidas con bcrypt y sesiones verificadas en el servidor.
- Herramientas: scripts de cuentas, copias de seguridad y pruebas.

No se necesita Apache, XAMPP ni un servidor MySQL. SQLite funciona mediante un archivo gestionado por la aplicación.

<!-- page -->
# 3. Instalación y arranque
## Paso 1. Preparar la carpeta
Extrae o copia el proyecto completo a una carpeta local. Abre PowerShell en esa carpeta. En el equipo usado para este proyecto, la ruta es:
```powershell
cd "C:\Users\Usuario\Downloads\Proyecto de Grado - Kristen y  Erick"
```
Si lo copiaste a otra ubicación, sustituye la ruta. Comprueba que package.json se encuentra allí.

## Paso 2. Comprobar herramientas
```powershell
node --version
npm.cmd --version
```
Ambos comandos deben mostrar su versión. Si no se reconocen, instala Node.js con npm y abre una terminal nueva.

## Paso 3. Instalar dependencias
```powershell
npm.cmd install
```
Espera a que termine sin errores. Se crea node_modules. No continúes con el arranque si la instalación quedó incompleta.

## Paso 4. Iniciar el servidor
```powershell
npm.cmd start
```
El resultado esperado es el mensaje «ByteGuard disponible en http://localhost:3000». Mantén esta terminal abierta y visita http://localhost:3000 en el navegador. No abras index.html directamente, porque las cuentas y los artículos necesitan la API.

## Paso 5. Comprobar y detener
Verifica que se muestra el blog y que puedes abrir un artículo. La primera ejecución crea la base de datos y los contenidos iniciales; los siguientes arranques conservan los datos. Para detener el servidor pulsa Ctrl + C en su terminal. Para volver a usarlo ejecuta npm.cmd start; no hace falta reinstalar las dependencias cada vez.

Para trabajar en el código con reinicio automático del servidor puedes usar npm.cmd run dev. La instalación local funciona con la configuración predeterminada; no necesitas copiar .env.example para una prueba básica.

<!-- page -->
# 4. Cuentas y contraseñas
## Paso 6. Crear o acceder a una cuenta
Visitante: puede consultar el blog. Escritor: puede preparar artículos, enviarlos a revisión, guardar lecturas y comentar. Administrador: revisa publicaciones, modera comentarios y gestiona escritores.

Para registrarte, abre Acceso editorial y selecciona Crear una cuenta de escritor. Completa el nombre, correo y contraseña. El registro público no concede administración.

En una instalación nueva sin administradores, aparece Configurar ByteGuard. Crea la primera cuenta desde el equipo local. Este asistente deja de estar disponible después de la creación y no funciona en producción. Para crear otro administrador, abre otra terminal en la carpeta del proyecto:
```powershell
npm.cmd run admin:create
```
Introduce correo, nombre y contraseña cuando se soliciten. Si la cuenta ya existe, utiliza la recuperación descrita abajo. No hay contraseñas universales ni credenciales fijas incluidas en este manual.

## Paso 7. Cambiar una contraseña conocida
Inicia sesión y abre Mi espacio → Mi perfil y contraseña → Cambiar contraseña. Escribe la contraseña actual y la nueva; pulsa Actualizar contraseña. La aplicación invalida las sesiones anteriores y mantiene una sesión renovada para el usuario que realiza el cambio.

## Paso 8. Restablecer una contraseña olvidada
Desde otra terminal de PowerShell, en la carpeta del proyecto:
```powershell
npm.cmd run account:reset
```
1. Introduce el correo de la cuenta existente.
2. Escribe la nueva contraseña y repítela. No aparece mientras escribes.
3. Espera la confirmación y vuelve a entrar desde Acceso editorial.

El asistente acepta entre 8 y 72 bytes, conserva el rol y los artículos, cierra las sesiones anteriores y reactiva una cuenta suspendida. Los caracteres acentuados pueden ocupar más de un byte. Esta herramienta requiere acceso al equipo administrador; no envía correos de recuperación.

<!-- page -->
# 5. Procedimiento editorial y uso
## Paso 9. Crear y guardar un artículo
1. Inicia sesión y abre Mi espacio → Nuevo artículo.
2. Completa título, resumen, categoría y contenido. El editor admite Markdown y HTML seguro.
3. Organiza la lectura con subtítulos, párrafos breves, listas y enlaces a las fuentes. Consulta Vista previa para comprobar el formato.
4. Pulsa Guardar borrador. El guardado es manual: confirma que terminó antes de cerrar el editor.
5. Cuando el texto esté listo, pulsa Enviar a revisión.

## Paso 10. Revisar y publicar
1. Entra con una cuenta de administrador y abre Revisión editorial.
2. Lee el artículo completo. Comprueba claridad, fuentes y ausencia de datos privados.
3. Aprueba el contenido para publicarlo o devuélvelo con observaciones.
4. El escritor corrige el borrador devuelto y lo envía de nuevo.
5. Comprueba que el artículo aprobado aparece en el blog y que abre mediante su enlace /articulo/slug. También se incorpora al RSS.

El flujo es: borrador → revisión → publicado. Para corregir un artículo publicado, administración debe usar Gestionar → Retirar publicación e indicar el motivo; la siguiente versión requiere revisión. Solo se eliminan artículos en borrador, con confirmación. Si aparece un conflicto de versión, vuelve a abrir el artículo antes de editarlo para evitar sobrescribir cambios de otra persona.

## Paso 11. Usar las funciones de la comunidad
- Busca lecturas por texto o categoría y utiliza la paginación.
- Con una sesión iniciada, guarda artículos y consúltalos en Lecturas guardadas.
- Envía comentarios respetuosos. Quedan pendientes hasta que administración los aprueba.
- Desde Comentarios, administración puede aprobar o rechazar aportes.
- Desde Equipo, administración puede suspender o reactivar escritores. La suspensión cierra sus sesiones y conserva su contenido. No permite suspender administradores.
- Utiliza /feed.xml para seguir publicaciones en un lector RSS. El proyecto no envía boletines automáticos por correo.

<!-- page -->
# 6. Mantenimiento y eliminación de cuentas
## Paso 12. Crear una copia de seguridad
Ejecuta desde la carpeta del proyecto:
```powershell
npm.cmd run backup
```
Espera la confirmación con la ruta del archivo generado en backups/. El script crea una copia coherente de SQLite, incluso con el servidor activo. Conserva respaldos fuera de la carpeta de trabajo, en una ubicación privada, y comprueba periódicamente la restauración sobre una copia de prueba.

## Restaurar una copia
1. Detén todas las instancias de ByteGuard que usen esa base de datos.
2. Conserva una copia completa del directorio data actual antes de modificarlo.
3. Sustituye data/byteguard.db por el respaldo elegido. Si configuraste DATABASE_PATH, utiliza esa ruta.
4. Retira los archivos de esa misma base terminados en -wal y -shm que correspondan al estado anterior, después de conservar la copia y con el servidor detenido.
5. Reinicia y verifica cuentas y artículos. La restauración devuelve la base al momento del respaldo, por lo que puede perder cambios posteriores.

## Paso 13. Preparar la eliminación de una cuenta
No hay un botón de eliminación de cuentas en la interfaz. El bloque de la página siguiente permite borrar una cuenta concreta desde PowerShell. Antes, comprueba el acceso con el administrador que conservarás y ejecuta la copia de seguridad del paso 12.

La operación conserva los artículos, pero elimina su vínculo con la cuenta de autor. También conserva el historial editorial sin vincularlo a esa cuenta. Elimina las sesiones, los comentarios y los guardados de la cuenta. No es equivalente a suspender un escritor.

El bloque impide la eliminación si no queda otro administrador activo. Cambia únicamente CORREO_A_ELIMINAR por el correo exacto y copia el bloque completo, incluidos los delimitadores de PowerShell. El delimitador final debe comenzar al inicio de la línea.

<!-- page -->
## Código para eliminar una cuenta
```powershell
@'
const { db } = require('./db/database');
const email = 'CORREO_A_ELIMINAR';

try {
  db.transaction(() => {
    const user = db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).get(email);
    if (!user) throw new Error('No existe ese correo.');

    const remaining = db.prepare(
      "SELECT COUNT(*) AS total FROM users " +
      "WHERE role = 'admin' AND active = 1 AND id != ?"
    ).get(user.id);
    if (!remaining.total) {
      throw new Error('Debe quedar un administrador activo.');
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    console.log('Cuenta eliminada:', email);
  }).immediate();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
'@ | node
```
Resultado esperado: «Cuenta eliminada:» y el correo elegido. Si aparece un error, revisa el mensaje antes de repetir la operación. No borres el archivo de la base de datos para eliminar una cuenta: contiene también el resto de las cuentas y los artículos.

<!-- page -->
# 7. Solución de problemas y verificación
## Error EADDRINUSE
El puerto ya está ocupado. Primero abre http://localhost:3000: puede que ByteGuard ya esté funcionando. Para reiniciarlo, detén la instancia anterior con Ctrl + C en su terminal. No cierres procesos desconocidos. Como alternativa, inicia en otro puerto:
```powershell
$env:PORT = "3001"
npm.cmd start
```
Abre http://localhost:3001. Esta variable se aplica a la terminal actual. Si tienes SITE_URL configurado en .env, ajústalo a esa dirección para que los enlaces generados coincidan.

## Otros problemas frecuentes
- npm.ps1 bloqueado: utiliza npm.cmd, como en esta guía, sin cambiar la política de PowerShell.
- Node o npm no reconocidos: comprueba su instalación y abre una terminal nueva.
- Falta package.json: entra en la carpeta raíz correcta con cd.
- No abre el sitio: comprueba que el servidor sigue activo y que la dirección usa el puerto mostrado en la terminal.
- Acceso rechazado: revisa el correo, la contraseña y el estado de la cuenta. Usa account:reset desde el equipo administrador cuando corresponda.
- Error durante npm install: guarda el mensaje completo, comprueba red, permisos y compatibilidad de Node. No borres data/ para resolver una instalación de dependencias.

## Paso 14. Verificar después de cambios de código
```powershell
npm.cmd test
npm.cmd run test:browser
npm.cmd audit --omit=dev
```
Las pruebas usan bases temporales y cuentas de prueba. La prueba de navegador utiliza Chrome instalado; para seleccionar Edge antes de ejecutarla:
```powershell
$env:BROWSER_CHANNEL = "msedge"
```
Registra fecha, comando, resultado y mensaje de error si lo hay. La auditoría consulta las dependencias y necesita acceso a su servicio. La existencia de estos comandos o de capturas anteriores no significa que las pruebas hayan pasado en el equipo del lector. No se volvieron a ejecutar para redactar este manual.

<!-- page -->
# 8. Evidencias visuales
## Evidencia 1. Editor de artículos
![Editor de artículos](../artifacts/editor-desktop.png)
Figura 1. Formulario de redacción con título, resumen, categoría, formato Markdown y acceso a la vista previa.

La captura permite identificar los campos del paso 9. El texto es una muestra educativa; no incluye credenciales. El aviso de cambios pendientes recuerda que el usuario debe guardar el borrador.

Procedencia: artifacts/editor-desktop.png. Captura existente del proyecto, con fecha de archivo 24/09/2026. El script scripts/browser-test.js genera este tipo de evidencia sobre una base temporal.

Alcance: es evidencia visual de una ejecución anterior. No demuestra por sí sola el funcionamiento actual de todas las funciones ni sustituye una prueba en el equipo donde se instalará el proyecto.

<!-- page -->
## Evidencia 2. Administración
![Panel de administración](../artifacts/admin-desktop.png)
Figura 2. Panel de administración con publicaciones, estadísticas y navegación hacia revisión, equipo, comentarios y perfil.

Procedencia: artifacts/admin-desktop.png, fecha de archivo 24/09/2026. Las cantidades mostradas corresponden al escenario capturado y no al estado actual de la base de datos del usuario.

<!-- page -->
## Evidencia 3. Lectura publicada
![Artículo publicado](../artifacts/article-desktop.png)
Figura 3. Artículo de ejemplo con autoría, índice de lectura, guardado y comentarios moderados.

Procedencia: artifacts/article-desktop.png, fecha de archivo 24/09/2026. Relaciona el resultado del proceso editorial con la lectura pública.

<!-- page -->
# 9. Buenas prácticas y sugerencias de uso
## Cuentas y datos
- Usa cuentas individuales y contraseñas únicas. Evita compartir la cuenta de administrador para escribir artículos cotidianos.
- Mantén al menos un administrador activo y comprueba su acceso antes de eliminar otra cuenta.
- Protege data/, backups/ y .env. No incluyas claves, contraseñas o bases con datos personales en entregas públicas.
- Haz un respaldo antes de operaciones de mantenimiento y comprueba su recuperación.
- El restablecimiento local reactiva cuentas suspendidas: úsalo cuando esa reactivación sea apropiada.

## Calidad editorial
- Escribe títulos claros y resúmenes que describan el contenido real.
- Cita las fuentes y distingue una opinión de una afirmación verificable.
- Revisa ortografía, enlaces y vista previa antes de enviar a revisión.
- Usa ejemplos ficticios sin datos privados y evita publicar contraseñas o información personal en capturas.
- Guarda con frecuencia y evita editar el mismo artículo simultáneamente desde varias ventanas.

## Uso educativo sugerido
Organiza una actividad con un escritor y un revisor: el primero redacta una guía breve, el segundo devuelve observaciones y finalmente aprueba una versión corregida. Comprueba la publicación desde una sesión de visitante y comenta el contenido con una cuenta de prueba.

Para una presentación, prepara un artículo de ejemplo y una copia de los datos. Muestra el recorrido completo: borrador, revisión y publicación. Usa una instalación de práctica para probar eliminaciones o recuperaciones.

## Antes de publicar en Internet
El funcionamiento en localhost no equivale a un despliegue público. Prepara un servidor con almacenamiento persistente, dominio, HTTPS, proxy y copias periódicas. El README documenta NODE_ENV=production, JWT_SECRET aleatorio de al menos 32 caracteres, SITE_URL y DATABASE_PATH. La aplicación confía en un salto de proxy; configura el entorno conforme a ese diseño. No publiques con la clave de ejemplo.

<!-- page -->
# 10. Conclusiones
ByteGuard reúne una interfaz de lectura, un proceso editorial y una base de datos persistente. Su instalación local depende de Node.js, las dependencias del proyecto y un navegador; no requiere un servidor de base de datos separado.

La separación entre escritor y administrador permite revisar los contenidos antes de publicarlos. El guardado manual, la revisión de fuentes y la moderación de comentarios apoyan un uso organizado del blog en un contexto educativo.

El mantenimiento debe incluir copias de seguridad, control de las cuentas y verificación después de cambios. Cambiar una contraseña, suspender un escritor, eliminar una cuenta y restaurar una base son acciones distintas con efectos diferentes; conocerlos ayuda a conservar la información necesaria.

Las evidencias incluidas muestran pantallas existentes del proyecto. La validación de una instalación nueva exige repetir el recorrido en su propio entorno y registrar los resultados, sin asumir que una captura demuestra todas las funciones.

## Referencias internas
- README.md: instrucciones de instalación, funciones y configuración.
- package.json: versión, requisitos y comandos disponibles.
- scripts/manage-account.js: creación de administradores y recuperación de cuentas.
- routes/auth.js: cambio de contraseña desde la sesión.
- routes/admin.js: revisión editorial y gestión de escritores.
- db/database.js: persistencia y relaciones entre los datos.
- scripts/backup.js: generación de respaldos.
- scripts/browser-test.js y artifacts/: pruebas de interfaz y capturas.

## Registro de comprobación de la instalación
Fecha: ____________________  Responsable: ____________________
Equipo y versión de Node.js: ___________________________________
Arranque y apertura del blog: __________________________________
Creación, revisión y publicación: _______________________________
Cambio de contraseña: ________________________________________
Copia de seguridad: ___________________________________________
Pruebas ejecutadas y resultados: _______________________________
Observaciones: ________________________________________________
