# Administrador de precios Natura

Este proyecto publica el servicio autenticado de Google Apps Script usado por el catálogo para administrar precios, reglas de visibilidad y controles públicos de configuración del inventario oficial.

## Arquitectura

- `Código.js`: constantes compartidas, `doGet` y respuesta pública inicial del servicio.
- `admin-configuracion.js`: lectura y actualización de controles de configuración.
- `admin-precios.js`: lectura y actualización segura del campo `Precio` de `Productos`.
- `admin-visibilidad.js`: lectura y actualización de reglas de la pestaña `Visibilidad`.
- `admin-contextos.js`: resolución de hojas, encabezados y normalizaciones compartidas.
- `Admin.html`: interfaz autenticada de administración de precios.
- `Puente.html`: puente autenticado que el catálogo carga de forma invisible para precios, visibilidad y configuración, sin abrir una ventana auxiliar durante el uso normal.

Las funciones públicas llamadas desde los HTML conservan exactamente sus nombres: `obtenerProductosPrecios`, `actualizarPrecioWeb`, `obtenerConfiguracionWeb`, `actualizarConfiguracionWeb`, `obtenerVisibilidadWeb` y `actualizarVisibilidadWeb`.

## Seguridad y consistencia

- la implementación se ejecuta como el usuario que accede;
- Google exige iniciar sesión y autorizar el script; el catálogo reutiliza esa sesión mediante un iframe invisible;
- la cuenta debe tener permiso de edición sobre el inventario oficial;
- el puente solo entrega el canal de administración al origen oficial `https://irenismb.github.io`;
- los campos se localizan por el texto de los encabezados, no por letras ni posiciones;
- el código del producto debe tener una coincidencia única;
- `LockService` evita escrituras simultáneas;
- el precio anterior se compara antes de guardar y el nuevo valor se relee después de escribir;
- la edición de precios no modifica el formato de las celdas ni otros campos del producto.

En el nivel de productos, el catálogo puede habilitar la edición autenticada de precios. El mismo proyecto también expone las operaciones administrativas de visibilidad y configuración utilizadas por el puente del catálogo.
