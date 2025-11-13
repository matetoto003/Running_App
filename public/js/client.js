console.log('client.js betöltve.'); // Segítség a hibakereséshez

// Profil menü kezelése
async function fetchProfileStats() {
    try {
        console.log('Fetching profile stats...'); // Debug log
        const response = await fetch('/api/profile-stats', {
            credentials: 'include'
        });
        const data = await response.json();
        console.log('Received profile stats:', data); // Debug log

        if (response.status === 401) {
            // Redirect to login page if not authenticated
            window.location.href = '/login.html';
            return;
        }

        if (response.ok) {
            // Update total runs
            const totalRuns = data.totalRuns;
            console.log('Setting total runs to:', totalRuns); // Debug log
            const totalRunsElements = document.querySelectorAll('#totalRuns');
            totalRunsElements.forEach(element => {
                element.textContent = totalRuns;
                console.log('Updated totalRuns element:', element.id); // Debug log
            });

            // Update total distance
            const totalDistance = data.totalDistance;
            console.log('Setting total distance to:', totalDistance); // Debug log
            const totalDistanceElements = document.querySelectorAll('#totalDistance');
            totalDistanceElements.forEach(element => {
                element.textContent = `${totalDistance} km`;
                console.log('Updated totalDistance element:', element.id); // Debug log
            });

            // Update dashboard total distance if it exists
            const dashboardTotalDistance = document.getElementById('dashboardTotalDistance');
            if (dashboardTotalDistance) {
                dashboardTotalDistance.textContent = `${totalDistance} km`;
                console.log('Updated dashboard total distance'); // Debug log
            }
        }
    } catch (error) {
        console.error('Error fetching profile stats:', error);
    }
}

function setupProfileMenu() {
    const profileButton = document.getElementById('profileButton');
    const profileMenu = document.getElementById('profileMenu');
    const logoutButton = document.getElementById('logoutButton');
    const usernameSpans = document.getElementsByClassName('username');
    
    // Betöltéskor állítsuk be a profile szöveget és a felhasználónevet a menüben
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Set the button text to "Profile"
    if (profileButton) {
        profileButton.innerHTML = 'Profile ▼';
    }
    
    // Set username in spans
    if (user && user.username) {
        Array.from(usernameSpans).forEach(span => {
            span.textContent = user.username;
        });
    }

    if (profileButton && profileMenu) {
        // Load stats immediately when page loads
        fetchProfileStats();
        
        // Profil menü megjelenítése/elrejtése
        profileButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle('active');
            
            // Refresh stats when menu is opened
            if (profileMenu.classList.contains('active')) {
                await fetchProfileStats();
            }
        });

        // Settings gomb kezelése
        const settingsButton = document.getElementById('settingsButton');
        if (settingsButton) {
            settingsButton.addEventListener('click', (e) => {
                e.preventDefault();
                // TODO: Implement settings functionality
                console.log('Settings clicked');
            });
        }

        // Kattintás kezelése a dokumentumon
        document.addEventListener('click', (e) => {
            if (!profileMenu.contains(e.target) && !profileButton.contains(e.target)) {
                profileMenu.classList.remove('active');
            }
        });
    }

    if (logoutButton) {
        // Kijelentkezés kezelése
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'include'
                });

                if (response.ok) {
                    localStorage.removeItem('user'); // Felhasználói adatok törlése
                    window.location.href = 'login.html'; // Átirányítás a bejelentkezési oldalra
                } else {
                    console.error('Kijelentkezési hiba');
                }
            } catch (error) {
                console.error('Hiba történt a kijelentkezés során:', error);
            }
        });
    }
}

// Utolsó futás adatainak lekérése és megjelenítése
async function fetchLastRun() {
    const lastRunInfo = document.getElementById('lastRunInfo');
    if (!lastRunInfo) return; // Ha nem az index oldalon vagyunk

    try {
        const response = await fetch('/api/last-run', {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.message === 'No runs yet') {
            lastRunInfo.innerHTML = '<p>You haven\'t logged any runs yet. <a href="add-new-run.html">Add your first run!</a></p>';
        } else {
            // Az időt óra:perc formátumba alakítjuk
            const hours = Math.floor(data.duration_min / 60);
            const minutes = Math.round(data.duration_min % 60);
            const duration = hours > 0 ? 
                `${hours}h ${minutes}m` : 
                `${minutes}m`;

            lastRunInfo.innerHTML = `
                <p>Your last run was on <strong>${data.run_date}</strong></p>
                <p>Distance: <strong>${data.distance_km} km</strong></p>
                <p>Duration: <strong>${duration}</strong></p>
                <p>Difficulty: <strong>${data.difficulty}/10</strong></p>
            `;
        }
    } catch (error) {
        console.error('Hiba az utolsó futás lekérésekor:', error);
        lastRunInfo.innerHTML = '<p>Error loading last run data.</p>';
    }
}

// Oldal betöltésekor inicializáljuk a profil menüt és lekérjük az utolsó futást
document.addEventListener('DOMContentLoaded', () => {
    setupProfileMenu();
    fetchLastRun();
});

// Regisztráció
if (document.getElementById('registerForm')) {
    console.log('Regisztrációs űrlap megtalálva.');
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault(); // Megakadályozza az oldal újratöltését

        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const gender = document.getElementById('gender').value;
        const birth_year = document.getElementById('birth_year').value;

        const messageDiv = document.getElementById('message');

        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, gender, birth_year })
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.className = 'message success';
                messageDiv.textContent = 'Sikeres regisztráció! Átirányítás...';
                setTimeout(() => window.location.href = 'login.html', 2000);
            } else {
                messageDiv.className = 'message error';
                messageDiv.textContent = data.error;
            }
        } catch (error) {
            messageDiv.className = 'message error';
            messageDiv.textContent = 'Kapcsolódási hiba';
        }
    });
}

// Bejelentkezés
if (document.getElementById('loginForm')) {
    console.log('Bejelentkezési űrlap megtalálva.');
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const messageDiv = document.getElementById('message');

        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Fontos a session cookie-k miatt!
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.className = 'message success';
                messageDiv.textContent = 'Sikeres bejelentkezés!';
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Átirányítás a FŐOLDALRA (index.html)
                setTimeout(() => window.location.href = 'index.html', 1000); 
            } else {
                messageDiv.className = 'message error';
                messageDiv.textContent = data.error;
            }
        } catch (error) {
            messageDiv.className = 'message error';
            messageDiv.textContent = 'Kapcsolódási hiba';
        }
    });
}

// Új futás hozzáadása
if (document.getElementById('addNewRunForm')) {
    console.log('Új futás űrlap megtalálva.');
    document.getElementById('addNewRunForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            distance: document.getElementById('distance').value,
            minutes: document.getElementById('minutes').value,
            difficulty: document.getElementById('difficulty').value,
            avg_heartRate: document.getElementById('avg_heartRate').value,
            calories: document.getElementById('calories').value,
            elevation: document.getElementById('elevation').value.replace('m', ''), // Eltávolítjuk az 'm' betűt, ha van
            runDate: document.getElementById('runDate') ? document.getElementById('runDate').value : null // Add date if available
        };

        const responseMessage = document.getElementById('responseMessage');
        const submitButton = document.querySelector('.submit-button');
        
        try {
            submitButton.disabled = true;
            submitButton.textContent = 'Mentés...';
            
            console.log('Küldendő adatok:', formData);
            const response = await fetch('http://localhost:3000/api/add-run', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include', // Fontos a session cookie-k miatt!
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                responseMessage.className = 'form-message success';
                responseMessage.textContent = 'Futás sikeresen mentve! Átirányítás...';
                setTimeout(() => window.location.href = 'dashboards.html', 1500);
            } else {
                responseMessage.className = 'form-message error';
                responseMessage.textContent = data.error || 'Hiba történt a mentés során';
                submitButton.disabled = false;
                submitButton.textContent = 'Save Run';
            }
        } catch (error) {
            console.error('Hiba:', error);
            responseMessage.className = 'form-message error';
            responseMessage.textContent = 'Kapcsolódási hiba történt';
            submitButton.disabled = false;
            submitButton.textContent = 'Save Run';
        }
    });
}