import os
import math
import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image, ImageTk

class CollageEditorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Editor de Collage Uniforme (Fondo Negro)")
        self.images = []           # PIL Images originales
        self.thumbs = []           # Thumbnails para vista previa
        self.grid_indices = []     # Mapeo posición → índice de imagen
        self.cell_w = self.cell_h = 0
        self.cols = self.rows = 0
        self.drag_data = {"item": None, "x": 0, "y": 0, "pos": None}

        # — Botones —
        top = tk.Frame(self)
        top.pack(fill="x", padx=5, pady=5)
        tk.Button(top, text="Seleccionar Imágenes", command=self.select_images).pack(side="left", padx=5)
        tk.Button(top, text="Guardar Collage", command=self.save_collage).pack(side="left", padx=5)

        # — Canvas con scrollbars para vista previa —
        cf = tk.Frame(self)
        cf.pack(fill="both", expand=True)
        hbar = tk.Scrollbar(cf, orient="horizontal")
        vbar = tk.Scrollbar(cf, orient="vertical")
        self.canvas = tk.Canvas(cf, bg="black",
                                xscrollcommand=hbar.set,
                                yscrollcommand=vbar.set)
        hbar.config(command=self.canvas.xview)
        vbar.config(command=self.canvas.yview)
        hbar.pack(side="bottom", fill="x")
        vbar.pack(side="right", fill="y")
        self.canvas.pack(side="left", fill="both", expand=True)

    def select_images(self):
        paths = filedialog.askopenfilenames(
            title="Selecciona imágenes",
            filetypes=[("Imágenes", "*.jpg *.jpeg *.png *.bmp *.gif")]
        )
        if not paths:
            return

        # Cargar PIL Images originales
        self.images = [Image.open(p) for p in paths]

        # Determinar celda uniforme (max ancho y alto)
        widths = [im.width for im in self.images]
        heights = [im.height for im in self.images]
        self.cell_w, self.cell_h = max(widths), max(heights)

        # Determinar filas/columnas (cuadrado lo más posible)
        n = len(self.images)
        self.cols = int(math.sqrt(n))
        if self.cols * self.cols < n:
            self.cols += 1
        self.rows = (n + self.cols - 1) // self.cols

        # Generar thumbnails para preview (encajan en la celda)
        self.thumbs.clear()
        for im in self.images:
            thumb = im.copy()
            thumb.thumbnail((self.cell_w, self.cell_h), Image.LANCZOS)
            self.thumbs.append(ImageTk.PhotoImage(thumb))

        # Inicializar orden natural
        self.grid_indices = list(range(n))
        self.draw_preview()

    def draw_preview(self):
        self.canvas.delete("all")
        total_w = self.cols * self.cell_w
        total_h = self.rows * self.cell_h
        self.canvas.config(scrollregion=(0, 0, total_w, total_h))

        # Dibujar cada thumbnail en su celda
        for pos, img_idx in enumerate(self.grid_indices):
            row, col = divmod(pos, self.cols)
            x, y = col * self.cell_w, row * self.cell_h
            item = self.canvas.create_image(x, y,
                                            image=self.thumbs[img_idx],
                                            anchor="nw",
                                            tags=("draggable", str(pos)))
        # Bind drag & drop
        self.canvas.tag_bind("draggable", "<ButtonPress-1>",   self.on_press)
        self.canvas.tag_bind("draggable", "<B1-Motion>",      self.on_motion)
        self.canvas.tag_bind("draggable", "<ButtonRelease-1>", self.on_release)

    def on_press(self, event):
        # Inicio de arrastre
        canvas = self.canvas
        x, y = canvas.canvasx(event.x), canvas.canvasy(event.y)
        item = canvas.find_closest(x, y)[0]
        tags = canvas.gettags(item)
        pos = int(tags[1])  # posición origen
        self.drag_data = {"item": item, "x": x, "y": y, "pos": pos}
        canvas.lift(item)

    def on_motion(self, event):
        # Mientras arrastra, mover el item
        canvas = self.canvas
        x, y = canvas.canvasx(event.x), canvas.canvasy(event.y)
        dx, dy = x - self.drag_data["x"], y - self.drag_data["y"]
        canvas.move(self.drag_data["item"], dx, dy)
        self.drag_data["x"], self.drag_data["y"] = x, y

    def on_release(self, event):
        # Suelta: intercambiar posiciones de celdas si cae sobre otra
        canvas = self.canvas
        x, y = canvas.canvasx(event.x), canvas.canvasy(event.y)
        col = min(self.cols - 1, max(0, int(x // self.cell_w)))
        row = min(self.rows - 1, max(0, int(y // self.cell_h)))
        target = row * self.cols + col
        src = self.drag_data["pos"]
        if target < len(self.grid_indices) and src < len(self.grid_indices):
            self.grid_indices[src], self.grid_indices[target] = (
                self.grid_indices[target], self.grid_indices[src]
            )
        self.draw_preview()
        self.drag_data = {"item": None, "x":0, "y":0, "pos":None}

    def save_collage(self):
        if not self.images:
            messagebox.showwarning("Aviso", "No hay collage para guardar.")
            return

        # Crear imagen final con fondo negro
        total_w = self.cols * self.cell_w
        total_h = self.rows * self.cell_h
        collage = Image.new("RGB", (total_w, total_h), (0, 0, 0))

        # Pegar cada imagen original centrada en su celda
        for pos, img_idx in enumerate(self.grid_indices):
            row, col = divmod(pos, self.cols)
            x, y = col * self.cell_w, row * self.cell_h
            im = self.images[img_idx]
            off_x = (self.cell_w - im.width) // 2
            off_y = (self.cell_h - im.height) // 2
            collage.paste(im, (x + off_x, y + off_y))

        path = filedialog.asksaveasfilename(
            defaultextension=".jpg",
            filetypes=[("JPEG", "*.jpg"), ("PNG", "*.png")],
            title="Guardar Collage"
        )
        if path:
            collage.save(path)
            # messagebox.showinfo("Listo", f"Collage guardado en:\n{path}")

if __name__ == "__main__":
    CollageEditorApp().mainloop()


