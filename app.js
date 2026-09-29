import express from 'express';
import cors from 'cors';
import infoRoutes from './routes/info.routes.js';
import productoRoutes from './routes/producto.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use(infoRoutes);
app.use('/api', productoRoutes);

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      mensaje: 'JSON inválido en la solicitud',
      error: 'El cuerpo de la petición no tiene un formato JSON válido'
    });
  }

  return next(err);
});

app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

export default app;