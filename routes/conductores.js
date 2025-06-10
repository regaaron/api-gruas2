const express = require('express');
const routes = express.Router();
const db = require('../db');

routes.get('/ver-conductores', (req,res)=>{
    db.query('SELECT * FROM usuarios WHERE tipo_usuario = "conductor"',(err,results)=>{
        if (err) {
            console.error('Error fetching conductores:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
});
const bcrypt = require('bcrypt');

routes.post('/Registrar-Conductor', async (req, res) => {
    const { nombre, apellido, direccion, telefono, email, password } = req.body;

    if (!nombre || !apellido || !direccion || !telefono || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    // Verifica si ya existe
    const checkSql = 'SELECT id_usuario FROM usuarios WHERE email = ?';
    db.query(checkSql, [email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Error en el servidor' });
        if (results.length > 0) return res.status(400).json({ message: 'El conductor ya existe' });

        try {
            const hashedPassword = await bcrypt.hash(password, 10); // 🔐 Aquí se encripta la contraseña

            const insertSql = `
                INSERT INTO usuarios (nombre, apellido, direccion, telefono, email, password, tipo_usuario)
                VALUES (?, ?, ?, ?, ?, ?, 'conductor')
            `;
            db.query(insertSql, [nombre, apellido, direccion, telefono, email, hashedPassword], (err) => {
                if (err) return res.status(500).json({ message: 'Error al registrar conductor' });
                res.status(201).json({ message: 'Conductor registrado con éxito' });
            });

        } catch (err) {
            console.error('Error en bcrypt:', err);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    });
});

// Actualizar conductor
routes.put('/actualizar-conductor/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, direccion, telefono, email, password } = req.body;

  if (!nombre || !apellido || !direccion || !telefono || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  try {
    // Verificar si la contraseña ya está encriptada
    const hashRegex = /^\$2[aby]\$/;

    let nuevaPassword = password;

    if (!hashRegex.test(password)) {
      // Solo encripta si no lo está
      nuevaPassword = await bcrypt.hash(password, 10);
    }

    const sql = `
      UPDATE usuarios 
      SET nombre = ?, apellido = ?, direccion = ?, telefono = ?, email = ?, password = ?
      WHERE id_usuario = ? AND tipo_usuario = 'conductor'
    `;

    db.query(sql, [nombre, apellido, direccion, telefono, email, nuevaPassword, id], (err, result) => {
      if (err) {
        console.error('Error al actualizar conductor:', err);
        return res.status(500).json({ error: 'Error al actualizar el conductor' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Conductor no encontrado' });
      }

      res.status(200).json({ message: 'Conductor actualizado correctamente' });
    });
  } catch (error) {
    console.error('Error al procesar la actualización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});




module.exports = routes;