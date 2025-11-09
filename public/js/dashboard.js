// Dashboard kezelése
let currentPeriod = 'month';
let mainChart = null;

// Címek az időszakokhoz
const periodTitles = {
    'week': 'this week',
    'month': 'this month',
    'year': 'this year'
};

// Statisztikák lekérése és megjelenítése
async function fetchAndDisplayStats(period) {
    try {
        console.log('Fetching stats for period:', period); // Debug log
        
        // Időszak paraméterek beállítása
        const now = new Date();
        let startDate, endDate;
        
        if (period === 'week') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6);
            endDate = now;
        } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        }

        const response = await fetch(`/api/dashboard-stats?period=${period}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, {
            credentials: 'include'
        });
        const data = await response.json();
        console.log('Received dashboard stats:', data); // Debug log

        if (response.ok) {
            updateStatCards(data.stats);
            updateCharts(data.timeSeries || [], period);
            // Cím frissítése
            document.getElementById('periodTitle').textContent = periodTitles[period];
        } else {
            console.error('Hiba a statisztikák lekérésekor:', data.error);
        }
    } catch (error) {
        console.error('Hiba:', error);
    }
}

// Statisztika kártyák frissítése
function updateStatCards(stats) {
    console.log('Updating stats with:', stats); // Debug log

    // Elevation gained
    document.querySelector('.stat-card:nth-child(1) .stat-value').textContent = 
        `${parseFloat(stats.total_elevation || 0)}m`;

    // Hardest run
    document.querySelector('.stat-card:nth-child(2) .stat-value').textContent = 
        `${parseFloat(stats.max_difficulty || 0)}/10`;

    // Average heart rate
    document.querySelector('.stat-card:nth-child(3) .stat-value').textContent = 
        `${parseFloat(stats.avg_heart_rate || 0)} bpm`;

    // Update total distance with proper formatting
    const totalDistance = parseFloat(stats.total_distance || 0);
    const formattedDistance = totalDistance.toFixed(1);
    document.getElementById('dashboardTotalDistance').textContent = `${formattedDistance} km`;

    // Also update the profile stats to keep them in sync
    const totalDistanceElements = document.querySelectorAll('#totalDistance');
    totalDistanceElements.forEach(element => {
        element.textContent = `${formattedDistance} km`;
    });

    // Total Calories with proper formatting
    const totalCalories = parseInt(stats.total_calories || 0);
    document.getElementById('totalCalories').textContent = totalCalories.toLocaleString();

    // Total hours
    const hours = Math.floor((parseFloat(stats.total_duration || 0)) / 60);
    const minutes = Math.round((parseFloat(stats.total_duration || 0)) % 60);
    document.getElementById('totalHours').textContent = `${hours}h ${minutes}m`;
    
    // Also update total runs to keep them in sync
    const totalRuns = parseInt(stats.total_runs || 0);
    const totalRunsElements = document.querySelectorAll('#totalRuns');
    totalRunsElements.forEach(element => {
        element.textContent = totalRuns.toString();
    });
}

// Grafikonok frissítése
function updateCharts(timeSeriesData, period) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    // Ha már létezik grafikon, megsemmisítjük
    if (mainChart) {
        mainChart.destroy();
    }

    // Adatok előkészítése az időszak alapján
    let labels = [];
    let dataMap = new Map();
    
    // Időszak alapján előállítjuk az összes lehetséges dátumot
    const now = new Date();
    if (period === 'week') {
        // Az elmúlt 7 nap
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const label = date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
            labels.push(label);
            dataMap.set(label, 0);
        }
    } else if (period === 'month') {
        // A hónap összes napja
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= lastDay; i++) {
            const date = new Date(now.getFullYear(), now.getMonth(), i);
            const label = date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
            labels.push(label);
            dataMap.set(label, 0);
        }
    } else if (period === 'year') {
        // Az év összes hónapja
        for (let i = 0; i < 12; i++) {
            const date = new Date(now.getFullYear(), i, 1);
            const label = date.toLocaleDateString('hu-HU', { month: 'long' });
            labels.push(label);
            dataMap.set(label, 0);
        }
    }

    // A kapott adatok beillesztése a megfelelő helyekre
    timeSeriesData.forEach(item => {
        if (dataMap.has(item.label)) {
            dataMap.set(item.label, parseFloat(item.distance) || 0);
        }
    });

    // Adatok kinyerése a Map-ből a labels sorrendjében
    const distances = labels.map(label => dataMap.get(label));

    // Grafikon konfigurálása az időszaknak megfelelően
    const config = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Distance (km)',
                data: distances,
                backgroundColor: 'rgba(24, 144, 255, 0.6)',
                borderColor: 'rgba(24, 144, 255, 1)',
                borderWidth: 1,
                borderRadius: 4,
                maxBarThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#333',
                    bodyColor: '#666',
                    borderColor: 'rgba(24, 144, 255, 0.3)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `${context.parsed.y.toFixed(1)} km`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        padding: 10,
                        color: '#666',
                        callback: function(value) {
                            return value + ' km';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Distance (km)',
                        color: '#666',
                        padding: {top: 10, bottom: 10}
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        padding: 5,
                        color: '#666',
                        maxRotation: period === 'month' ? 45 : 0,
                        autoSkip: period === 'month' ? false : true,
                        font: {
                            size: period === 'month' ? 10 : 12
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    };

    // Grafikon létrehozása
    mainChart = new Chart(ctx, config);
}

// Időszak választó gombok kezelése
document.addEventListener('DOMContentLoaded', () => {
    const periodButtons = document.querySelectorAll('.period-button');
    
    periodButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Aktív gomb stílus kezelése
            periodButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Új adatok lekérése
            currentPeriod = button.dataset.period;
            fetchAndDisplayStats(currentPeriod);
        });
    });

    // Kezdeti adatok betöltése
    fetchAndDisplayStats(currentPeriod);
});