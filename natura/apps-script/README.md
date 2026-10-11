# Apps Script de Natura

Esta carpeta reúne en GitHub las fuentes de los proyectos Apps Script de Natura. Durante la preparación del repositorio independiente, los cambios de código se trabajan exclusivamente en GitHub. Los proyectos de Google Apps Script siguen siendo destinos de ejecución y despliegue; no se modifica Google Drive ni se activa ninguna publicación nueva por preparar el repositorio.

## Proyectos oficiales

- `administrar precios natura`
- `pedidos natura`
- `lectura de carpetas en natura`
- `coordenadas de visitantes natura`

## Origen de trabajo y continuidad (2026-10-11)

- Se trabaja temporalmente el código en GitHub, en `irenismb/stock/natura/apps-script/`. El cambio definitivo de fuente principal no está aprobado ni desplegado.
- No ejecutar sincronización GitHub → Google Drive ni Drive → GitHub durante esta preparación. La dirección final, la conciliación de versiones y los permisos deberán decidirse y validarse expresamente.
- Las publicaciones vigentes de Apps Script proceden de los workflows operativos situados en `stock/.github/workflows/`; los flujos preparados bajo `natura/.github/workflows/` no se ejecutan desde el repositorio `stock`.
- Antes de publicar desde el repositorio individual, verificar `scriptId`, implementación, secreto, permisos y relación con cada proyecto remoto. No activar dos publicadores ni usar `clasp push --force` con identidades no conciliadas.
- `lector publico natura/.clasp.json` y `administrar precios natura/.clasp.json` señalan actualmente el mismo `scriptId`. No publicar el lector mediante sobrescritura temporal del código administrativo: el workflow futuro incorpora una protección que bloquea esta operación hasta resolverla.
- `google-projects.json` documenta el flujo anterior Drive → GitHub. Se conserva por ahora sin cambiar su estructura técnica y no debe tomarse como autorización de sincronización.
- Las operaciones con datos comerciales, inventario, precios, pedidos y servicios publicados requieren autorización independiente.

## Pedidos Natura

El proyecto `pedidos natura` está dividido por responsabilidades sin cambiar sus endpoints ni la validación contra el inventario oficial:

- `Código.js`: configuración, `doGet`, `doPost` y orquestación principal del registro de pedidos.
- `pedidos-tablas.js`: resolución segura de tablas y encabezados requeridos.
- `pedidos-inventario.js`: normalización de productos, consulta del inventario oficial y cálculo de precios/envío.
- `pedidos-registro.js`: escritura del movimiento, numeración consecutiva y dirección enriquecida con enlace a Maps.
- `pedidos-solicitudes.js`: idempotencia mediante `client_request_id`, registro temporal de solicitudes, sanitización y respuestas JSON/JSONP.

Las funciones públicas `doGet` y `doPost` permanecen en `Código.js`; la separación solo redistribuye funciones internas del mismo proyecto Apps Script.

## Lectura de carpetas Natura

El proyecto `lectura de carpetas en natura` está dividido por responsabilidades sin cambiar su endpoint público ni sus funciones manuales de mantenimiento:

- `Código.js`: configuración y `doGet` del índice público de imágenes.
- `imagenes-indice.js`: construcción del índice de productos, regalos y recursos web.
- `imagenes-utilidades.js`: normalización de carpetas, validación de imágenes, códigos de producto y datos públicos de archivos.
- `imagenes-cache.js`: lectura/escritura de caché y funciones manuales `clearImageIndexCache`, `refreshImageIndexCache` y `testIndex`.

El servicio sigue siendo de solo lectura sobre Google Drive: no mueve, elimina ni modifica archivos de productos.

## Coordenadas de visitantes Natura

El proyecto `coordenadas de visitantes natura` está dividido por responsabilidades sin cambiar sus funciones públicas:

- `Código.js`: configuración, `doGet`, `doPost`, pruebas manuales y orquestación principal del registro.
- `visitantes-identidad.js`: identificación del navegador, alias y reglas para visitas propias.
- `visitantes-validacion.js`: respuestas JSON/JSONP, parámetros, validación, normalización y resolución de encabezados.
- `visitantes-control.js`: duplicados, rate limit, modos de registro y estadísticas de visitas.
- `visitantes-servicios.js`: distancia, geocodificación inversa, caché de dirección y avisos por Telegram.

Las funciones públicas y nombres externos se conservan; la separación solo redistribuye funciones internas entre archivos del mismo proyecto Apps Script.

## Administración de precios

El proyecto `administrar precios natura` está dividido por responsabilidades sin cambiar sus funciones públicas ni los HTML existentes:

- `Código.js`: constantes compartidas, `doGet` y respuesta principal del servicio.
- `admin-configuracion.js`: lectura y actualización de controles de configuración.
- `admin-precios.js`: lectura y actualización segura de precios.
- `admin-visibilidad.js`: lectura y actualización de reglas de visibilidad.
- `admin-contextos.js`: resolución de hojas, encabezados y normalizaciones compartidas.
- `Admin.html` y `Puente.html`: interfaces existentes; no se cambian sus llamadas públicas.

La edición se ejecuta como la cuenta de Google que accede y requiere permiso sobre el inventario oficial. Los campos se resuelven por encabezados, el código de producto debe ser único y las escrituras críticas siguen protegidas con `LockService`.
