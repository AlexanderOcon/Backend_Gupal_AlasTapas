import db from '../firebase.js';

const parseJsonValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return {};
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
};

const normalizarCarrito = (carrito) => {
  const valor = parseJsonValue(carrito);

  if (Array.isArray(valor)) {
    return valor.reduce((acumulador, item, indice) => {
      if (item && typeof item === 'object') {
        acumulador[`producto${indice + 1}`] = item;
      }
      return acumulador;
    }, {});
  }

  if (valor && typeof valor === 'object') {
    return valor;
  }

  return {};
};

const normalizarDirecciones = (direcciones) => {
  const valor = parseJsonValue(direcciones);

  if (Array.isArray(valor)) {
    return valor.reduce((acumulador, item, indice) => {
      acumulador[String(indice)] = String(item ?? '').trim();
      return acumulador;
    }, {});
  }

  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([key, item]) => [String(key), String(item ?? '').trim()])
    );
  }

  return {};
};

const validarCarrito = (carrito) => {
  if (!carrito || typeof carrito !== 'object') {
    return false;
  }

  const entries = Object.entries(carrito);
  if (entries.length === 0) {
    return false;
  }

  return entries.every(([, item]) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const producto = item.producto ?? item.producto_id ?? item.url ?? item.enlace ?? '';
    const cantidad = item.cantidad ?? item.qty ?? item.cant ?? item.quantity;

    return Boolean(producto) && (cantidad !== undefined && cantidad !== null && cantidad !== '');
  });
};

const validarDirecciones = (direcciones) => {
  if (!direcciones || typeof direcciones !== 'object') {
    return false;
  }

  const entries = Object.entries(direcciones);
  if (entries.length === 0) {
    return false;
  }

  return entries.every(([, direccion]) => typeof direccion === 'string' && direccion.trim().length > 0);
};

export const obtenerUsuarios = async (req, res) => {
  try {
    const snapshot = await db.collection('usuario').get();
    const usuario = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.status(200).json(usuario);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return res.status(500).json({
      mensaje: 'Error al obtener los usuarios',
      error: error.message
    });
  }
};

export const registrarUsuario = async (req, res) => {
  const { nombre, apellido, telefono } = req.body ?? {};

  const carrito = normalizarCarrito(req.body?.carrito);
  const direcciones = normalizarDirecciones(req.body?.direcciones);

  const nombreLimpio = String(nombre ?? '').trim();
  const apellidoLimpio = String(apellido ?? '').trim();
  const telefonoLimpio = String(telefono ?? '').trim();

  if (!nombreLimpio || !telefonoLimpio || !validarCarrito(carrito) || !validarDirecciones(direcciones)) {
    return res.status(400).json({
      mensaje: 'Los campos nombre, telefono, carrito y direcciones son obligatorios y deben tener un formato válido'
    });
  }

  try {
    const usuarioRef = db.collection('usuario').doc();
    const nuevoUsuario = {
      nombre: nombreLimpio,
      apellido: apellidoLimpio,
      telefono: telefonoLimpio,
      carrito,
      direcciones
    };

    await usuarioRef.set(nuevoUsuario);

    return res.status(201).json({
      mensaje: 'Usuario registrado correctamente',
      usuario: {
        id: usuarioRef.id,
        ...nuevoUsuario
      }
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    return res.status(500).json({
      mensaje: `Error al registrar el usuario: ${error.message}`
    });
  }
};

export const actualizarUsuario = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      mensaje: 'El id del usuario es obligatorio'
    });
  }

  try {
    const usuarioRef = db.collection('usuario').doc(id);
    const usuarioActual = await usuarioRef.get();

    if (!usuarioActual.exists) {
      return res.status(404).json({
        mensaje: 'Usuario no encontrado'
      });
    }

    const usuarioActualizado = {
      ...usuarioActual.data()
    };

    const { nombre, apellido, telefono, carrito, direcciones } = req.body ?? {};

    if (nombre !== undefined) {
      const nombreLimpio = String(nombre).trim();
      if (!nombreLimpio) {
        return res.status(400).json({
          mensaje: 'El nombre no puede estar vacío'
        });
      }
      usuarioActualizado.nombre = nombreLimpio;
    }

    if (apellido !== undefined) {
      usuarioActualizado.apellido = String(apellido).trim();
    }

    if (telefono !== undefined) {
      const telefonoLimpio = String(telefono).trim();
      if (!telefonoLimpio) {
        return res.status(400).json({
          mensaje: 'El teléfono no puede estar vacío'
        });
      }
      usuarioActualizado.telefono = telefonoLimpio;
    }

    if (carrito !== undefined) {
      const carritoNormalizado = normalizarCarrito(carrito);
      if (!validarCarrito(carritoNormalizado)) {
        return res.status(400).json({
          mensaje: 'El carrito debe contener productos válidos con cantidad'
        });
      }
      usuarioActualizado.carrito = carritoNormalizado;
    }

    if (direcciones !== undefined) {
      const direccionesNormalizadas = normalizarDirecciones(direcciones);
      if (!validarDirecciones(direccionesNormalizadas)) {
        return res.status(400).json({
          mensaje: 'Las direcciones deben contener valores válidos'
        });
      }
      usuarioActualizado.direcciones = direccionesNormalizadas;
    }

    await usuarioRef.update(usuarioActualizado);

    return res.status(200).json({
      mensaje: 'Usuario actualizado correctamente',
      usuario: {
        id,
        ...usuarioActualizado
      }
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return res.status(500).json({
      mensaje: `Error al actualizar el usuario: ${error.message}`
    });
  }
};

export const eliminarUsuario = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      mensaje: 'El id del usuario es obligatorio'
    });
  }

  try {
    const usuarioRef = db.collection('usuario').doc(id);
    const usuarioActual = await usuarioRef.get();

    if (!usuarioActual.exists) {
      return res.status(404).json({
        mensaje: 'Usuario no encontrado'
      });
    }

    await usuarioRef.delete();

    return res.status(200).json({
      mensaje: 'Usuario eliminado correctamente',
      usuario: {
        id,
        ...usuarioActual.data()
      }
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return res.status(500).json({
      mensaje: `Error al eliminar el usuario: ${error.message}`
    });
  }
};
