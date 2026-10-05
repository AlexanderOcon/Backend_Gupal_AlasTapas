import db from '../firebase.js';
import supabase from '../supabase.js';
import { randomUUID } from 'node:crypto';

const parseCategoria = (categoriaBody) => {
  if (categoriaBody === undefined || categoriaBody === null || categoriaBody === '') {
    return null;
  }

  if (typeof categoriaBody === 'string') {
    return JSON.parse(categoriaBody);
  }

  return categoriaBody;
};

const validarCategoria = (categoria) => {
  if (!categoria || typeof categoria !== 'object') {
    return false;
  }

  const nombre = typeof categoria.nombre === 'string' ? categoria.nombre.trim() : '';
  const descripcion = typeof categoria.descripcion === 'string' ? categoria.descripcion.trim() : '';

  return Boolean(nombre && descripcion);
};

const obtenerBucket = () => process.env.SUPABASE_STORAGE_BUCKET || 'productos';

export const obtenerProductos = async (req, res) => {
  try {
    const snapshot = await db.collection('productos').get();
    const productos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.status(200).json(productos);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return res.status(500).json({
      mensaje: 'Error al obtener los productos',
      error: error.message
    });
  }
};

export const registrarProducto = async (req, res) => {
  const { nombre, precio, stock } = req.body;
  let categoria;

  try {
    categoria = parseCategoria(req.body.categoria);
  } catch {
    return res.status(400).json({
      mensaje: 'La categoria debe ser un objeto JSON valido'
    });
  }

  const imageFile = req.files?.image?.[0] || req.files?.imagen?.[0] || req.file;

  if (
    !nombre ||
    precio === undefined ||
    stock === undefined ||
    !validarCategoria(categoria) ||
    !imageFile
  ) {
    return res.status(400).json({
      mensaje: 'El nombre, precio, image, stock y categoria (nombre y descripcion) son obligatorios'
    });
  }

  const precioNumerico = Number(precio);
  const stockNumerico = Number(stock);

  if (
    !Number.isFinite(precioNumerico) ||
    precioNumerico < 0 ||
    !Number.isInteger(stockNumerico) ||
    stockNumerico < 0
  ) {
    return res.status(400).json({
      mensaje: 'El precio debe ser un numero mayor o igual a 0 y el stock un entero mayor o igual a 0'
    });
  }

  try {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      return res.status(500).json({
        mensaje: 'Faltan las variables de configuración de Firebase'
      });
    }

    const bucket = obtenerBucket();
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        mensaje: 'Faltan las variables de configuración de Supabase'
      });
    }

    const extension = imageFile.originalname.includes('.')
      ? imageFile.originalname.substring(imageFile.originalname.lastIndexOf('.')).toLowerCase()
      : '';
    const imagePath = `${randomUUID()}${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(imagePath, imageFile.buffer, {
        contentType: imageFile.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Error al subir imagen a Supabase:', uploadError);
      return res.status(500).json({
        mensaje: `Error al guardar la imagen del producto: ${uploadError.message}`
      });
    }

    const { data: imageData } = supabase.storage.from(bucket).getPublicUrl(imagePath);
    const productoRef = db.collection('productos').doc();
    const nuevoProducto = {
      nombre: nombre.trim(),
      precio: precioNumerico,
      image: imageData.publicUrl,
      stock: stockNumerico,
      categoria_id: {
        nombre: categoria.nombre.trim(),
        descripcion: categoria.descripcion.trim()
      }
    };

    await productoRef.set(nuevoProducto);

    return res.status(201).json({
      mensaje: 'Producto registrado correctamente',
      producto: {
        id: productoRef.id,
        ...nuevoProducto
      }
    });
  } catch (error) {
    console.error('Error al registrar producto:', error);
    return res.status(500).json({
      mensaje: `Error al registrar el producto: ${error.message}`
    });
  }
};

export const ActualizarProducto = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      mensaje: 'El id del producto es obligatorio'
    });
  }

  const { nombre, precio, stock } = req.body;
  let categoria;

  if (req.body.categoria !== undefined) {
    try {
      categoria = parseCategoria(req.body.categoria);
    } catch {
      return res.status(400).json({
        mensaje: 'La categoria debe ser un objeto JSON valido'
      });
    }

    if (!validarCategoria(categoria)) {
      return res.status(400).json({
        mensaje: 'La categoria debe incluir nombre y descripcion validos'
      });
    }
  }

  const imageFile = req.files?.image?.[0] || req.files?.imagen?.[0] || req.file;

  try {
    const productoRef = db.collection('productos').doc(id);
    const productoActual = await productoRef.get();

    if (!productoActual.exists) {
      return res.status(404).json({
        mensaje: 'Producto no encontrado'
      });
    }

    const productoActualizado = {
      ...productoActual.data()
    };

    if (nombre !== undefined) {
      const nombreLimpio = String(nombre).trim();
      if (!nombreLimpio) {
        return res.status(400).json({
          mensaje: 'El nombre no puede estar vacio'
        });
      }
      productoActualizado.nombre = nombreLimpio;
    }

    if (precio !== undefined) {
      const precioNumerico = Number(precio);
      if (!Number.isFinite(precioNumerico) || precioNumerico < 0) {
        return res.status(400).json({
          mensaje: 'El precio debe ser un numero mayor o igual a 0'
        });
      }
      productoActualizado.precio = precioNumerico;
    }

    if (stock !== undefined) {
      const stockNumerico = Number(stock);
      if (!Number.isInteger(stockNumerico) || stockNumerico < 0) {
        return res.status(400).json({
          mensaje: 'El stock debe ser un entero mayor o igual a 0'
        });
      }
      productoActualizado.stock = stockNumerico;
    }

    if (categoria) {
      productoActualizado.categoria_id = {
        nombre: categoria.nombre.trim(),
        descripcion: categoria.descripcion.trim()
      };
    }

    if (imageFile) {
      const bucket = obtenerBucket();
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({
          mensaje: 'Faltan las variables de configuración de Supabase'
        });
      }

      const extension = imageFile.originalname.includes('.')
        ? imageFile.originalname.substring(imageFile.originalname.lastIndexOf('.')).toLowerCase()
        : '';
      const imagePath = `${randomUUID()}${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(imagePath, imageFile.buffer, {
          contentType: imageFile.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('Error al actualizar la imagen del producto:', uploadError);
        return res.status(500).json({
          mensaje: `Error al guardar la imagen del producto: ${uploadError.message}`
        });
      }

      const { data: imageData } = supabase.storage.from(bucket).getPublicUrl(imagePath);
      productoActualizado.image = imageData.publicUrl;
    }

    await productoRef.update(productoActualizado);

    return res.status(200).json({
      mensaje: 'Producto actualizado correctamente',
      producto: {
        id,
        ...productoActualizado
      }
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return res.status(500).json({
      mensaje: `Error al actualizar el producto: ${error.message}`
    });
  }
};

export const eliminarProducto = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      mensaje: 'El id del producto es obligatorio'
    });
  }

  try {
    const productoRef = db.collection('productos').doc(id);
    const productoActual = await productoRef.get();

    if (!productoActual.exists) {
      return res.status(404).json({
        mensaje: 'Producto no encontrado'
      });
    }

    await productoRef.delete();

    return res.status(200).json({
      mensaje: 'Producto eliminado correctamente',
      id
    });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    return res.status(500).json({
      mensaje: `Error al eliminar el producto: ${error.message}`
    });
  }
};
export const buscarProductos = async (req, res) => {
  try {
    const { q } = req.query;

    if (typeof q !== 'string' || q.trim() === '') {
      return res.status(400).json({
        mensaje: 'Debes enviar un término de búsqueda (parámetro q).'
      });
    }

    const termino = q.trim().toLowerCase();
    const snapshot = await db.collection('productos').get();

    const productos = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter((producto) => {
        const categoria = producto.categoria_id || {};
        const valores = [
          producto.nombre,
          producto.precio,
          producto.image,
          producto.stock,
          categoria.nombre,
          categoria.descripcion
        ];

        return valores.some((valor) =>
          String(valor ?? '').toLowerCase().includes(termino)
        );
      });

    return res.status(200).json(productos);
  } catch (error) {
    console.error('Error al buscar productos:', error);
    return res.status(500).json({
      mensaje: 'Error al buscar los productos',
      error: error.message
    });
  }
};