const express = require('express');
const routes = express.Router();
const db = require('../db'); // Import the database connection

routes.get('/ver-gruas', (req, res) => {
  db.query(`
    SELECT 
      g.id_grua, g.modelo, g.numero_serie, g.placa, g.tipo_grua, 
      c.id_usuario, c.nombre, c.apellido
    FROM gruas g
    LEFT JOIN usuarios c ON g.id_conductor = c.id_usuario
  `, (err, rows) => {
    if (err) {
      console.error('Error al obtener grúas:', err);
      return res.status(500).json({ error: 'Error al obtener grúas' });
    }
    res.json(rows);
  });
});

routes.put('/editar-grua/:id', (req, res) => {
  const id_grua = req.params.id;
  const { modelo, numeroDeSerie, placa, tipoDeGrua, id_conductor } = req.body;

  const sql = `
    UPDATE gruas 
    SET modelo = ?, numero_serie = ?, placa = ?, tipo_grua = ?, id_conductor = ?
    WHERE id_grua = ?
  `;
  db.query(sql, [modelo, numeroDeSerie, placa, tipoDeGrua, id_conductor, id_grua], (err, result) => {
    if (err) {
      console.error('Error al actualizar grúa:', err);
      return res.status(500).json({ message: 'Error al actualizar' });
    }
    res.json({ message: 'Grúa actualizada correctamente' });
  });
});



// Endpoint para registrar una grúa
routes.post('/Registrar-Grua', (req, res) => {
    const { modelo, numeroDeSerie, placa, tipoDeGrua,id_conductor } = req.body;

    // Validar campos requeridos
    if (!modelo || !numeroDeSerie || !placa || !tipoDeGrua || !id_conductor) {
        return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    // Verificar si ya existe una grúa con el mismo número de serie o placa
    const checkSql = `SELECT * FROM gruas WHERE numero_serie = ? OR placa = ?`;
    db.query(checkSql, [numeroDeSerie, placa], (err, results) => {
        if (err) {
            console.error('Error al verificar existencia:', err);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }

        if (results.length > 0) {
            return res.status(400).json({ message: 'Ya existe una grúa con esa placa o número de serie' });
        }

        // Insertar la grúa
        const insertSql = `
            INSERT INTO gruas (modelo, numero_serie, placa, tipo_grua,id_conductor)
            VALUES (?, ?, ?, ?,?)
        `;
        db.query(insertSql, [modelo, numeroDeSerie, placa, tipoDeGrua,id_conductor], (err, result) => {
            if (err) {
                console.error('Error al insertar la grúa:', err);
                return res.status(500).json({ message: 'No se pudo registrar la grúa' });
            }

            res.status(201).json({ message: 'Grúa registrada correctamente' });
        });
    });
});


module.exports = routes;
