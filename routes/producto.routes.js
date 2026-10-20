import express from 'express';
import multer from 'multer';
import { obtenerProductos, registrarProducto, ActualizarProducto, eliminarProducto, buscarProductos } from '../controllers/producto.controller.js';
import { capturarInfoSolicitud } from "../middlewares/auditoria.js";

const router = express.Router();
router.use(capturarInfoSolicitud);   // aplica a todas las rutas de este router

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }
});

router.get('/producto', obtenerProductos);
router.get('/buscarproducto', buscarProductos);
router.post(
  '/registrarproducto',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'imagen', maxCount: 1 }
  ]),
  registrarProducto
);
router.put(
  '/actualizarproducto/:id',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'imagen', maxCount: 1 }
  ]),
  ActualizarProducto
);
router.delete('/eliminarproducto/:id', eliminarProducto);
export default router;