import express from "express";
import { obtenerEstadisticas } from "../controllers/estadisticas.controller.js";
import {
  exportarColeccionJSON,
  exportarColeccionSQL,
  exportarColeccionTXT,
  exportarEstadisticasExcel,
  exportarOlapExcel
} from "../controllers/exportacion.controllers.js";
import { capturarInfoSolicitud } from "../middlewares/auditoria.js";

const router = express.Router();

router.use(capturarInfoSolicitud);

// Estadísticas en JSON
router.get("/estadisticas", obtenerEstadisticas);

// Descarga el archivo Excel
router.get("/estadisticas/excel", exportarEstadisticasExcel);
router.get("/exportar-olap", exportarOlapExcel);

// Exporta cada colección de negocio como texto, JSON o SQL
router.get(
  "/estadisticas/exportar/:coleccion/txt",
  exportarColeccionTXT
);
router.get(
  "/estadisticas/exportar/:coleccion/json",
  exportarColeccionJSON
);
router.get(
  "/estadisticas/exportar/:coleccion/sql",
  exportarColeccionSQL
);

export default router;
