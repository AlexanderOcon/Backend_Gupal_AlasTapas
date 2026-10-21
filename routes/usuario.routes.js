import express from 'express';
import {
  obtenerUsuarios,
  registrarUsuario,
  actualizarUsuario,
  eliminarUsuario
} from '../controllers/usuario.controllers.js';
import { exportarUsuariosCSV } from '../controllers/exportacion.controllers.js';

const router = express.Router();

router.get('/usuario', obtenerUsuarios);
router.get('/exportar/usuarios', exportarUsuariosCSV);
router.post('/registrarusuario', registrarUsuario);
router.put('/actualizarusuario/:id', actualizarUsuario);
router.delete('/eliminarusuario/:id', eliminarUsuario);

export default router;
