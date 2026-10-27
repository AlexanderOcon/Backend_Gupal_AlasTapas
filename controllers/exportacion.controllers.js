import ExcelJS from "exceljs";
import { calcularEstadisticas } from "./estadisticas.controller.js";
import db from "../firebase.js";

const COLECCIONES_EXPORTABLES = new Set(["productos", "pedido", "usuarios"]);

const normalizarValorExportacion = (valor) => {
  const normalizarEscalar = (elemento) => {
    if (elemento === null || elemento === undefined) {
      return elemento;
    }

    if (elemento instanceof Date) {
      return elemento.toISOString();
    }

    if (typeof elemento.toDate === "function") {
      return elemento.toDate().toISOString();
    }

    if (ArrayBuffer.isView(elemento)) {
      return Buffer.from(
        elemento.buffer,
        elemento.byteOffset,
        elemento.byteLength
      ).toString("base64");
    }

    if (elemento instanceof ArrayBuffer) {
      return Buffer.from(elemento).toString("base64");
    }

    if (
      typeof elemento.path === "string" &&
      elemento.firestore &&
      typeof elemento.get === "function"
    ) {
      return elemento.path;
    }

    return elemento;
  };

  const raiz = normalizarEscalar(valor);
  if (raiz === null || typeof raiz !== "object") {
    return raiz;
  }

  const visitados = new WeakSet([raiz]);
  const resultado = Array.isArray(raiz) ? new Array(raiz.length) : {};
  const pendientes = [{ origen: raiz, destino: resultado }];

  while (pendientes.length > 0) {
    const { origen, destino } = pendientes.pop();
    const entradas = Array.isArray(origen)
      ? origen.map((elemento, indice) => [indice, elemento])
      : Object.entries(origen);

    for (const [clave, valorActual] of entradas) {
      const valorNormalizado = normalizarEscalar(valorActual);

      if (valorNormalizado === null || typeof valorNormalizado !== "object") {
        destino[clave] = valorNormalizado;
        continue;
      }

      if (visitados.has(valorNormalizado)) {
        destino[clave] = "[Referencia circular o repetida]";
        continue;
      }

      visitados.add(valorNormalizado);
      const contenedor = Array.isArray(valorNormalizado)
        ? new Array(valorNormalizado.length)
        : {};
      destino[clave] = contenedor;
      pendientes.push({ origen: valorNormalizado, destino: contenedor });
    }
  }

  return resultado;
};

const obtenerDatosColeccionExportacion = async (coleccion) => {
  const snapshot = await db.collection(coleccion).get();
  return snapshot.docs.map((doc) => ({
    ...normalizarValorExportacion(doc.data()),
    id: doc.id
  }));
};

const textoValorExportacion = (valor) => {
  if (valor === null || valor === undefined || valor === "") {
    return "—";
  }

  const texto = typeof valor === "object" ? JSON.stringify(valor) : String(valor);
  return texto.replace(/\r?\n/g, "\\n");
};

const escaparIdentificadorSQL = (identificador) =>
  `"${identificador.replace(/"/g, '""')}"`;

const escaparValorSQL = (valor) => {
  if (valor === null || valor === undefined) {
    return "NULL";
  }

  if (typeof valor === "number" && Number.isFinite(valor)) {
    return String(valor);
  }

  if (typeof valor === "boolean") {
    return valor ? "1" : "0";
  }

  const texto = typeof valor === "object" ? JSON.stringify(valor) : String(valor);
  return `'${texto.replace(/'/g, "''")}'`;
};

const tipoColumnaSQL = (documentos, columna) => {
  const tipos = new Set(
    documentos
      .map((documento) => documento[columna])
      .filter((valor) => valor !== null && valor !== undefined)
      .map((valor) => {
        if (typeof valor === "number" && Number.isFinite(valor)) {
          return "REAL";
        }
        return typeof valor === "boolean" ? "INTEGER" : "TEXT";
      })
  );

  return tipos.size === 1 ? [...tipos][0] : "TEXT";
};

const responderErrorExportacion = (res, formato, error) => {
  console.error(`Error al exportar colección (${formato}):`, error);
  return res.status(500).json({
    mensaje: `Error al generar la exportación ${formato}.`,
    error: error.message
  });
};

const exportarColeccion = async (req, res, formato) => {
  const { coleccion } = req.params;

  if (!COLECCIONES_EXPORTABLES.has(coleccion)) {
    return res.status(404).json({
      mensaje: "La colección solicitada no está disponible para exportación."
    });
  }

  try {
    const documentos = await obtenerDatosColeccionExportacion(coleccion);
    const fechaGeneracion = new Date();

    if (formato === "txt") {
      const contenido = documentos.length
        ? [
            `LISTADO DE ${coleccion.toUpperCase()} (${documentos.length})`,
            `Generado: ${fechaGeneracion.toLocaleString("es-ES")}`,
            "─".repeat(40),
            "",
            ...documentos.flatMap((documento, indice) => [
              `${indice + 1}. Registro ${documento.id}`,
              ...Object.entries(documento).map(
                ([campo, valor]) =>
                  `   ${campo}: ${textoValorExportacion(valor)}`
              ),
              ""
            ])
          ].join("\n")
        : `No hay registros en la colección "${coleccion}".`;

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${coleccion}-lista.txt"`
      );
      return res.status(200).send(contenido);
    }

    if (formato === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${coleccion}.json"`
      );
      return res.status(200).send(JSON.stringify(documentos, null, 2));
    }

    const columnas = [
      "id",
      ...new Set(documentos.flatMap((documento) => Object.keys(documento)))
    ];
    const definicionesColumnas = columnas.map((columna) => {
      const tipo = columna === "id" ? "TEXT" : tipoColumnaSQL(documentos, columna);
      const clavePrimaria = columna === "id" ? " PRIMARY KEY" : "";
      return `  ${escaparIdentificadorSQL(columna)} ${tipo}${clavePrimaria}`;
    });
    const tabla = escaparIdentificadorSQL(coleccion);
    const lineasSQL = [
      `-- Exportación de la colección ${coleccion}`,
      `-- Generado: ${fechaGeneracion.toISOString()}`,
      `-- Total de registros: ${documentos.length}`,
      "",
      `CREATE TABLE IF NOT EXISTS ${tabla} (`,
      definicionesColumnas.join(",\n"),
      ");",
      ""
    ];

    if (documentos.length === 0) {
      lineasSQL.push(`-- No hay registros para insertar en ${coleccion}.`);
    } else {
      documentos.forEach((documento) => {
        const valores = columnas.map((columna) =>
          escaparValorSQL(documento[columna])
        );
        lineasSQL.push(
          `INSERT INTO ${tabla} (${columnas.map(escaparIdentificadorSQL).join(", ")}) VALUES (${valores.join(", ")});`
        );
      });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${coleccion}-export.sql"`
    );
    return res.status(200).send(lineasSQL.join("\n"));
  } catch (error) {
    return responderErrorExportacion(res, formato, error);
  }
};

export const exportarColeccionTXT = (req, res) =>
  exportarColeccion(req, res, "txt");

export const exportarColeccionJSON = (req, res) =>
  exportarColeccion(req, res, "json");

export const exportarColeccionSQL = (req, res) =>
  exportarColeccion(req, res, "sql");

const escaparCSV = (valor) => {
  if (valor === null || valor === undefined) {
    return "";
  }

  let texto;
  if (valor instanceof Date) {
    texto = valor.toLocaleString("es-ES");
  } else if (typeof valor?.toDate === "function") {
    texto = valor.toDate().toLocaleString("es-ES");
  } else if (typeof valor === "object") {
    texto = JSON.stringify(valor, (clave, elemento) => {
      if (elemento && typeof elemento.toDate === "function") {
        return elemento.toDate().toISOString();
      }
      return elemento;
    });
  } else {
    texto = String(valor);
  }

  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

const enviarCSV = (res, nombre, encabezados, filas) => {
  const contenido = [
    encabezados.map(escaparCSV).join(","),
    ...filas.map((fila) => fila.map(escaparCSV).join(",")),
  ].join("\n");
  const fecha = new Date().toISOString().slice(0, 10);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${nombre}-${fecha}.csv"`
  );
  res.write("\uFEFF");
  res.end(contenido);
};

const exportarColeccionCSV = async (res, coleccion, nombreArchivo) => {
  const snapshot = await db.collection(coleccion).get();
  if (snapshot.empty) {
    return res.status(404).json({
      mensaje: `No hay documentos en la colección "${coleccion}" de Firebase.`
    });
  }

  const documentos = snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  }));
  const campos = [
    ...new Set(documentos.flatMap((documento) => Object.keys(documento))),
  ];
  const encabezados = ["ID", ...campos.filter((campo) => campo !== "id")];
  const filas = documentos.map((documento) =>
    encabezados.map((campo) => documento[campo])
  );

  enviarCSV(res, nombreArchivo, encabezados, filas);
};

export const exportarProductosCSV = async (req, res) => {
  try {
    await exportarColeccionCSV(res, "productos", "productos");
  } catch (error) {
    console.error("Error al exportar productos a CSV:", error);
    res.status(500).json({
      mensaje: "Error al generar el archivo CSV de productos.",
      error: error.message,
    });
  }
};

export const exportarPedidosCSV = async (req, res) => {
  try {
    await exportarColeccionCSV(res, "pedido", "pedidos");
  } catch (error) {
    console.error("Error al exportar pedidos a CSV:", error);
    res.status(500).json({
      mensaje: "Error al generar el archivo CSV de pedidos.",
      error: error.message,
    });
  }
};

export const exportarUsuariosCSV = async (req, res) => {
  try {
    await exportarColeccionCSV(res, "usuarios", "usuarios");
  } catch (error) {
    console.error("Error al exportar usuarios a CSV:", error);
    res.status(500).json({
      mensaje: "Error al generar el archivo CSV de usuarios.",
      error: error.message,
    });
  }
};

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


const aplanarCampos = (valor) => {
  const campos = {};
  const pendientes = [{ valor, prefijo: "" }];
  const visitados = new WeakSet();

  while (pendientes.length > 0) {
    const actual = pendientes.pop();
    const { valor: valorActual, prefijo } = actual;

    if (valorActual === null || valorActual === undefined) {
      campos[prefijo] = "";
      continue;
    }

    if (typeof valorActual?.toDate === "function") {
      campos[prefijo] = valorActual.toDate().toISOString();
      continue;
    }

    if (valorActual instanceof Date) {
      campos[prefijo] = valorActual.toISOString();
      continue;
    }

    if (ArrayBuffer.isView(valorActual)) {
      campos[prefijo] = Buffer.from(valorActual).toString("base64");
      continue;
    }

    if (typeof valorActual === "object") {
      if (visitados.has(valorActual)) {
        campos[prefijo] = "[Referencia circular o repetida]";
        continue;
      }
      visitados.add(valorActual);

      const entradas = Array.isArray(valorActual)
        ? valorActual.map((elemento, indice) => [String(indice + 1), elemento])
        : Object.entries(valorActual);
      if (entradas.length === 0) {
        campos[prefijo] = "";
        continue;
      }

      entradas.forEach(([clave, elemento]) => {
        pendientes.push({
          valor: elemento,
          prefijo: prefijo ? `${prefijo}_${clave}` : clave
        });
      });
      continue;
    }

    campos[prefijo] =
      typeof valorActual === "bigint" || typeof valorActual === "symbol" ||
      typeof valorActual === "function"
        ? String(valorActual)
        : typeof valorActual === "number" && !Number.isFinite(valorActual)
          ? String(valorActual)
          : valorActual;
  }

  return campos;
};

export const exportarOlapExcel = async (req, res) => {
  try {
    const [snapshotPedidos, snapshotUsuarios, snapshotProductos] = await Promise.all([
      db.collection("pedido").get(),
      db.collection("usuarios").get(),
      db.collection("productos").get()
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistema de Productos";
    workbook.created = new Date();

    const agregarHojaColeccion = (nombre, documentos) => {
      const filas = documentos.map((doc) =>
        aplanarCampos({ ...doc.data(), id: doc.id })
      );
      const encabezados = [
        ...new Set(["id", ...filas.flatMap((fila) => Object.keys(fila))])
      ];
      const filasExcel = filas.map((fila) =>
        encabezados.map((encabezado) => {
          const valor = fila[encabezado] ?? "";
          return ["string", "number", "boolean"].includes(typeof valor)
            ? valor
            : String(valor);
        })
      );
      const hoja = workbook.addWorksheet(nombre);

      hoja.addRow(encabezados).eachCell((cell) => {
        cell.style = {
          font: { bold: true, color: { argb: "FFFFFFFF" } },
          fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } },
          alignment: { horizontal: "center" }
        };
      });

      filasExcel.forEach((fila) => {
        hoja.addRow(fila);
      });

      encabezados.forEach((encabezado, indice) => {
        const anchoMaximo = filasExcel.reduce(
          (ancho, fila) => Math.max(ancho, String(fila[indice] ?? "").length),
          encabezado.length
        );
        hoja.getColumn(indice + 1).width = Math.min(anchoMaximo + 2, 48);
      });
    };

    agregarHojaColeccion("Pedidos", snapshotPedidos.docs);
    agregarHojaColeccion("Productos", snapshotProductos.docs);
    agregarHojaColeccion("Usuarios", snapshotUsuarios.docs);

    const archivoExcel = await workbook.xlsx.writeBuffer();
    const nombreArchivo = `exportacion-datos-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nombreArchivo}"`
    );
    return res.status(200).send(Buffer.from(archivoExcel));
  } catch (error) {
    console.error("Error al generar el reporte analítico:", error);
    if (res.headersSent) {
      return res.destroy(error);
    }
    return res.status(500).json({
      mensaje: "Error al procesar los datos para el cubo OLAP.",
      error: error.message
    });
  }
};