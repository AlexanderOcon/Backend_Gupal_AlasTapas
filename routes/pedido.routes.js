import express from 'express';
import { exportarPedidosCSV } from '../controllers/exportacion.controllers.js';
import {
  actualizarPedido,
  eliminarPedido,
  obtenerPedidoPorId,
  obtenerPedidos,
  registrarPedido
} from '../controllers/pedido.controller.js';
import { capturarInfoSolicitud } from "../middlewares/auditoria.js";

const router = express.Router();

router.use(capturarInfoSolicitud);
router.get('/pedido', obtenerPedidos);
router.get('/pedido/:id', obtenerPedidoPorId);
router.post('/registrarpedido', registrarPedido);
router.put('/actualizarpedido/:id', actualizarPedido);
router.delete('/eliminarpedido/:id', eliminarPedido);
router.get('/exportar/pedidos', exportarPedidosCSV);

export default router;