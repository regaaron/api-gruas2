const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',         // Usuario por defecto en XAMPP
    password: '',         // Sin contraseña por defecto
    database: 'gruas2',
    port: 33065,          // Puerto por defecto de MySQL
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('✅ Conexión exitosa a la base de datos');
});

module.exports = connection;
