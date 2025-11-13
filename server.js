const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pool = require('./db');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware beállítása
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session beállítása
app.use(session({
    secret: 'running-app-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// Alapvető API végpontok
app.get('/api/test', (req, res) => {
    res.json({
        message: 'API működik',
        session: req.session,
        user: req.session.userId ? 'Bejelentkezve' : 'Nincs bejelentkezve'
    });
});

// Regisztráció endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, gender, birth_year } = req.body;

        // Validáció
        if (!username || !email || !password || !gender || !birth_year) {
            return res.status(400).json({ error: 'Minden mező kitöltése kötelező' });
        }

        // Ellenőrizzük, hogy létezik-e már a felhasználó
        const userExists = await pool.query(
            'SELECT * FROM public.users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'Felhasználónév vagy email már létezik' });
        }

        // Jelszó hash-elés (10 salt rounds)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Felhasználó mentése
        const newUser = await pool.query(
            'INSERT INTO public.users (username, email, password_hash, gender, birth_year) VALUES ($1, $2, $3, $4, $5) RETURNING user_id, username, email, gender, birth_year',
            [username, email, hashedPassword, gender, birth_year]
        );

        res.status(201).json({ 
            message: 'Sikeres regisztráció',
            user: newUser.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Szerver hiba' });
    }
});

// Bejelentkezés endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Felhasználó keresése
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Hibás felhasználónév vagy jelszó' });
        }

        const user = result.rows[0];

        // Jelszó ellenőrzés
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Hibás felhasználónév vagy jelszó' });
        }

        // Session beállítás
        req.session.userId = user.user_id; // Változtatás: user.id helyett user.user_id
        req.session.username = user.username;
        
        // Session mentése
        req.session.save((err) => {
            if (err) {
                console.error('Session mentési hiba:', err);
                return res.status(500).json({ error: 'Session mentési hiba' });
            }
            
            console.log('Session beállítva:', req.session);
            res.json({ 
                message: 'Sikeres bejelentkezés',
                user: { 
                    id: user.user_id, 
                    username: user.username, 
                    email: user.email 
                }
            });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Szerver hiba' });
    }
});

// Kijelentkezés endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Kijelentkezési hiba' });
        }
        res.json({ message: 'Sikeres kijelentkezés' });
    });
});

// Authentikáció ellenőrzés middleware
const requireAuth = (req, res, next) => {
    console.log('Session állapot:', req.session);
    if (!req.session.userId) {
        console.log('Nincs bejelentkezve: session.userId hiányzik');
        return res.status(401).json({ error: 'Nem vagy bejelentkezve' });
    }
    console.log('Felhasználó azonosítva:', req.session.userId);
    next();
};

// Védett route - jelenlegi felhasználó adatai
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, created_at FROM users WHERE id = $1',
            [req.session.userId]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Szerver hiba' });
    }
});

// Dashboard statisztikák lekérése
app.get('/api/dashboard-stats', requireAuth, async (req, res) => {
    try {
        const { period, startDate, endDate } = req.query;
        let dateFilter;
        
        switch(period) {
            case 'week':
                // Get the start of the current week (Monday)
                dateFilter = "created_at >= date_trunc('week', NOW()) AND created_at < date_trunc('week', NOW() + INTERVAL '1 week')";
                break;
            case 'month':
                // Get the start of the current month
                dateFilter = "created_at >= date_trunc('month', NOW()) AND created_at < date_trunc('month', NOW() + INTERVAL '1 month')";
                break;
            case 'year':
                // Get the start of the current year
                dateFilter = "created_at >= date_trunc('year', NOW()) AND created_at < date_trunc('year', NOW() + INTERVAL '1 year')";
                break;
        }
        console.log('Period:', period);
        console.log('Date filter:', dateFilter);

        // Összesített statisztikák lekérése
        const statsQuery = `
            SELECT 
                COUNT(*) as total_runs,
                COALESCE(SUM(distance_km), 0) as total_distance,
                COALESCE(SUM(duration_min), 0) as total_duration,
                COALESCE(ROUND(AVG(distance_km), 2), 0) as avg_distance,
                COALESCE(ROUND(AVG(duration_min), 2), 0) as avg_duration,
                COALESCE(SUM(calories), 0) as total_calories,
                COALESCE(ROUND(SUM(elevation_gained)::numeric, 0), 0) as total_elevation,
                COALESCE(ROUND(AVG(avg_heartRate), 0), 0) as avg_heart_rate,
                COALESCE((
                    SELECT difficulty 
                    FROM runs
                    WHERE user_id = $1 AND ${dateFilter}
                    ORDER BY difficulty DESC, created_at DESC
                    LIMIT 1
                ), 0) as max_difficulty,
                CASE 
                    WHEN COALESCE(SUM(distance_km), 0) > 0 
                    THEN COALESCE(ROUND(SUM(duration_min) / SUM(distance_km), 2), 0)
                    ELSE 0
                END as avg_pace
            FROM runs 
            WHERE user_id = $1 AND ${dateFilter}
        `;

        // Időszak specifikus lekérdezés a grafikonhoz
        let timeSeriesQuery;
        if (period === 'year') {
            timeSeriesQuery = `
                SELECT 
                    dt::date as date,
                    TO_CHAR(dt, 'Month') as label,
                    COALESCE(SUM(r.distance_km), 0) as distance,
                    COUNT(r.*) as runs
                FROM (
                    SELECT generate_series(
                        date_trunc('year', CURRENT_DATE),
                        date_trunc('year', CURRENT_DATE) + interval '11 months',
                        interval '1 month'
                    ) as dt
                ) dates
                LEFT JOIN runs r ON 
                    DATE_TRUNC('month', r.created_at) = dates.dt AND
                    r.user_id = $1
                GROUP BY dt, label
                ORDER BY dt
            `;
        } else if (period === 'week') {
            timeSeriesQuery = `
                WITH week_dates AS (
                    SELECT generate_series(
                        date_trunc('week', NOW()),
                        date_trunc('week', NOW()) + INTERVAL '6 days',
                        INTERVAL '1 day'
                    ) AS date
                )
                SELECT 
                    wd.date::date as date,
                    TO_CHAR(wd.date, 'Day') as label,
                    COALESCE(ROUND(SUM(r.distance_km)::numeric, 1), 0) as distance,
                    COUNT(r.*) as runs,
                    ROUND(AVG(r.calories)::numeric, 0) as avg_calories,
                    ROUND(AVG(r.avg_heartRate)::numeric, 0) as avg_heart_rate
                FROM week_dates wd
                LEFT JOIN runs r ON DATE(r.created_at) = wd.date::date AND r.user_id = $1
                GROUP BY wd.date
                ORDER BY wd.date
            `;
        } else {
            timeSeriesQuery = `
                WITH month_dates AS (
                    SELECT generate_series(
                        date_trunc('month', NOW()),
                        date_trunc('month', NOW() + INTERVAL '1 month') - INTERVAL '1 day',
                        INTERVAL '1 day'
                    ) AS date
                )
                SELECT 
                    md.date::date as date,
                    TO_CHAR(md.date, 'DD') as label,
                    COALESCE(ROUND(SUM(r.distance_km)::numeric, 1), 0) as distance,
                    COUNT(r.*) as runs,
                    ROUND(AVG(r.calories)::numeric, 0) as avg_calories,
                    ROUND(AVG(r.avg_heartRate)::numeric, 0) as avg_heart_rate
                FROM month_dates md
                LEFT JOIN runs r ON DATE(r.created_at) = md.date::date AND r.user_id = $1
                GROUP BY md.date
                ORDER BY md.date
            `;
        }

        // Nehézségi eloszlás lekérdezése (PIE CHART ADAT)
        const difficultyQuery = `
            SELECT 
                difficulty, 
                COUNT(*) as count 
            FROM runs 
            WHERE 
                user_id = $1 AND ${dateFilter} AND difficulty IS NOT NULL 
            GROUP BY 
                difficulty 
            ORDER BY 
                difficulty DESC
        `;

        const [stats, timeSeries, difficulty] = await Promise.all([
            pool.query(statsQuery, [req.session.userId]),
            pool.query(timeSeriesQuery, [req.session.userId]),
            pool.query(difficultyQuery, [req.session.userId])
        ]);

        console.log('Period:', period);
        console.log('Stats for period:', stats.rows[0]);

        // Send both the stats and timeSeries data in the response
        res.json({
            stats: stats.rows[0],
            timeSeries: timeSeries.rows,
            difficulty: difficulty.rows
        });

    } catch (error) {
        console.error('Hiba a dashboard statisztikák lekérésekor:', error);
        res.status(500).json({ error: 'Szerver hiba' });
    }
});

// Utolsó futás lekérése
// Profile statisztikák lekérése
app.get('/api/profile-stats', requireAuth, async (req, res) => {
    try {
        console.log('Fetching stats for user:', req.session.userId); // Debug log

        const result = await pool.query(
            `SELECT 
                COALESCE(COUNT(*), 0) as "totalRuns",
                COALESCE(ROUND(SUM(distance_km)::numeric, 1), 0) as "totalDistance"
             FROM runs 
             WHERE user_id = $1`,
            [req.session.userId]
        );

        console.log('Profile stats result:', result.rows[0]); // Debug log
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching profile stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/last-run', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                distance_km, 
                duration_min, 
                difficulty,
                TO_CHAR(created_at, 'YYYY-MM-DD') as run_date
             FROM runs 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.json({ message: 'No runs yet' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Hiba az utolsó futás lekérésekor:', error);
        res.status(500).json({ error: 'Szerver hiba' });
    }
});


// Új futás hozzáadása API végpont
app.post('/api/add-run', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { distance, minutes, difficulty, calories, elevation, avg_heartRate } = req.body;

        // Idő átalakítása
        const timeParts = minutes.split(':');
        const durationInSeconds = (parseInt(timeParts[0], 10) * 60) + parseInt(timeParts[1], 10);
        const durationInMinutes = durationInSeconds / 60.0;
        
        // Sebesség számítások
        const distanceInKm = parseFloat(distance);
        const durationInHours = durationInMinutes / 60.0;
        const avgSpeedKmH = distanceInKm / durationInHours;
        const paceMinPerKm = durationInMinutes / distanceInKm;

        const query = `
            INSERT INTO public.runs 
            (user_id, distance_km, duration_min, pace_minpkm, avg_speed, calories, elevation_gained, difficulty, avg_heartrate)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;
        
        const values = [
            userId,
            distanceInKm,
            durationInMinutes,
            paceMinPerKm.toFixed(2),
            avgSpeedKmH.toFixed(2),
            parseInt(calories),
            parseInt(elevation),
            parseInt(difficulty),
            parseInt(avg_heartRate)
        ];

        const result = await pool.query(query, values);
        res.status(201).json({ 
            message: 'Futás sikeresen hozzáadva',
            run: result.rows[0]
        });

    } catch (error) {
        console.error('Hiba a futás mentésekor:', error);
        res.status(500).json({ 
            error: 'Szerver hiba történt a mentés során',
            details: error.message 
        });
    }
});

// Statikus fájlok kiszolgálása
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Szerver fut a ${PORT} porton`);
    console.log('API végpontok elérhetőek a /api prefix-szel');
});

