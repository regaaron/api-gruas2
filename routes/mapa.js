const express = require('express');
const routes = express.Router();
const db = require('../db');


routes.get('/usuarios', (req, res) => {
    const sql = `
        SELECT 
            u.id_usuario,
            u.nombre,
            u.apellido,
            u.telefono,
            u.email,
            u.tipo_usuario,
            ub.latitud,
            ub.longitud,
            ub.activo,
            ub.atendido
        FROM usuarios u
        LEFT JOIN ubicaciones ub ON u.id_usuario = ub.id_usuario
        WHERE ub.activo = 1
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching users with location:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
});

module.exports = routes;