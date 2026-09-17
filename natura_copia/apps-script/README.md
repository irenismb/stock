# Apps Script de Natura

Esta carpeta contiene exclusivamente los proyectos de Google Apps Script relacionados con la página Natura.

## Proyectos registrados

- `coordenadas-natura`
- `coordenadas-de-visitantes-natura`
- `coordenadas-de-visitantes-natura-2`
- `pedidos-natura`
- `pedidos-natura-2`
- `ventas-natura`
- `administrar precios natura` — panel privado que localiza Código, Nombre y Precio por sus encabezados vigentes

## Sincronización bidireccional

- **Google Apps Script → GitHub:** el workflow manual **Sincronizar Apps Script de Natura** ejecuta `clasp pull` y solo crea commits dentro de `natura/apps-script/`.
- **PC → GitHub → Google Apps Script:** al hacer **Commit** y **Push origin** desde GitHub Desktop, GitHub identifica los proyectos modificados dentro de esta carpeta y ejecuta `clasp push` automáticamente.
- **Publicación manual alternativa:** el workflow **Publicar Apps Script de Natura** permite elegir y publicar un proyecto concreto.

La publicación valida que cada proyecto tenga `appsscript.json` y archivos de código. Los commits creados por la descarga se ignoran para evitar ciclos. Ningún archivo situado fuera de `natura/apps-script/` se envía a Google Apps Script.

## Administración de precios

El workflow **Crear y publicar administrador de precios Natura** crea o actualiza una implementación independiente. El catálogo público permanece en modo de solo lectura; el panel se abre únicamente con `?administrar=precios`, se ejecuta como la cuenta de Google que accede y requiere que esa cuenta tenga permiso de edición sobre el inventario oficial.

La escritura resuelve los campos por el texto actual de los encabezados, exige una coincidencia única del código, compara el precio anterior y modifica solamente la celda de Precio sin alterar su formato.
