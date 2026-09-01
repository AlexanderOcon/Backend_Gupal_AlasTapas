import db from '../firebase.js';

export const categoria = async (req, res) => {
  res.json({
    mensaje: 'Esta es una funcion de prueba del Backend Grupal'
  });
};

export const registrarCategoria = async (req, res) => {
  const { nombre, descripcion } = req.body;

  if (!nombre || !descripcion) {
    return res.status(400).json({
      mensaje: 'El nombre y la descripcion son obligatorios'
    });
  }

  try {
    const categoriaRef = db.collection('categorias').doc();
    const nuevaCategoria = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim()
    };

    await categoriaRef.set(nuevaCategoria);

    return res.status(201).json({
      mensaje: 'Categoria registrada correctamente',
      categoria: nuevaCategoria
    });
  } catch (error) {
    console.error('Error al registrar categoria:', error);
    return res.status(500).json({
      mensaje: 'Error al registrar la categoria'
    });
  }
};