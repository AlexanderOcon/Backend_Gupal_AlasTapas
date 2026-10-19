import db from "../firebase.js";

export const calcularEstadisticas = async () => {
  const snapshot = await db.collection("productos").get();

  const productos = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const precios = productos
    .map((producto) => Number(producto.precio))
    .filter(Number.isFinite);
  const stocks = productos
    .map((producto) => Number(producto.stock))
    .filter(Number.isFinite);

  const porCategoria = {};
  productos.forEach((producto) => {
    const categoria = producto.categoria_id?.nombre || "Sin categoría";
    porCategoria[categoria] = (porCategoria[categoria] || 0) + 1;
  });

  const sumaPrecios = precios.reduce((total, precio) => total + precio, 0);
  const sumaStock = stocks.reduce((total, stock) => total + stock, 0);

  return {
    total: productos.length,
    promedioPrecio: precios.length
      ? Number((sumaPrecios / precios.length).toFixed(2))
      : 0,
    precioMin: precios.length ? Math.min(...precios) : null,
    precioMax: precios.length ? Math.max(...precios) : null,
    stockTotal: sumaStock,
    promedioStock: stocks.length
      ? Number((sumaStock / stocks.length).toFixed(2))
      : 0,
    stockMin: stocks.length ? Math.min(...stocks) : null,
    stockMax: stocks.length ? Math.max(...stocks) : null,
    porCategoria,
    productos,
  };
};

export const obtenerEstadisticas = async (req, res) => {
  try {
    const stats = await calcularEstadisticas();
    const { productos, ...resumen } = stats;

    return res.status(200).json({
      mensaje: "Estadísticas generadas correctamente",
      ...resumen,
      detalleCategorias: Object.entries(stats.porCategoria).map(
        ([categoria, cantidad]) => ({
          categoria,
          cantidad,
          porcentaje: Number(((cantidad / stats.total) * 100).toFixed(1)),
        })
      ),
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    return res.status(500).json({
      mensaje: "Error al generar las estadísticas.",
      error: error.message,
    });
  }
};
