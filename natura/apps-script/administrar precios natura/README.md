# Administrador de precios Natura

Este proyecto publica un panel de Google Apps Script para modificar únicamente el campo `Precio` de la pestaña `Productos` del inventario oficial.

Seguridad y consistencia:

- la implementación se ejecuta como el usuario que accede;
- Google exige iniciar sesión y autorizar el script;
- la cuenta debe tener permiso de edición sobre el inventario oficial;
- los campos se localizan por el texto de los encabezados, no por letras ni posiciones;
- el código del producto debe tener una coincidencia única;
- `LockService` evita escrituras simultáneas;
- el precio anterior se compara antes de guardar y el nuevo valor se relee después de escribir;
- no se modifica el formato de las celdas ni otro campo del producto.

El catálogo muestra el acceso solamente al abrirlo con `?administrar=precios`.
