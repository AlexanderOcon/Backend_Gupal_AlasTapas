import express from 'express';
import multer from 'multer';
import { producto, registrarProducto } from '../controllers/producto.controller.js';

const router = express.Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }
});

router.get('/producto', producto);
router.post(
  '/registrarproducto',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'imagen', maxCount: 1 }
  ]),
  registrarProducto
);

export default router;