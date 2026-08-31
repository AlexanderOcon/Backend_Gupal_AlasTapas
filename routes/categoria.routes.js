import express from 'express';
import { categoria, registrarCategoria } from '../controllers/categoria.controller.js';

const router = express.Router();

router.get('/categorias', categoria);
router.post('/registrarcategoria', registrarCategoria);

export default router;