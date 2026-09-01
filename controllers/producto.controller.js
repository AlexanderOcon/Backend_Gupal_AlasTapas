import db from '../firebase.js';
import supabase from '../supabase.js';

export const producto = async (req, res) => {
  res.json({
    mensaje: 'Esta es una funcion de prueba del Backend Grupal'
  });
};

export const registrarProducto = async (req, res) => {
  const { nombre, precio, stock, categoriaId } = req.body;

  if (!nombre || precio === undefined || stock === undefined || !categoriaId || !req.file) {
    return res.status(400).json({
      mensaje: 'El nombre, precio, imagen, stock y categoriaId son obligatorios'
    });
  }

  const precioNumerico = Number(precio);
  const stockNumerico = Number(stock);

  if (!Number.isFinite(precioNumerico) || precioNumerico < 0 || !Number.isInteger(stockNumerico) || stockNumerico < 0) {
    return res.status(400).json({
      mensaje: 'El precio debe ser un numero mayor o igual a 0 y el stock un entero mayor o igual a 0'
    });
  }

  try {
    const categoriaRef = db.collection('categorias').doc(categoriaId);
    const categoriaSnapshot = await categoriaRef.get();

    if (!categoriaSnapshot.exists) {
      return res.status(404).json({
        mensaje: 'La categoria indicada no existe'
      });
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'productos';
    const extension = req.file.originalname.includes('.')
      ? req.file.originalname.substring(req.file.originalname.lastIndexOf('.')).toLowerCase()
      : '';
    const imagePath = `${randomUUID()}${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(imagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Error al subir imagen a Supabase:', uploadError);
      return res.status(500).json({
        mensaje: 'Error al guardar la imagen del producto'
      });
    }

    const { data: imageData } = supabase.storage.from(bucket).getPublicUrl(imagePath);
    const productoRef = db.collection('productos').doc();
    const nuevoProducto = {
      nombre: nombre.trim(),
      precio: precioNumerico,
      imagen: imageData.publicUrl,
      stock: stockNumerico,
      categoriaId: categoriaRef.id
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
      mensaje: 'Error al registrar el producto'
    });
  }
};