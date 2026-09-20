# Apps Script de Natura

Esta carpeta conserva en GitHub el espejo versionado de los proyectos oficiales de Google Apps Script usados por Natura.

## Proyectos oficiales

- `administrar precios natura`
- `pedidos natura`
- `lectura de carpetas en natura`
- `coordenadas de visitantes natura`

## Fuente maestra y sincronización

- **Google Apps Script es la fuente maestra del código que se ejecuta.**
- **Google Apps Script → GitHub** es el sentido normal de sincronización. El workflow **Traer Apps Script Natura desde Google** usa `clasp pull` y actualiza únicamente `natura/apps-script/`.
- Un Commit o Push normal en GitHub **no publica automáticamente** código hacia Google Apps Script.
- **GitHub → Google Apps Script** queda reservado para restauraciones o publicaciones excepcionales solicitadas expresamente.
- El workflow **Restaurar Apps Script Natura desde GitHub (manual)** exige seleccionar un proyecto oficial y escribir la confirmación `RESTAURAR_DESDE_GITHUB`.
- El workflow del administrador de precios también es manual y exige `PUBLICAR_ADMIN_DESDE_GITHUB`; no crea un proyecto nuevo si falta la identificación oficial.

Antes de una restauración desde GitHub se valida el `scriptId`, el nombre del proyecto y que el recurso de Google no esté en la papelera. No se renombra ni se sustituye un proyecto por otro de nombre parecido.

## Administración de precios

El proyecto `administrar precios natura` publica el servicio autenticado que permite administrar el catálogo. La edición se ejecuta como la cuenta de Google que accede y requiere que esa cuenta tenga permiso sobre el inventario oficial.

La escritura resuelve los campos por el texto actual de los encabezados, exige una coincidencia única del código y conserva el formato de las celdas.
