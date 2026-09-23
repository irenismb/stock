# Natura — mapa de archivos

Google Drive es la fuente de trabajo. GitHub solo se sincroniza cuando el usuario lo ordena expresamente.

## Sitio público

- `catalogo.html`: entrada principal del catálogo, orden de carga de recursos y arranque de `init()` cuando todos los módulos ya están disponibles.
- `catalogo.css`: estilos generales y responsive.
- `catalogo-app.js`: núcleo del catálogo: configuración, datos, productos, filtros, navegación y renderizado.
- `catalogo-carrito-pedido.js`: carrito, cliente, dirección, resumen PNG, registro de pedido y salida por WhatsApp.
- `catalogo-herramientas.js`: herramientas administrativas SPRE y Folleto/collage. No controla el arranque del catálogo.
- `catalogo-ui.js`: ajustes de experiencia visual y comportamiento de interfaz.
- `precios-admin-config.js`: endpoint/configuración del administrador.
- `precios-admin.js`: interfaz administrativa de precios, visibilidad y controles.
- `analytics-visitas.js`: registro y lectura de analítica de visitas.

## Recursos técnicos públicos

- `robots.txt`: directivas para buscadores.
- `sitemap.xml`: mapa del sitio.
- `google8559800fc0ba033d.html`: verificación de Google; no renombrar.
- `logos/`: imágenes y recursos gráficos usados por el catálogo.

## Apps Script

- `apps-script/`: espejo de trabajo del código Apps Script. Flujo autorizado: Drive → GitHub, solo por orden expresa del usuario → Apps Script.
- `lectura de carpetas en natura`: proyecto Apps Script real visible en Drive; es destino de ejecución, no fuente normal de edición.

## Regla de mantenimiento

Conservar los nombres públicos y técnicos estables salvo necesidad real. Dividir archivos solo cuando exista una responsabilidad clara y la separación reduzca riesgo de mantenimiento sin cambiar el comportamiento público.

## Archivo

Los recursos retirados de producción se conservan fuera de la carpeta activa, en la carpeta de archivo definida para el proyecto.
