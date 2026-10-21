import express from 'express';
import cors from 'cors';
import infoRoutes from './routes/info.routes.js';
import productoRoutes from './routes/producto.routes.js';
import rateLimit from "express-rate-limit";
import db from "./firebase.js";  // Para el registro de la bitácora
import estadisticasRoutes from "./routes/estadisticas.routes.js";
import usuarioRoutes from "./routes/usuario.routes.js";
import pedidoRoutes from "./routes/pedido.routes.js";





const app = express();
// Rate limit para las rutas de productos
const limiterProducto = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    mensaje: "Demasiadas peticiones desde esta IP. Intenta de nuevo más tarde.",
  },
  handler: async (req, res, next, options) => {
    try {
      await db.collection("auditoria_productos").add({
        accion: "rate_limit_bloqueado",
        fecha: new Date().toISOString(),
        ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip,
        userAgent: req.headers["user-agent"],
        ruta: req.originalUrl,
        metodo: req.method,
      });
    } catch (error) {
      console.error("Error al registrar bloqueo por rate limit:", error);
    }
    res.status(options.statusCode).json(options.message);
  },
});

app.use("/api", limiterProducto);


app.use(cors());
app.use(express.json());

app.use(infoRoutes);
app.use('/api', productoRoutes);
app.use('/api', usuarioRoutes);
app.use('/api', pedidoRoutes);
app.use(estadisticasRoutes);
app.use('/api', estadisticasRoutes);



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