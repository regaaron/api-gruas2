const express = require('express');
const routes = express.Router();
const db = require('../db');

routes.get('/usuarios', (req, res) => {
    db.query('SELECT id_usuario,nombre,apellido,direccion,telefono,email  FROM usuarios', (err, results) => {
        if (err) {
            console.error('Error fetching clients:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
});
routes.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const sql = `
        SELECT id_usuario, nombre, email, tipo_usuario
        FROM usuarios
        WHERE email = ? AND password = ? AND tipo_usuario = 'admin'
    `;

    db.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error('Error during login:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password or don\'t have access' });
        }
        res.json(results[0]);
    });
});


module.exports = routes;