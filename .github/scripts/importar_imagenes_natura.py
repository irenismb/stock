#!/usr/bin/env python3
"""Importador privado de fotografias previamente aprobadas para el inventario Natura.

Las imagenes se guardan solo en Drive, nunca en GitHub.
No modifica el inventario ni sobrescribe archivos de imagen existentes.
"""
import argparse
import io
import ipaddress
import json
import re
import socket
import sys
import urllib.parse
from pathlib import Path

import requests
from PIL import Image, ImageOps, ImageChops, UnidentifiedImageError

PRODUCTS_FOLDER = "133WAYlDKSt3r8KIObttDcv86eHPmPQ5b"
SPREADSHEET = "1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs"
MAX_BYTES = 12 * 1024 * 1024
MAX_PIXELS = 25_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class ImportErrorNatura(Exception):
    pass


def validar(item):
    if not isinstance(item, dict):
        raise ImportErrorNatura("Cada imagen debe ser un objeto JSON.")
    codigo = str(item.get("codigo", "")).strip()
    numero = item.get("numero", 1)
    slug = str(item.get("nombre_descriptivo", "")).strip()
    if not re.fullmatch(r"\d{4}", codigo):
        raise ImportErrorNatura("Codigo debe contener cuatro digitos.")
    if type(numero) is not int or numero < 1 or numero > 99:
        raise ImportErrorNatura("Numero de imagen debe ser 1 a 99.")
    if not re.fullmatch(r"[a-z0-9]+(?:_[a-z0-9]+)*", slug) or len(slug) > 110:
        raise ImportErrorNatura("Nombre descriptivo invalido.")
    if item.get("aprobada") is not True:
        raise ImportErrorNatura("La imagen requiere aprobacion visual expresa.")
    url = str(item.get("imagen_url", "")).strip()
    pagina = str(item.get("pagina_fuente", "")).strip()
    if not url.startswith("https://") or not pagina.startswith("https://"):
        raise ImportErrorNatura("La fotografia y su pagina fuente deben usar HTTPS.")
    if not urllib.parse.urlparse(pagina).hostname:
        raise ImportErrorNatura("Pagina fuente invalida.")
    codigo_comercial = item.get("codigo_comercial")
    if codigo_comercial is not None and not isinstance(codigo_comercial, str):
        raise ImportErrorNatura("Codigo comercial invalido.")
    nombre_contiene = item.get("nombre_contiene")
    if nombre_contiene is not None and (not isinstance(nombre_contiene, str) or not nombre_contiene.strip()):
        raise ImportErrorNatura("Nombre de producto esperado invalido.")
    return {
        "codigo": codigo, "numero": numero,
        "filename": f"{codigo}_{numero:02d}_{slug}.webp",
        "url": url, "pagina": pagina,
        "codigo_comercial": codigo_comercial, "nombre_contiene": nombre_contiene
    }


def solicitudes(rutas):
    resultado = []
    for ruta in rutas:
        contenido = json.loads(Path(ruta).read_text(encoding="utf-8"))
        imagenes = contenido if isinstance(contenido, list) else contenido.get("imagenes", [])
        if not isinstance(imagenes, list) or not imagenes:
            raise ImportErrorNatura("El JSON debe incluir imagenes no vacias.")
        resultado.extend(validar(imagen) for imagen in imagenes)
    if not resultado:
        raise ImportErrorNatura("No hay solicitudes.")
    pares = [(x["codigo"], x["numero"]) for x in resultado]
    if len(set(pares)) != len(pares):
        raise ImportErrorNatura("Hay numeros de imagen duplicados en la solicitud.")
    return resultado


def token_clasp(ruta):
    obj = json.loads(Path(ruta).read_text(encoding="utf-8"))
    auth = (obj.get("tokens") or {}).get("default") or obj.get("token") or obj
    token = auth.get("access_token", "") if isinstance(auth, dict) else ""
    if not token:
        raise ImportErrorNatura("Sin token de Google valido tras autorizar clasp.")
    return token


def google(method, url, token, *, params=None, data=None, headers=None, timeout=40):
    h = {"Authorization": f"Bearer {token}"}
    h.update(headers or {})
    try:
        respuesta = requests.request(method, url, headers=h, params=params, data=data, timeout=timeout)
    except requests.RequestException as exc:
        raise ImportErrorNatura("Google API no responde.") from exc
    if respuesta.status_code >= 400:
        raise ImportErrorNatura(f"Google API HTTP {respuesta.status_code}: {respuesta.text[:250]}")
    try:
        return respuesta.json()
    except ValueError as exc:
        raise ImportErrorNatura("Google devolvio una respuesta no JSON.") from exc


def comprobar_inventario(token, imagenes):
    endpoint = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET}/values/%27Productos%27%21A1%3AM1000"
    filas = google("GET", endpoint, token, params={"valueRenderOption": "FORMATTED_VALUE"}).get("values", [])
    if not filas:
        raise ImportErrorNatura("No fue posible leer el inventario oficial.")
    cab = filas[0]

    def indice(nombre):
        indices = [i for i, valor in enumerate(cab) if str(valor).strip() == nombre]
        if len(indices) != 1:
            raise ImportErrorNatura(f"Encabezado ausente o ambiguo: {nombre}.")
        return indices[0]

    c, n, cod_externo = indice("Código"), indice("Nombre"), indice("Código Natura")
    catalogo = {}
    for fila in filas[1:]:
        if len(fila) > c and str(fila[c]).strip():
            catalogo.setdefault(str(fila[c]).strip(), []).append(fila)
    for item in imagenes:
        filas_del_codigo = catalogo.get(item["codigo"], [])
        if len(filas_del_codigo) != 1:
            raise ImportErrorNatura(f"Codigo {item['codigo']} ausente o duplicado.")
        fila = filas_del_codigo[0]
        if item["codigo_comercial"] is not None:
            codigo = str(fila[cod_externo]).strip() if len(fila) > cod_externo else ""
            if codigo != item["codigo_comercial"]:
                raise ImportErrorNatura(f"Codigo comercial diferente: {item['codigo']}.")
        if item["nombre_contiene"]:
            nombre = str(fila[n]).casefold() if len(fila) > n else ""
            if item["nombre_contiene"].casefold() not in nombre:
                raise ImportErrorNatura(f"El nombre del producto cambio: {item['codigo']}.")


def listar_imagenes(token):
    info = google("GET", f"https://www.googleapis.com/drive/v3/files/{PRODUCTS_FOLDER}", token,
                  params={"fields": "id,name,mimeType,trashed", "supportsAllDrives": "true"})
    if (info.get("id") != PRODUCTS_FOLDER or
            info.get("mimeType") != "application/vnd.google-apps.folder" or info.get("trashed")):
        raise ImportErrorNatura("La carpeta Drive no es el destino oficial.")
    nombres = []
    pagina = None
    while True:
        params = {
            "q": f"'{PRODUCTS_FOLDER}' in parents and trashed = false",
            "fields": "nextPageToken,files(name)", "pageSize": 1000,
            "supportsAllDrives": "true", "includeItemsFromAllDrives": "true"
        }
        if pagina:
            params["pageToken"] = pagina
        datos = google("GET", "https://www.googleapis.com/drive/v3/files", token, params=params)
        nombres.extend(str(f.get("name", "")).lower() for f in datos.get("files", []))
        pagina = datos.get("nextPageToken")
        if not pagina:
            break
    return nombres


def comprobar_destino(token, imagenes):
    nombres = listar_imagenes(token)
    solicitadas = {(x["codigo"], x["numero"]) for x in imagenes}
    for item in imagenes:
        prefix = f"{item['codigo']}_{item['numero']:02d}_"
        if any(name.startswith(prefix) for name in nombres):
            raise ImportErrorNatura(f"La imagen {prefix} ya existe; no reemplazar automaticamente.")
        for i in range(1, item["numero"]):
            anterior = f"{item['codigo']}_{i:02d}_"
            if (not any(name.startswith(anterior) for name in nombres)
                    and (item["codigo"], i) not in solicitadas):
                raise ImportErrorNatura(f"Falta la imagen anterior {anterior} (secuencia no consecutiva).")


def url_segura(raw):
    info = urllib.parse.urlparse(raw)
    if (info.scheme != "https" or not info.hostname or info.username or info.password
            or info.port not in (None, 443) or info.fragment):
        raise ImportErrorNatura("Origen de imagen debe ser HTTPS publico sin credenciales.")
    host = info.hostname.lower()
    if host in ("localhost", "localhost.localdomain") or host.endswith((".local", ".internal", ".test")):
        raise ImportErrorNatura("Host privado no permitido.")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ImportErrorNatura("No se permiten direcciones IP directas.")
    try:
        ips = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise ImportErrorNatura("No se resuelve el servidor de la imagen.") from exc
    if not ips or any(not ipaddress.ip_address(x[4][0]).is_global for x in ips):
        raise ImportErrorNatura("El origen apunta a una red privada.")
    return raw


def descargar(url):
    url = url_segura(url)
    for _ in range(4):
        try:
            res = requests.get(url, timeout=(15, 35), stream=True, allow_redirects=False,
                               headers={"Accept": "image/jpeg,image/png,image/webp",
                                        "User-Agent": "NaturaCatalogImageImporter/1.0"})
        except requests.RequestException as exc:
            raise ImportErrorNatura("No se pudo descargar fotografia.") from exc
        if 300 <= res.status_code < 400:
            lugar = res.headers.get("Location")
            res.close()
            if not lugar:
                raise ImportErrorNatura("Redireccion sin URL.")
            url = url_segura(urllib.parse.urljoin(url, lugar))
            continue
        if res.status_code != 200:
            estado = res.status_code
            res.close()
            raise ImportErrorNatura(f"Fotografia inaccesible: HTTP {estado}.")
        tipo = res.headers.get("Content-Type", "").split(";")[0].lower()
        if tipo not in ("image/jpeg", "image/png", "image/webp", "application/octet-stream"):
            res.close()
            raise ImportErrorNatura("El enlace no devuelve JPG, PNG o WEBP.")
        datos = bytearray()
        try:
            for pedazo in res.iter_content(chunk_size=65536):
                datos.extend(pedazo)
                if len(datos) > 12 * 1024 * 1024:
                    raise ImportErrorNatura("Fotografia original supera 12 MB.")
        finally:
            res.close()
        return bytes(datos)
    raise ImportErrorNatura("Demasiadas redirecciones en origen.")


def transformar(datos):
    if len(datos) < 8000:
        raise ImportErrorNatura("Imagen original demasiado pequena.")
    try:
        with Image.open(io.BytesIO(datos)) as im:
            if im.format not in ("JPEG", "PNG", "WEBP") or getattr(im, "n_frames", 1) > 1:
                raise ImportErrorNatura("Solo imagenes estaticas JPG, PNG o WEBP.")
            if im.width * im.height > 25_000_000 or min(im.size) < 450:
                raise ImportErrorNatura("Resolucion de imagen no apta para catalogo.")
            im = ImageOps.exif_transpose(im)
            if "A" in im.getbands() or "transparency" in im.info:
                img = im.convert("RGBA")
                blanco = Image.new("RGBA", img.size, (255, 255, 255, 255))
                blanco.alpha_composite(img)
                rgb = blanco.convert("RGB")
            else:
                rgb = im.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImportErrorNatura("Formato original ilegible.") from exc

    w, h = rgb.size
    borde = ([rgb.getpixel((x, 0)) for x in range(0, w, max(1, w // 100))]
             + [rgb.getpixel((x, h - 1)) for x in range(0, w, max(1, w // 100))]
             + [rgb.getpixel((0, y)) for y in range(0, h, max(1, h // 100))]
             + [rgb.getpixel((w - 1, y)) for y in range(0, h, max(1, h // 100))])
    propor = sum(1 for p in borde if min(p) >= 248 and max(p) - min(p) <= 6) / len(borde)
    if propor < 0.96:
        raise ImportErrorNatura("Fondo no blanco; necesita una fotografia diferente o revision visual.")

    delta = ImageChops.difference(rgb, Image.new("RGB", rgb.size, (255, 255, 255)))
    bounds = delta.point(lambda n: 255 if n > 16 else 0).getbbox()
    if not bounds:
        raise ImportErrorNatura("No se detecto producto.")
    left, top, right, bottom = bounds
    margen = max(12, round(max(right - left, bottom - top) * 0.05))
    region = rgb.crop((max(0, left - margen), max(0, top - margen),
                       min(w, right + margen), min(h, bottom + margen)))
    region.thumbnail((900, 900), Image.Resampling.LANCZOS)
    lienzo = Image.new("RGB", (1000, 1000), (255, 255, 255))
    lienzo.paste(region, ((1000 - region.width) // 2, (1000 - region.height) // 2))
    memoria = io.BytesIO()
    lienzo.save(memoria, format="WEBP", quality=92, method=6)
    webp = memoria.getvalue()
    with Image.open(io.BytesIO(webp)) as comprobacion:
        if (comprobacion.format != "WEBP" or comprobacion.size != (1000, 1000)
                or "A" in comprobacion.getbands()):
            raise ImportErrorNatura("Salida WEBP invalida.")
        for coord in ((0, 0), (0, 999), (999, 0), (999, 999)):
            if comprobacion.convert("RGB").getpixel(coord) != (255, 255, 255):
                raise ImportErrorNatura("La salida no posee fondo blanco opaco.")
    return webp


def subir(token, item, webp):
    limite = "naturaimageboundary2026"
    meta = json.dumps({"name": item["filename"], "mimeType": "image/webp",
                       "parents": [PRODUCTS_FOLDER]}, ensure_ascii=False)
    prefix = (f"--{limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{meta}\r\n"
              f"--{limite}\r\nContent-Type: image/webp\r\n\r\n").encode()
    body = prefix + webp + f"\r\n--{limite}--\r\n".encode()
    creado = google("POST", "https://www.googleapis.com/upload/drive/v3/files", token, data=body,
                    headers={"Content-Type": f"multipart/related; boundary={limite}"},
                    params={"uploadType": "multipart", "fields": "id,name,mimeType,parents",
                            "supportsAllDrives": "true"}, timeout=100)
    ident = creado.get("id")
    if not ident:
        raise ImportErrorNatura("Drive no confirmo la nueva imagen.")
    final = google("GET", f"https://www.googleapis.com/drive/v3/files/{ident}", token,
                   params={"fields": "id,name,mimeType,parents,trashed", "supportsAllDrives": "true"})
    if (final.get("name") != item["filename"] or final.get("mimeType") != "image/webp"
            or PRODUCTS_FOLDER not in final.get("parents", []) or final.get("trashed")):
        raise ImportErrorNatura("No se pudo verificar archivo final en Drive.")
    return ident


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", action="append", required=True)
    p.add_argument("--credenciales", required=True)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    imagenes = solicitudes(args.manifest)
    token = token_clasp(args.credenciales)
    comprobar_inventario(token, imagenes)
    comprobar_destino(token, imagenes)
    preparadas = []
    for imagen in imagenes:
        webp = transformar(descargar(imagen["url"]))
        preparadas.append((imagen, webp))
        print(f"VALIDADA {imagen['codigo']}_{imagen['numero']:02d}: WEBP {len(webp)} bytes")
    if args.dry_run:
        print("Prueba sin escrituras a Drive.")
        return
    preparadas.sort(key=lambda item: (item[0]["codigo"], item[0]["numero"]))
    for imagen, webp in preparadas:
        comprobar_destino(token, [imagen])
        file_id = subir(token, imagen, webp)
        print(f"SUBIDA {imagen['filename']} https://drive.google.com/file/d/{file_id}/view")
    print(f"FIN: {len(preparadas)} imagenes verificadas. Inventario sin cambios.")


if __name__ == "__main__":
    try:
        main()
    except (ImportErrorNatura, json.JSONDecodeError, requests.RequestException) as error:
        print("ERROR: " + str(error), file=sys.stderr)
        sys.exit(1)
