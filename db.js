const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

// Adatbázis kapcsolat eseménykezelők
pool.on('error', (err) => {
    console.error('Váratlan hiba az adatbázis kapcsolatban:', err);
    // Próbáljuk meg újracsatlakoztatni ha szükséges
});

// Kapcsolat tesztelése
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Hiba az adatbázis kapcsolódás során:', err);
    } else {
        console.log('Database connection successful!');
    }
});

module.exports = pool;