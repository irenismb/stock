"""Editar directamente fuentes oficiales de Drive; validar antes de escribir."""
import hashlib,json,os,pathlib,subprocess,urllib.request,urllib.error
root=pathlib.Path.cwd()
auth=json.loads(pathlib.Path(os.environ["CLASP_AUTH_FILE"]).read_text())
credential=(auth.get("tokens") or {}).get("default") or auth.get("token") or auth
token=credential.get("access_token")
if not token:raise SystemExit("Falta autorización Google")
def request(url,method="GET",body=None,mime=None,authenticated=True):
    headers={"Authorization":"Bearer "+token} if authenticated else {}
    if mime:headers["Content-Type"]=mime
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=body,method=method,headers=headers),timeout=60) as response:return response.read()
    except urllib.error.HTTPError as error:
        detail=json.loads(error.read()).get("error",{})
        raise SystemExit("Google API HTTP "+str(error.code)+": "+str(detail.get("message",""))+"; "+str([e.get("reason") for e in detail.get("errors",[])]))
def metadata(file_id):
    return json.loads(request("https://www.googleapis.com/drive/v3/files/"+file_id+"?fields=id,name,mimeType,trashed,md5Checksum"))
files=json.loads((root/".github/natura/dos-columnas-drive.json").read_text())
prepared=[]
for item in files:
    obj=metadata(item["id"])
    if obj.get("name")!=item["name"] or obj.get("trashed") or str(obj.get("mimeType","")).startswith("application/vnd.google-apps."):raise SystemExit("Origen inesperado: "+item["name"])
    original=request("https://www.googleapis.com/drive/v3/files/"+item["id"]+"?alt=media").decode("utf-8")
    if (root/item["path"]).read_text()!=original:raise SystemExit("Drive y publicación difieren; no se sobrescribe: "+item["name"])
    proposed=original
    for old,new in item["replacements"]:
        if proposed.count(old)!=1:raise SystemExit("Cambio no inequívoco: "+item["name"])
        proposed=proposed.replace(old,new,1)
    (root/item["path"]).write_text(proposed,encoding="utf-8")
    item["original_md5"]=hashlib.md5(original.encode()).hexdigest()
    item["bytes"]=proposed.encode()
    prepared.append(item)
    if item["name"].endswith((".js",".cjs")):subprocess.run(["node","--check",item["path"]],check=True)
url="https://docs.google.com/spreadsheets/d/1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs/gviz/tq?gid=893686273&headers=1&tqx=out:json"
raw=request(url,authenticated=False).decode()
payload=json.loads(raw[raw.index("{"):raw.rindex("}")+1])
if payload.get("status")!="ok":raise SystemExit("No se pudo leer Productos")
table=payload["table"]
values=[[column["label"] for column in table["cols"]]]+[[cell.get("f",cell.get("v","")) if cell else "" for cell in row["c"]] for row in table["rows"]]
fixture=pathlib.Path(os.environ["RUNNER_TEMP"])/"natura-productos.json";fixture.write_text(json.dumps(values),encoding="utf-8")
subprocess.run(["node","--test","natura/catalogo-integracion.test.cjs"],env=dict(os.environ,CATALOG_PRODUCTS_FIXTURE=str(fixture)),check=True)
for item in prepared:
    if metadata(item["id"]).get("md5Checksum")!=item["original_md5"]:raise SystemExit("Drive cambió durante la validación: "+item["name"])
print("Pruebas aprobadas con",len(values)-1,"filas oficiales; actualizando los mismos IDs de Drive.")
for item in prepared:
    data=item["bytes"];checksum=hashlib.md5(data).hexdigest()
    mime="text/html" if item["name"].endswith(".html") else "text/javascript"
    response=json.loads(request("https://www.googleapis.com/upload/drive/v3/files/"+item["id"]+"?uploadType=media&fields=id,md5Checksum","PATCH",data,mime))
    if response.get("id")!=item["id"] or response.get("md5Checksum")!=checksum:raise SystemExit("Drive no confirmó los bytes: "+item["name"])
    print("DRIVE VERIFICADO",item["name"],checksum)
