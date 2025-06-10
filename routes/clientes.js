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
const bcrypt = require('bcrypt');

routes.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const sql = 'SELECT * FROM usuarios WHERE email = ? AND tipo_usuario = "admin"';
    db.query(sql, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Error en el servidor' });
        if (results.length === 0) return res.status(401).json({ error: 'Usuario no encontrado asegurate ser admin' });

        const user = results[0];

        const hashRegex = /^\$2[aby]\$/; // Detecta si la contraseña ya está en formato bcrypt

        if (hashRegex.test(user.password)) {
            // Contraseña ya está encriptada con bcrypt
            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.status(401).json({ error: 'Contraseña incorrecta' });
        } else {
            // Contraseña está en texto plano (insegura)
            if (password !== user.password) return res.status(401).json({ error: 'Contraseña incorrecta' });

            // Actualizar contraseña a versión encriptada
            const newHashedPassword = await bcrypt.hash(password, 10);
            db.query('UPDATE usuarios SET password = ? WHERE id_usuario = ?', [newHashedPassword, user.id_usuario]);
        }

        // Acceso permitido
        res.json({
            id_usuario: user.id_usuario,
            nombre: user.nombre,
            email: user.email,
            tipo_usuario: user.tipo_usuario
        });
    });
});
module.exports = routes;