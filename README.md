# ByteGuard

Blog editorial de ciberseguridad en español. Interfaz adaptable, API Express y datos persistentes en SQLite. No necesita Apache ni XAMPP.

## Empieza aquí si nunca has usado este proyecto

ByteGuard es una página para leer y publicar artículos de ciberseguridad. Para abrirla necesitas poner en marcha un programa en tu computador y después entrar desde el navegador.

El [manual en Word](docs/Manual-ByteGuard.docx) explica cada paso con más detalle.

### Primera vez: abrir la ventana donde escribirás los comandos

1. Abre el **Explorador de archivos** de Windows.
2. Busca y abre la carpeta del proyecto. Debes ver el archivo **package.json**; Windows puede mostrarlo como **package** si oculta las extensiones.
3. Haz clic en la **barra de dirección** de esa ventana, donde aparece la ubicación de la carpeta. No uses el cuadro de búsqueda.
4. Escribe `powershell` y pulsa **Enter**. Se abrirá una ventana para escribir instrucciones; esa ventana se llama **terminal**.
5. En esa ventana, copia `node --version` y pulsa **Enter**. Debe aparecer una versión que empiece por `v20` o un número mayor. Si aparece «no se reconoce», necesitas instalar Node.js antes de continuar.

### Primera vez: preparar y abrir ByteGuard

Copia esta línea en PowerShell y pulsa **Enter**:

```powershell
npm.cmd install
```

Este comando descarga las piezas que necesita el proyecto. Necesita Internet. Espera hasta que termine y vuelva a aparecer la línea donde puedes escribir. Si aparece un error, resuélvelo antes de continuar.

Después copia esta otra línea y pulsa **Enter**:

```powershell
npm.cmd start
```

Cuando aparezca **ByteGuard disponible en http://localhost:3000**, deja PowerShell abierto. Abre Chrome o Edge, haz clic en la barra de dirección de arriba, escribe `http://localhost:3000` y pulsa **Enter**. Debes ver la portada del blog.

**No escribas los comandos en el navegador.** Los comandos van en PowerShell; la dirección `http://localhost:3000` va en el navegador. Copia solo las líneas del bloque, sin los símbolos que lo rodean.

### Las siguientes veces

1. Abre PowerShell desde la carpeta del proyecto como se explicó arriba.
2. Escribe `npm.cmd start` y pulsa **Enter**.
3. Abre `http://localhost:3000` en el navegador.
4. Para apagar ByteGuard, vuelve a PowerShell, mantén presionada **Ctrl** y pulsa **C**.

### Si aparece EADDRINUSE

Significa que esa dirección ya está siendo utilizada. Abre primero `http://localhost:3000`: si aparece ByteGuard, ya puedes usarlo. Si necesitas abrir otra instancia, escribe en PowerShell estas dos líneas, una a la vez, pulsando **Enter** después de cada una:

```powershell
$env:PORT = "3001"
npm.cmd start
```

En ese caso abre `http://localhost:3001` en el navegador.

### Si olvidaste tu contraseña

Deja abierta la terminal que mantiene el blog funcionando. Abre **otra ventana de PowerShell** desde la carpeta del proyecto y ejecuta:

```powershell
npm.cmd run account:reset
```

Escribe el correo de tu cuenta y pulsa **Enter**. Escribe la nueva contraseña, pulsa **Enter**, repítela y vuelve a pulsar **Enter**. Aunque no veas letras al escribir la contraseña, el programa sí la está recibiendo. Espera la confirmación y entra al blog con la nueva contraseña. Este comando también vuelve a habilitar una cuenta suspendida.

## Abrir el proyecto

Requisitos: Node.js 20 o posterior y npm. La validación local se realizó con Node.js 20.19 y Chrome.

```powershell
npm install
npm start
```

Abre **http://localhost:3000**. No abras `index.html` directamente: las cuentas, artículos y comentarios necesitan el servidor.

La primera ejecución crea `data/byteguard.db`. Las actualizaciones conservan los datos existentes. Se incluyen seis artículos educativos; los ejemplos originales sin editar se amplían una sola vez. Los textos modificados por usuarios se conservan.

## Acceder como escritor o administrador

- **Escritor:** pulsa **Acceso editorial → Crear una cuenta de escritor**. El registro público nunca concede administración.
- **Administrador existente:** pulsa **Acceso editorial** e inicia sesión. El servidor identifica el rol de la cuenta.
- **Instalación nueva:** si todavía no hay administradores, aparece **Configurar ByteGuard**. Crea tu cuenta desde el equipo local. El asistente se desactiva después de crear la primera cuenta y no está disponible en producción.
- **Crear otro administrador:** ejecuta `npm run admin:create`. El asistente solicita nombre, correo y contraseña sin mostrarla en pantalla.
- **Recuperar una cuenta:** ejecuta `npm run account:reset` desde el equipo que administra la aplicación. Solicita el correo existente y una nueva contraseña; cierra las sesiones anteriores. No modifica el rol ni los artículos. Esta herramienta requiere acceso al servidor.

No existen contraseñas universales. Las cuentas de administrador que ya estaban en la base de datos se conservan. También se mantiene `npm run seed:admin` para automatización con `ADMIN_NAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

### Cambiar o restablecer la contraseña

Si recuerdas tu contraseña, inicia sesión y abre **Mi espacio → Mi perfil y contraseña → Cambiar contraseña**. Escribe la contraseña actual y la nueva, y pulsa **Actualizar contraseña**.

Si la olvidaste, abre otra terminal de PowerShell en la carpeta del proyecto y ejecuta:

```powershell
npm.cmd run account:reset
```

1. Introduce el correo de la cuenta existente, ya sea de escritor o administrador.
2. Escribe la nueva contraseña y repítela para confirmarla. No se muestra mientras escribes.
3. Espera el mensaje de confirmación e inicia sesión desde **Acceso editorial** con la nueva contraseña.

El asistente acepta contraseñas de 8 a 72 bytes, conserva el rol y los artículos, cierra las sesiones anteriores y reactiva la cuenta si estaba suspendida. Úsalo únicamente desde el equipo que administra la instalación. No existe recuperación automática por correo ni una contraseña universal.

El manual completo de instalación, uso y mantenimiento está en [Manual de ByteGuard (Word)](docs/Manual-ByteGuard.docx).

### Eliminar una cuenta

Actualmente no hay un botón para eliminar cuentas desde la interfaz. Para eliminar una cuenta, incluidos los administradores, abre PowerShell en la carpeta del proyecto. Antes de continuar, comprueba que puedes iniciar sesión con el administrador que conservarás.

1. Crea una copia de seguridad y espera a que termine correctamente:

   ```powershell
   npm.cmd run backup
   ```

2. Sustituye `CORREO_A_ELIMINAR` por el correo exacto de la cuenta y ejecuta el bloque completo:

   ```powershell
   @'
   const { db } = require('./db/database');
   const email = 'CORREO_A_ELIMINAR';

   try {
     db.transaction(() => {
       const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
       if (!user) throw new Error('No existe ese correo.');

       const remaining = db.prepare(
         "SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND active = 1 AND id != ?"
       ).get(user.id);

       if (!remaining.total) throw new Error('Debe quedar un administrador activo.');

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

El bloque impide borrar una cuenta si no queda otro administrador activo. Los artículos se conservan y quedan sin una cuenta de autor vinculada; el historial editorial también se conserva, sin el vínculo a la cuenta eliminada. Se eliminan las sesiones, comentarios y guardados de esa cuenta. Para recuperar los datos eliminados necesitarás la copia de seguridad.

Si solo necesitas impedir el acceso de un escritor, puedes suspenderlo desde **Administración → Equipo**, conservando sus datos. El panel no permite suspender administradores.

## Flujo editorial

1. Abre **Mi espacio → Nuevo artículo**.
2. Escribe título, resumen, categoría y contenido. El editor admite Markdown y HTML seguro; la barra incluye subtítulos, negritas, enlaces, listas, citas y código.
3. Comprueba la **Vista previa** y pulsa **Guardar borrador**. Puedes continuar escribiendo. El guardado es manual y hay advertencia al cerrar con cambios pendientes.
4. Pulsa **Enviar a revisión**.
5. Administración abre el artículo completo desde **Revisión editorial**, lo aprueba o lo devuelve con observaciones.
6. Al aprobarlo aparece en el blog y en RSS con una URL `/articulo/slug`.
7. Para corregir un artículo publicado, administración usa **Gestionar → Retirar publicación**, indica el motivo y lo devuelve a borrador. La siguiente versión necesita otra revisión.

El historial registra creación, guardado, envío, devolución y publicación. El control de versión evita sobrescribir desde un editor desactualizado. Solo se eliminan borradores, con confirmación. Los autores pueden editar sus propios borradores y propuestas; administración puede gestionar todos los artículos.

## Funciones disponibles

- Portada con artículo destacado, catálogo completo, filtros por categoría, búsqueda sin distinguir acentos y paginación.
- Lecturas con enlace directo, índice, autor, fecha, tiempo estimado y artículos relacionados.
- Guardados asociados a la cuenta, disponibles entre dispositivos.
- Comentarios de usuarios autenticados: permanecen privados hasta su aprobación. Administración puede aprobar o rechazar y revisar los distintos estados.
- Panel de escritores con estadísticas y artículos propios.
- Panel de administración con revisión, publicaciones, equipo, comentarios y selección de portada. Puede suspender/reactivar escritores; la suspensión cierra sus sesiones y conserva el contenido.
- Perfil y cambio de contraseña verificando la actual.
- RSS en `/feed.xml`, mapa del sitio en `/sitemap.xml` y metadatos de cada artículo para compartir enlaces.
- Lista de hábitos de seguridad con progreso local, guía editorial y explicación de privacidad.
- Estados de carga, errores con reintento, resultados vacíos, navegación con teclado y diálogos con foco controlado.

La versión anterior anunciaba correos semanales sin un servicio de envío. La interfaz ahora ofrece **RSS real**. Los registros de suscripción antiguos se conservan y su API sigue disponible por compatibilidad; **no se envían correos automáticos**. Tampoco se simula una recuperación de contraseña por correo: se realiza con la herramienta local documentada.

## Datos y seguridad

SQLite almacena `users`, `posts`, `sessions`, `bookmarks`, `comments`, `editorial_events`, `subscriptions` y metadatos de migración. No se guardan cuentas, sesiones ni artículos en `localStorage`; solo se guarda ahí el progreso opcional de la lista de hábitos.

Contraseñas con bcrypt; cookies HttpOnly y SameSite; JWT con sesión revocable en base de datos; permisos comprobados en el servidor; consultas parametrizadas; HTML saneado; límites de solicitudes; comprobación de origen y cabeceras Helmet/CSP. El cambio de contraseña y la suspensión invalidan sesiones anteriores. Los archivos privados y las copias de seguridad no se sirven por HTTP.

En desarrollo, la clave de sesión se crea en `data/.session-secret` y se conserva entre reinicios. Está excluida de Git. En producción se exige `JWT_SECRET` de al menos 32 caracteres y las cookies usan Secure.

### Copias de seguridad

```powershell
npm run backup
```

Genera una copia coherente de SQLite en `backups/`, incluso con el servidor activo. Antes de esta actualización se creó una copia `backups/before-v2-*.db` de los datos existentes.

Para restaurar: detén el servidor, conserva una copia del directorio `data` actual, sustituye la base de datos por la copia elegida y retira los archivos WAL/SHM correspondientes al estado anterior antes de volver a iniciar. Guarda copias y claves de sesión en ubicaciones privadas.

## Configuración para publicar

Copia `.env.example` como `.env`, define `NODE_ENV=production`, un `JWT_SECRET` aleatorio, `SITE_URL` con el dominio HTTPS y la ruta persistente `DATABASE_PATH`. Usa un proxy HTTPS de confianza delante del servidor; la aplicación confía en un salto de proxy. Crea administración con `npm run admin:create` en el servidor y configura copias periódicas.

La aplicación está validada localmente. Dominio, hosting, HTTPS y despliegue externo se configuran en el entorno donde se publique.

## Verificación

```powershell
npm test
npm run test:browser
npm audit --omit=dev
```

Las pruebas utilizan bases temporales y cuentas aleatorias; no modifican tu base real. Las pruebas de navegador usan Chrome instalado. Para Edge en PowerShell: `$env:BROWSER_CHANNEL = 'msedge'`. Se generan capturas en `artifacts/`.

- API: autenticación, instalación inicial, permisos, saneamiento, revisión/devolución/publicación, conflictos de versión, filtros y paginación, comentarios, guardados, perfiles, revocación de sesiones y persistencia en disco.
- Navegador: flujo editorial completo, enlaces directos, búsqueda, filtros vacíos, reintento de errores, guardados, moderación, perfil, advertencia por cambios sin guardar y cierre de sesión.
- Diseño: comprobación de desbordamiento a 360, 390, 768, 1024 y 1440 píxeles; auditorías automáticas de accesibilidad en inicio, configuración, editor, artículo, administración y móvil. Estas comprobaciones automáticas no sustituyen una auditoría humana completa de accesibilidad.

## Estructura

```text
index.html / styles.css / script.js   Interfaz y navegación
server.js / config.js                Servidor y configuración
db/                                 Esquema, migraciones y artículos iniciales
routes/                             Autenticación, artículos, administración y comunidad
middleware/                         Sesiones, permisos y origen de solicitudes
utils/                              Validación y saneamiento
scripts/                            Pruebas, cuentas y copias de seguridad
data/                               Datos privados persistentes
```

El editor utiliza [markdown-it](https://github.com/markdown-it/markdown-it). Las pruebas de interfaz utilizan [Playwright](https://playwright.dev/docs/intro) y axe-core. Los artículos educativos incluyen sus fuentes originales dentro de cada lectura.
