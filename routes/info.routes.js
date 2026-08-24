import express from 'express';
import multer from 'multer';
import {informacion} from '../controllers/info.controller.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 
  }, // Limite de tamaño de archivo a 5MB
});

router.get('/info', informacion);

export default router;