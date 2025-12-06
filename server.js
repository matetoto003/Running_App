const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pool = require('./db');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Level system definition
const LEVELS = {
    ROOKIE: { min: 0, max: 299, name: 'Rookie', color: '#007bff' },
    BEGINNER: { min: 300, max: 499, name: 'Beginner', color: '#28a745' },
    ADVANCED: { min: 500, max: 999, name: 'Advanced', color: '#ffc107' },
    SEMI_PRO: { min: 1000, max: 1999, name: 'Semi Pro', color: '#fd7e14' },
    PRO: { min: 2000, max: 4999, name: 'Pro', color: '#dc3545' },
    ATHLETE: { min: 5000, max: 9999, name: 'Athlete', color: '#6f42c1' },
    GOAT: { min: 10000, max: Infinity, name: 'GOAT', color: '#e91e63' }
};

// Get user level based on total km
function getUserLevel(totalKm) {
    const kmValue = parseFloat(totalKm) || 0;
    for (const level of Object.values(LEVELS)) {
        if (kmValue >= level.min && kmValue <= level.max) {
            return {
                level: level.name,
                color: level.color,
                minKm: level.min,
                maxKm: level.max,
                progressPercentage: level.max === Infinity ? 100 : Math.round(((kmValue - level.min) / (level.max - level.min + 1)) * 100)
            };
        }
    }
    return LEVELS.ROOKIE;
}

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
        user: req.session.userId ? 'Logged in' : 'Not logged in'
    });
});

// Registration endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, gender, birth_year } = req.body;

        // Validation
        if (!username || !email || !password || !gender || !birth_year) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const userExists = await pool.query(
            'SELECT * FROM public.users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Hash password (10 salt rounds)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save user
        const newUser = await pool.query(
            'INSERT INTO public.users (username, email, password_hash, gender, birth_year) VALUES ($1, $2, $3, $4, $5) RETURNING user_id, username, email, gender, birth_year',
            [username, email, hashedPassword, gender, birth_year]
        );

        res.status(201).json({ 
            message: 'Registration successful',
            user: newUser.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Search for user
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = result.rows[0];

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Set session
        req.session.userId = user.user_id;
        req.session.username = user.username;
        
        // Save session
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Session save error' });
            }
            
            console.log('Session set:', req.session);
            res.json({ 
                message: 'Login successful',
                user: { 
                    id: user.user_id, 
                    username: user.username, 
                    email: user.email 
                }
            });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout error' });
        }
        res.json({ message: 'Logout successful' });
    });
});

// Authentication check middleware
const requireAuth = (req, res, next) => {
    console.log('Session state:', req.session);
    if (!req.session.userId) {
        console.log('Not logged in: session.userId missing');
        return res.status(401).json({ error: 'You are not logged in' });
    }
    console.log('User identified:', req.session.userId);
    next();
};

// Protected route - current user data
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, created_at FROM users WHERE id = $1',
            [req.session.userId]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get dashboard statistics
app.get('/api/dashboard-stats', requireAuth, async (req, res) => {
    try {
        const { period, date } = req.query;
        
        // Parse the date parameter if provided, otherwise use today
        let targetDate = new Date();
        if (date) {
            targetDate = new Date(date + 'T00:00:00Z');
        }
        
        const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
        let dateFilter;
        
        switch(period) {
            case 'week':
                // ISO week: week starts on Monday (day 1 of ISO week)
                // getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
                // We want the Monday of the week containing targetDate
                const ms = targetDate.getTime();
                const msPerDay = 86400000;
                const dayOfWeek = targetDate.getDay();
                // Calculate milliseconds to previous Monday
                const mondayMs = ms - ((dayOfWeek + 6) % 7) * msPerDay;
                const mondayDate = new Date(mondayMs);
                
                const weekStartStr = mondayDate.toISOString().split('T')[0];
                const sundayDate = new Date(mondayMs + 6 * msPerDay);
                const weekEndStr = sundayDate.toISOString().split('T')[0];
                
                // For dateFilter, we need Monday to next Monday (exclusive)
                const nextMondayDate = new Date(mondayMs + 7 * msPerDay);
                const nextMondayStr = nextMondayDate.toISOString().split('T')[0];
                
                dateFilter = `created_at >= '${weekStartStr}'::date AND created_at < '${nextMondayStr}'::date`;
                break;
            case 'month':
                // Get the start and end of the month for the target date
                const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
                const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
                dateFilter = `created_at >= '${startOfMonth.toISOString().split('T')[0]}'::date AND created_at < '${endOfMonth.toISOString().split('T')[0]}'::date`;
                break;
            case 'year':
                // Get the start and end of the year for the target date
                const startOfYear = new Date(targetDate.getFullYear(), 0, 1);
                const endOfYear = new Date(targetDate.getFullYear() + 1, 0, 1);
                dateFilter = `created_at >= '${startOfYear.toISOString().split('T')[0]}'::date AND created_at < '${endOfYear.toISOString().split('T')[0]}'::date`;
                break;
        }
        console.log('Period:', period, 'Date:', dateStr);
        console.log('Date filter:', dateFilter);

        // Get aggregated statistics
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
                END as avg_pace,
                (SELECT distance_km FROM runs WHERE user_id = $1 AND ${dateFilter} ORDER BY distance_km DESC, created_at DESC LIMIT 1) as longest_distance,
                (SELECT created_at FROM runs WHERE user_id = $1 AND ${dateFilter} ORDER BY distance_km DESC, created_at DESC LIMIT 1) as longest_distance_date,
                (SELECT duration_min FROM runs WHERE user_id = $1 AND ${dateFilter} ORDER BY duration_min DESC, created_at DESC LIMIT 1) as longest_duration,
                (SELECT created_at FROM runs WHERE user_id = $1 AND ${dateFilter} ORDER BY duration_min DESC, created_at DESC LIMIT 1) as longest_duration_date,
                (SELECT pace_minpkm FROM runs WHERE user_id = $1 AND ${dateFilter} ORDER BY pace_minpkm ASC, created_at DESC LIMIT 1) as fastest_pace,
                (SELECT created_at FROM runs WHERE user_id = $1 AND ${dateFilter} ORDER BY pace_minpkm ASC, created_at DESC LIMIT 1) as fastest_pace_date,
                (SELECT calories FROM runs WHERE user_id = $1 AND ${dateFilter} ORDER BY calories DESC, created_at DESC LIMIT 1) as max_calories,
                (SELECT created_at FROM runs WHERE user_id = $1 AND ${dateFilter} ORDER BY calories DESC, created_at DESC LIMIT 1) as max_calories_date,
                (SELECT elevation_gained FROM runs WHERE user_id = $1 AND ${dateFilter} ORDER BY elevation_gained DESC, created_at DESC LIMIT 1) as max_elevation,
                (SELECT created_at FROM runs WHERE user_id = $1 AND ${dateFilter} ORDER BY elevation_gained DESC, created_at DESC LIMIT 1) as max_elevation_date
            FROM runs 
            WHERE user_id = $1 AND ${dateFilter}
        `;

        // Időszak specifikus lekérdezés a grafikonhoz
        let timeSeriesQuery;
        if (period === 'year') {
            const year = targetDate.getFullYear();
            const yearStartStr = `${year}-01-01`;
            const yearEndStr = `${year}-12-31`;
            timeSeriesQuery = `
                SELECT 
                    dt::date as date,
                    TRIM(TO_CHAR(dt, 'Month')) as label,
                    COALESCE(SUM(r.distance_km), 0) as distance,
                    COUNT(r.*) as runs
                FROM (
                    SELECT generate_series(
                        '${yearStartStr}'::date,
                        '${yearEndStr}'::date,
                        interval '1 month'
                    ) as dt
                ) dates
                LEFT JOIN runs r ON 
                    DATE_TRUNC('month', r.created_at)::date = dates.dt AND
                    r.user_id = $1
                GROUP BY dt
                ORDER BY dt
            `;
            console.log('Year query - Start:', yearStartStr, 'End:', yearEndStr);
        } else if (period === 'week') {
            // Same calculation as dateFilter
            const ms = targetDate.getTime();
            const msPerDay = 86400000;
            const dayOfWeek = targetDate.getDay();
            const mondayMs = ms - ((dayOfWeek + 6) % 7) * msPerDay;
            const mondayDate = new Date(mondayMs);
            
            // Use local date formatting to avoid timezone issues
            const year = mondayDate.getFullYear();
            const month = String(mondayDate.getMonth() + 1).padStart(2, '0');
            const day = String(mondayDate.getDate()).padStart(2, '0');
            const weekStartStr = `${year}-${month}-${day}`;
            
            const sundayDate = new Date(mondayMs + 6 * msPerDay);
            const sunYear = sundayDate.getFullYear();
            const sunMonth = String(sundayDate.getMonth() + 1).padStart(2, '0');
            const sunDay = String(sundayDate.getDate()).padStart(2, '0');
            const weekEndStr = `${sunYear}-${sunMonth}-${sunDay}`;
            
            timeSeriesQuery = `
                WITH week_dates AS (
                    SELECT generate_series(
                        '${weekStartStr}'::date,
                        '${weekEndStr}'::date,
                        INTERVAL '1 day'
                    ) AS date
                )
                SELECT 
                    wd.date::date as date,
                    TRIM(TO_CHAR(wd.date, 'Day')) as label,
                    COALESCE(ROUND(SUM(r.distance_km)::numeric, 1), 0) as distance,
                    COUNT(r.*) as runs,
                    ROUND(AVG(r.calories)::numeric, 0) as avg_calories,
                    ROUND(AVG(r.avg_heartRate)::numeric, 0) as avg_heart_rate
                FROM week_dates wd
                LEFT JOIN runs r ON DATE(r.created_at) = wd.date::date AND r.user_id = $1
                GROUP BY wd.date
                ORDER BY wd.date
            `;
            console.log('Week query - Start:', weekStartStr, 'End:', weekEndStr);
        } else {
            // Month view
            const year = targetDate.getFullYear();
            const month = targetDate.getMonth();
            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month + 1, 0); // Last day of the month
            
            const monthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const monthEndStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`;
            
            timeSeriesQuery = `
                WITH month_dates AS (
                    SELECT generate_series(
                        '${monthStartStr}'::date,
                        '${monthEndStr}'::date,
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

        // Send both the stats and timeSeries data in the response
        res.json({
            stats: stats.rows[0],
            timeSeries: timeSeries.rows,
            difficulty: difficulty.rows
        });

    } catch (error) {
        console.error('Error fetching dashboard statistics:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get last run
// Get profile statistics
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
        
        // Calculate user level
        const stats = result.rows[0];
        const userLevel = getUserLevel(stats.totalDistance);
        
        res.json({
            ...stats,
            level: userLevel.level,
            levelColor: userLevel.color,
            levelProgress: userLevel.progressPercentage
        });
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

// Fetch all runs for a user
app.get('/api/all-runs', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                CONCAT(created_at, '|', user_id) as id,
                distance_km, 
                duration_min, 
                difficulty,
                created_at,
                TO_CHAR(created_at, 'YYYY-MM-DD') as run_date
             FROM runs 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [req.session.userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Hiba az összes futás lekérésekor:', error);
        res.status(500).json({ error: 'Szerver hiba' });
    }
});

// Get user level and color
app.get('/api/user-level', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                COALESCE(ROUND(SUM(distance_km)::numeric, 1), 0) as "totalDistance"
             FROM runs 
             WHERE user_id = $1`,
            [req.session.userId]
        );

        const totalDistance = result.rows[0]?.totalDistance || 0;
        const userLevel = getUserLevel(totalDistance);
        
        res.json({
            level: userLevel.level,
            color: userLevel.color,
            totalDistance: totalDistance,
            minKm: userLevel.minKm,
            maxKm: userLevel.maxKm,
            progressPercentage: userLevel.progressPercentage
        });
    } catch (error) {
        console.error('Error fetching user level:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get runs by date
app.get('/api/runs', requireAuth, async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ error: 'Date parameter is required' });
        }
        
        const result = await pool.query(
            `SELECT 
                distance_km as distance,
                duration_min as duration,
                pace_minpkm as pace,
                difficulty,
                avg_heartRate as avg_heart_rate,
                calories,
                elevation_gained as elevation,
                TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as date
             FROM runs 
             WHERE user_id = $1 
             AND DATE(created_at) = $2::DATE
             ORDER BY created_at DESC`,
            [req.session.userId, date]
        );

        res.json({ runs: result.rows });
    } catch (error) {
        console.error('Hiba a futások lekérésekor:', error);
        res.status(500).json({ error: 'Szerver hiba' });
    }
});

// Change password endpoint
app.post('/api/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.session.userId;

        // Validate inputs
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        // Get user from database
        const userResult = await pool.query(
            'SELECT password_hash FROM users WHERE user_id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password in database
        await pool.query(
            'UPDATE users SET password_hash = $1 WHERE user_id = $2',
            [hashedPassword, userId]
        );

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Change Username Endpoint
app.post('/api/change-username', requireAuth, async (req, res) => {
    try {
        const { newUsername } = req.body;
        const userId = req.session.userId;

        // Validate inputs
        if (!newUsername) {
            return res.status(400).json({ error: 'New username is required' });
        }

        if (newUsername.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }

        // Check if username already exists
        const existingUser = await pool.query(
            'SELECT user_id FROM users WHERE username = $1 AND user_id != $2',
            [newUsername, userId]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        // Update username in database
        await pool.query(
            'UPDATE users SET username = $1 WHERE user_id = $2',
            [newUsername, userId]
        );

        // Update session username
        req.session.username = newUsername;

        res.json({ message: 'Username changed successfully', username: newUsername });
    } catch (error) {
        console.error('Error changing username:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add new run API endpoint
app.post('/api/add-run', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { distance, minutes, difficulty, calories, elevation, avg_heartRate, runDate } = req.body;

        // Idő átalakítása
        const timeParts = minutes.split(':');
        const durationInSeconds = (parseInt(timeParts[0], 10) * 60) + parseInt(timeParts[1], 10);
        const durationInMinutes = durationInSeconds / 60.0;
        
        // Sebesség számítások
        const distanceInKm = parseFloat(distance);
        const durationInHours = durationInMinutes / 60.0;
        const avgSpeedKmH = distanceInKm / durationInHours;
        const paceMinPerKm = durationInMinutes / distanceInKm;

        // Parse date if provided, otherwise use current date
        let createdAt = 'NOW()';
        if (runDate) {
            // Parse the date string (format: YYYY-MM-DD) and set to midnight of that day in local timezone
            createdAt = `'${runDate}T00:00:00'`;
        }

        const query = `
            INSERT INTO public.runs 
            (user_id, distance_km, duration_min, pace_minpkm, avg_speed, calories, elevation_gained, difficulty, avg_heartrate, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${createdAt})
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
            message: 'Run successfully added',
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

// Update run endpoint
app.put('/api/update-run/:runId', requireAuth, async (req, res) => {
    try {
        const { runId } = req.params;
        const { run_date, distance_km, duration_min, difficulty } = req.body;
        
        // Parse the composite ID (created_at|user_id)
        const [createdAtStr, userIdFromId] = runId.split('|');
        
        // Verify ownership
        if (parseInt(userIdFromId) !== req.session.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // Calculate pace
        const paceMinPerKm = distance_km > 0 ? duration_min / distance_km : 0;
        const durationInHours = duration_min / 60;
        const avgSpeedKmH = distance_km / durationInHours;
        
        const query = `
            UPDATE runs 
            SET distance_km = $1,
                duration_min = $2,
                pace_minpkm = $3,
                avg_speed = $4,
                difficulty = $5,
                created_at = $6
            WHERE created_at = $7 AND user_id = $8
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            distance_km,
            duration_min,
            paceMinPerKm.toFixed(2),
            avgSpeedKmH.toFixed(2),
            difficulty,
            run_date + 'T00:00:00',
            createdAtStr,
            req.session.userId
        ]);
        
        if (result.rows.length === 0) {
            return res.status(500).json({ error: 'Failed to update run' });
        }
        
        res.json({ 
            message: 'Run updated successfully',
            run: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating run:', error);
        res.status(500).json({ 
            error: 'Server error updating run',
            details: error.message 
        });
    }
});

// Delete run endpoint
app.delete('/api/delete-run/:runId', requireAuth, async (req, res) => {
    try {
        const { runId } = req.params;
        
        // Parse the composite ID (created_at|user_id)
        const [createdAtStr, userIdFromId] = runId.split('|');
        
        // Verify ownership
        if (parseInt(userIdFromId) !== req.session.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // Delete the run
        const result = await pool.query(
            'DELETE FROM runs WHERE created_at = $1 AND user_id = $2',
            [createdAtStr, req.session.userId]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Run not found' });
        }
        
        res.json({ message: 'Run deleted successfully' });
    } catch (error) {
        console.error('Error deleting run:', error);
        res.status(500).json({ 
            error: 'Server error deleting run',
            details: error.message 
        });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('API endpoints available at /api prefix');
});

