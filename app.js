import express from 'express';
import cors from 'cors';
import infoRoutes from './routes/info.routes.js';
import categoriaRoutes from './routes/categoria.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use(infoRoutes);
app.use('/api', categoriaRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

export default app;