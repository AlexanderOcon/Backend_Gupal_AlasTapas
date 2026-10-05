import express from 'express';
import {
  obtenerUsuarios,
  registrarUsuario,
  actualizarUsuario,
  eliminarUsuario
} from '../controllers/usuario.controllers.js';

const router = express.Router();

router.get('/usuario', obtenerUsuarios);
router.post('/registrarusuario', registrarUsuario);
router.put('/actualizarusuario/:id', actualizarUsuario);
router.delete('/eliminarusuario/:id', eliminarUsuario);

export default router;
