# Apps Script de Natura

Esta carpeta de Google Drive es la fuente de trabajo del código Apps Script de Natura. GitHub conserva el historial y realiza la publicación automática hacia los proyectos reales de Google Apps Script.

## Proyectos oficiales

- `administrar precios natura`
- `pedidos natura`
- `lectura de carpetas en natura`
- `coordenadas de visitantes natura`

## Fuente maestra y sincronización

- **Google Drive `stock/natura/apps-script` es la fuente de trabajo del código Apps Script del proyecto.**
- El flujo normal y obligatorio es **Google Drive → GitHub → Google Apps Script**.
- Primero se modifica en Google Drive. Después se sincronizan a GitHub exactamente los mismos archivos. Finalmente GitHub Actions publica automáticamente en el mismo proyecto y deployment oficial de Apps Script.
- El proyecto real de Google Apps Script es un destino de ejecución y despliegue, no la fuente normal de edición.
- No se usa `clasp pull` para sobrescribir GitHub o Google Drive desde Apps Script dentro del flujo normal.
- La publicación automática valida el `scriptId`, el nombre del proyecto y el deployment oficial antes de ejecutar `clasp push --force`.
- La automatización no puede crear ni renombrar proyectos, cambiar `scriptId`, crear deployments sustitutos ni cambiar endpoints. Si una validación falla, la publicación afectada se detiene.

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
