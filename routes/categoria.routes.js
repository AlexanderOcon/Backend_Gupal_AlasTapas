import express from 'express';
import multer from 'multer';
import {categoria} from '../controllers/categoria.controller.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 
  }, // Limite de tamaño de archivo a 5MB
});

router.get('/categoria', categoria);

export default router;