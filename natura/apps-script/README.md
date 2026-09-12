# Apps Script de Natura

Esta carpeta contiene exclusivamente los proyectos de Google Apps Script relacionados con la página Natura.

## Proyectos registrados

- `coordenadas-natura`
- `coordenadas-de-visitantes-natura`

## Sincronización bidireccional

- **Google Apps Script → GitHub:** el workflow manual **Sincronizar Apps Script de Natura** ejecuta `clasp pull` y solo crea commits dentro de `natura/apps-script/`.
- **PC → GitHub → Google Apps Script:** al hacer **Commit** y **Push origin** desde GitHub Desktop, GitHub identifica los proyectos modificados dentro de esta carpeta y ejecuta `clasp push` automáticamente.
- **Publicación manual alternativa:** el workflow **Publicar Apps Script de Natura** permite elegir y publicar un proyecto concreto.

La publicación valida que cada proyecto tenga `appsscript.json` y archivos de código. Los commits creados por la descarga se ignoran para evitar ciclos. Ningún archivo situado fuera de `natura/apps-script/` se envía a Google Apps Script.
