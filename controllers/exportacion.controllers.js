import ExcelJS from "exceljs";
import { calcularEstadisticas } from "./estadisticas.controller.js";

export const exportarEstadisticasExcel = async (req, res) => {
  try {
    const stats = await calcularEstadisticas();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistema de Productos";
    workbook.created = new Date();

    // ======================
    // HOJA 1: Resumen
    // ======================
    const hojaResumen = workbook.addWorksheet("Resumen", {
      properties: { tabColor: { argb: "FF4472C4" } },
    });

    // Estilos
    const estiloTitulo = {
      font: { bold: true, size: 16, color: { argb: "FFFFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } },
      alignment: { horizontal: "center", vertical: "middle" },
    };

    const estiloEncabezado = {
      font: { bold: true, color: { argb: "FFFFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B9BD5" } },
      alignment: { horizontal: "center" },
    };

    const estiloLabel = {
      font: { bold: true },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6EAF8" } },
    };

    // Título
    hojaResumen.mergeCells("A1:B1");
    hojaResumen.getCell("A1").value = "ESTADÍSTICAS DE PRODUCTOS";
    hojaResumen.getCell("A1").style = estiloTitulo;
    hojaResumen.getRow(1).height = 30;

    // Datos resumen
    const datosResumen = [
      ["Total de productos", stats.total],
      ["Precio promedio", stats.promedioPrecio],
      ["Precio mínimo", stats.precioMin ?? "—"],
      ["Precio máximo", stats.precioMax ?? "—"],
      ["Stock total", stats.stockTotal],
      ["Stock promedio por producto", stats.promedioStock],
      ["Stock mínimo", stats.stockMin ?? "—"],
      ["Stock máximo", stats.stockMax ?? "—"],
      ["Fecha de generación", new Date().toLocaleString("es-ES")],
    ];

    hojaResumen.addRow([]); // fila vacía
    hojaResumen.addRow(["Métrica", "Valor"]).eachCell((cell) => {
      cell.style = estiloEncabezado;
    });

    datosResumen.forEach(([label, valor]) => {
      const row = hojaResumen.addRow([label, valor]);
      row.getCell(1).style = estiloLabel;
    });

    // Ajustar anchos
    hojaResumen.getColumn(1).width = 28;
    hojaResumen.getColumn(2).width = 20;

    // ======================
    // HOJA 2: Distribución por categoría
    // ======================
    const hojaCategorias = workbook.addWorksheet("Por Categoría", {
      properties: { tabColor: { argb: "FF70AD47" } },
    });

    hojaCategorias.mergeCells("A1:C1");
    hojaCategorias.getCell("A1").value = "Distribución por categoría";
    hojaCategorias.getCell("A1").style = {
      ...estiloTitulo,
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF70AD47" } },
    };
    hojaCategorias.getRow(1).height = 28;

    hojaCategorias.addRow([]);
    hojaCategorias.addRow(["Categoría", "Cantidad", "Porcentaje (%)"]).eachCell((cell) => {
      cell.style = {
        ...estiloEncabezado,
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF70AD47" } },
      };
    });

    Object.entries(stats.porCategoria)
      .sort((a, b) => b[1] - a[1])
      .forEach(([categoria, cantidad]) => {
        const porcentaje = stats.total > 0
          ? Number(((cantidad / stats.total) * 100).toFixed(1))
          : 0;
        hojaCategorias.addRow([categoria, cantidad, porcentaje]);
      });

    hojaCategorias.getColumn(1).width = 25;
    hojaCategorias.getColumn(2).width = 12;
    hojaCategorias.getColumn(3).width = 16;

    // ======================
    // HOJA 3: Listado completo de productos
    // ======================
    const hojaProductos = workbook.addWorksheet("Listado de Productos", {
      properties: { tabColor: { argb: "FF7030A0" } },
    });

    hojaProductos.mergeCells("A1:G1");
    hojaProductos.getCell("A1").value = "Listado completo de productos";
    hojaProductos.getCell("A1").style = {
      ...estiloTitulo,
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF7030A0" } },
    };
    hojaProductos.getRow(1).height = 28;

    hojaProductos.addRow([]);
    const headers = [
      "ID",
      "Nombre",
      "Precio",
      "Stock",
      "Categoría",
      "Descripción de categoría",
      "Imagen",
    ];
    hojaProductos.addRow(headers).eachCell((cell) => {
      cell.style = {
        ...estiloEncabezado,
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF7030A0" } },
      };
    });

    stats.productos.forEach((producto) => {
      hojaProductos.addRow([
        producto.id,
        producto.nombre,
        producto.precio,
        producto.stock,
        producto.categoria_id?.nombre ?? "Sin categoría",
        producto.categoria_id?.descripcion ?? "",
        producto.image ?? "",
      ]);
    });

    // Anchos de columnas
    hojaProductos.getColumn(1).width = 28;
    hojaProductos.getColumn(2).width = 24;
    hojaProductos.getColumn(3).width = 14;
    hojaProductos.getColumn(4).width = 12;
    hojaProductos.getColumn(5).width = 22;
    hojaProductos.getColumn(6).width = 32;
    hojaProductos.getColumn(7).width = 48;

    // ======================
    // Enviar el archivo
    // ======================
    const nombreArchivo = `estadisticas-productos-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nombreArchivo}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error al generar Excel:", error);
    res.status(500).json({
      mensaje: "Error al generar el archivo Excel.",
      error: error.message,
    });
  }
};