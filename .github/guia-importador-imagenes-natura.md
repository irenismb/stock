# Importador reutilizable de imágenes Natura

GitHub Actions procesa fotografias **aprobadas** y las sube al Drive oficial, nunca al repositorio. No modifica la hoja de inventario, la web ni el Apps Script publico.

- Workflow: .github/workflows/importar-imagenes-natura.yml
- Programa: .github/scripts/importar_imagenes_natura.py
- Carpeta Drive oficial: 133WAYlDKSt3r8KIObttDcv86eHPmPQ5b
- Inventario oficial: 1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs

## Ejecucion futura

Una vez revisada y aprobada visualmente una imagen original exacta, crear una nueva solicitud JSON en .github/solicitudes-imagenes/ con otro nombre cada vez. El push en la rama main dispara la importacion sin necesidad de iniciar Actions manualmente. El conector GitHub de ChatGPT puede crear esa solicitud.

Tambien puede abrirse Actions > Importar imagenes aprobadas de Natura a Drive > Run workflow, colocando el mismo JSON en el campo solicitud_json.

Ejemplo de estructura con URL de imagen TODAVIA PENDIENTE:

    {
      "imagenes": [
        {
          "codigo": "0581",
          "numero": 1,
          "nombre_descriptivo": "natura_kaiak_21k_masculino_eau_de_toilette_100ml",
          "imagen_url": "URL_HTTPS_DIRECTA_DE_FOTO_REAL_APROBADA",
          "pagina_fuente": "URL_HTTPS_FICHA_PRODUCTO",
          "codigo_comercial": "NATCOL-228525",
          "nombre_contiene": "Kaiak",
          "aprobada": true
        }
      ]
    }

Los campos URL_HTTPS son marcadores, no enlaces de imagen reales. No ejecutar esa solicitud hasta tener los originales y verificar su identidad.

## Comportamiento seguro

- Valida Codigo unico y el nombre/codigo comercial existente en Productos.
- Verifica que no haya otra imagen con el mismo codigo + numero; no reemplaza archivos existentes.
- Exige imagen original accesible por HTTPS, JPG/PNG/WEBP, nitida y con fondo blanco; convierte a WEBP de 1000x1000 con fondo opaco.
- Asigna CCCC_NN_descripcion.webp; la primera es 01, las adicionales son consecutivas.
- Rechaza los fondos no blancos, imagenes pequenas, posibles duplicados y URLs inaccesibles.
- No genera fotografias sinteticas ni modifica el producto, sus etiquetas o logotipos.
- Una comprobacion automatica NO certifica la identidad visual exacta ni detecta toda marca de agua. Se exige seleccion y aprobacion visual previas y revision visual del WEBP final.

## Autorizacion

El workflow emplea la credencial GitHub Actions CLASPRC_JSON ya usada por Apps Script, con refresco via clasp. Todavia debe verificarse en una primera ejecucion que esa credencial tenga acceso de lectura al Sheet y escritura en la carpeta de Drive. Si no lo tiene, falla sin subir imagenes.

El importador no ha subido las fotografias 0581 y 0582: sus URLs directas y la primera ejecucion real continuan pendientes. Las fotos nunca se guardan en GitHub.

Consultar el registro del workflow en Actions para diagnosticar permisos, fuente, calidad o duplicados.