import db from '../firebase.js';

const obtenerProductoEmbebido = async (productoId) => {
  const productoSnapshot = await db.collection('productos').doc(productoId).get();

  if (!productoSnapshot.exists) {
    return null;
  }

  return {
    id: productoSnapshot.id,
    ...productoSnapshot.data()
  };
};

const existeUsuario = async (usuarioId) => {
  const usuarioSnapshot = await db.collection('usuario').doc(usuarioId).get();
  return usuarioSnapshot.exists;
};

const normalizarFecha = (fecha) => {
  const valor = fecha === undefined ? new Date() : new Date(fecha);
  return Number.isNaN(valor.getTime()) ? null : valor.toISOString();
};

export const obtenerPedidos = async (req, res) => {
  try {
    const snapshot = await db.collection('pedidos').get();
    const pedidos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.status(200).json(pedidos);
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    return res.status(500).json({
      mensaje: 'Error al obtener los pedidos',
      error: error.message
    });
  }
};

export const obtenerPedidoPorId = async (req, res) => {
  try {
    const pedidoSnapshot = await db.collection('pedidos').doc(req.params.id).get();

    if (!pedidoSnapshot.exists) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }

    return res.status(200).json({
      id: pedidoSnapshot.id,
      ...pedidoSnapshot.data()
    });
  } catch (error) {
    console.error('Error al obtener el pedido:', error);
    return res.status(500).json({
      mensaje: 'Error al obtener el pedido',
      error: error.message
    });
  }
};

export const registrarPedido = async (req, res) => {
  const { productoId, usuarioId, fechaPedido } = req.body ?? {};

  if (
    typeof productoId !== 'string' || !productoId.trim() ||
    typeof usuarioId !== 'string' || !usuarioId.trim()
  ) {
    return res.status(400).json({
      mensaje: 'Los campos productoId y usuarioId son obligatorios'
    });
  }

  const fecha = normalizarFecha(fechaPedido);
  if (!fecha) {
    return res.status(400).json({ mensaje: 'La fecha del pedido no es válida' });
  }

  try {
    const producto = await obtenerProductoEmbebido(productoId.trim());
    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    if (!(await existeUsuario(usuarioId.trim()))) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const pedidoRef = db.collection('pedidos').doc();
    const nuevoPedido = {
      fecha_pedido: fecha,
      producto,
      usuario_id: usuarioId.trim()
    };

    await pedidoRef.set(nuevoPedido);

    return res.status(201).json({
      mensaje: 'Pedido registrado correctamente',
      pedido: {
        id: pedidoRef.id,
        ...nuevoPedido
      }
    });
  } catch (error) {
    console.error('Error al registrar pedido:', error);
    return res.status(500).json({
      mensaje: `Error al registrar el pedido: ${error.message}`
    });
  }
};

export const actualizarPedido = async (req, res) => {
  const { productoId, usuarioId, fechaPedido } = req.body ?? {};
  const cambios = {};

  if (productoId !== undefined) {
    if (typeof productoId !== 'string' || !productoId.trim()) {
      return res.status(400).json({ mensaje: 'productoId no es válido' });
    }
  }

  if (usuarioId !== undefined) {
    if (typeof usuarioId !== 'string' || !usuarioId.trim()) {
      return res.status(400).json({ mensaje: 'usuarioId no es válido' });
    }
  }

  if (fechaPedido !== undefined) {
    const fecha = normalizarFecha(fechaPedido);
    if (!fecha) {
      return res.status(400).json({ mensaje: 'La fecha del pedido no es válida' });
    }
    cambios.fecha_pedido = fecha;
  }

  if (productoId === undefined && usuarioId === undefined && fechaPedido === undefined) {
    return res.status(400).json({
      mensaje: 'Debe enviar al menos un campo para actualizar'
    });
  }

  try {
    const pedidoRef = db.collection('pedidos').doc(req.params.id);
    const pedidoSnapshot = await pedidoRef.get();

    if (!pedidoSnapshot.exists) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }

    if (productoId !== undefined) {
      const producto = await obtenerProductoEmbebido(productoId.trim());
      if (!producto) {
        return res.status(404).json({ mensaje: 'Producto no encontrado' });
      }
      cambios.producto = producto;
    }

    if (usuarioId !== undefined) {
      const usuarioIdLimpio = usuarioId.trim();
      if (!(await existeUsuario(usuarioIdLimpio))) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      }
      cambios.usuario_id = usuarioIdLimpio;
    }

    await pedidoRef.update(cambios);

    return res.status(200).json({
      mensaje: 'Pedido actualizado correctamente',
      pedido: {
        id: pedidoRef.id,
        ...pedidoSnapshot.data(),
        ...cambios
      }
    });
  } catch (error) {
    console.error('Error al actualizar pedido:', error);
    return res.status(500).json({
      mensaje: `Error al actualizar el pedido: ${error.message}`
    });
  }
};

export const eliminarPedido = async (req, res) => {
  try {
    const pedidoRef = db.collection('pedidos').doc(req.params.id);
    const pedidoSnapshot = await pedidoRef.get();

    if (!pedidoSnapshot.exists) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }

    await pedidoRef.delete();

    return res.status(200).json({
      mensaje: 'Pedido eliminado correctamente',
      pedido: {
        id: pedidoSnapshot.id,
        ...pedidoSnapshot.data()
      }
    });
  } catch (error) {
    console.error('Error al eliminar pedido:', error);
    return res.status(500).json({
      mensaje: `Error al eliminar el pedido: ${error.message}`
    });
  }
};
