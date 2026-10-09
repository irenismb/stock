# Natura — mapa de archivos

Google Drive es la fuente de trabajo. Los cambios autorizados se verifican en Drive, se sincronizan con GitHub y se publican en la misma tarea, conforme a las reglas del proyecto.

## Sitio público

- `catalogo.html`: entrada principal del catálogo, orden de carga de recursos y arranque de `init()` cuando todos los módulos ya están disponibles.
- `catalogo.css`: estilos generales y responsive.
- `catalogo-app.js`: núcleo del catálogo: configuración, datos, productos, filtros, navegación y renderizado.
- `catalogo-carrito-pedido.js`: carrito, cliente, dirección, resumen PNG, registro de pedido y salida por WhatsApp.
- `catalogo-herramientas.js`: herramienta única Folleto: snapshot, layout y renderer comunes con salidas PNG y documento PDF. No controla el arranque del catálogo.
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

- `apps-script/`: espejo de trabajo del código Apps Script. Flujo autorizado: Drive → GitHub; actualizar Apps Script y su implementación cuando la funcionalidad del cambio lo requiera.
- `lectura de carpetas en natura`: proyecto Apps Script real visible en Drive; es destino de ejecución, no fuente normal de edición.

## Regla de mantenimiento

Conservar los nombres públicos y técnicos estables salvo necesidad real. Dividir archivos solo cuando exista una responsabilidad clara y la separación reduzca riesgo de mantenimiento sin cambiar el comportamiento público.

## Archivo

Los recursos retirados de producción se conservan fuera de la carpeta activa, en la carpeta de archivo definida para el proyecto.

## Asesoría y lectura de productos

- Productos conserva sus columnas originales y añade al final Necesidades de asesoría, Modo de uso y Adecuado para. Las necesidades usan etiquetas confirmadas separadas por punto y coma; los datos no confirmados quedan vacíos.
- La página permite filtrar necesidades, marca, línea, tipo, variante, presentación, público y presupuesto. Los precios vacíos continúan como pendientes; cada componente de un kit mantiene su cantidad, contenido y unidad.
- Mi selección se comparte con Folleto. Comparación admite hasta tres productos; WhatsApp abre una recomendación para revisar y enviar, con enlace a los códigos seleccionados.
- La navegación conserva ORDEN_NAVEGACION y la ocultación heredada. Omitir Producto no abre fichas; sin niveles activos no se muestran niveles ni productos.
- La fuente pública de productos es el despliegue aislado de solo lectura, con modo=productos. Publica una lista explícita de campos, excluye Costo y Referencia externa, y filtra productos ocultos, Medicamentos y No a la venta en el servidor.
- La fuente original del lector es el archivo Drive 1cDgWj3dVi515ZX-qxhWNyv7dXq0JgKuy, reflejado en apps-script/lector publico natura/Lector.js. El despliegue usa el scriptId existente; su versión pública permanece aislada del código administrativo.
- El puente administrativo autenticado obtiene el inventario completo según los permisos de la cuenta Google. Al salir se retiran los costos de memoria y se recupera la fuente pública. Los costos no se guardan en la selección ni en recomendaciones.
- El inventario oficial se restringe a propietario y colaboradores después de confirmar que la interfaz y el lector público funcionan; no se modifica la titularidad ni los permisos de las cuentas existentes.
