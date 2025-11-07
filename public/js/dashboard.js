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
        const response = await fetch(`/api/dashboard-stats?period=${period}`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (response.ok) {
            updateStatCards(data.stats);
            updateCharts(data.timeSeries, period);
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
    // Elevation gained
    document.querySelector('.stat-card:nth-child(1) .stat-value').textContent = 
        `${stats.total_elevation || 0}m`;

    // Hardest run
    document.querySelector('.stat-card:nth-child(2) .stat-value').textContent = 
        `${stats.max_difficulty || 0}/10`;

    // Average heart rate
    document.querySelector('.stat-card:nth-child(3) .stat-value').textContent = 
        `${stats.avg_heart_rate || 0} bpm`;

    // Calories burnt
    document.querySelector('.additional-stats-cards .stat-card:nth-child(1) .stat-value').textContent = 
        stats.total_calories || '0';

    // Total hours
    const hours = Math.floor((stats.total_duration || 0) / 60);
    const minutes = Math.round((stats.total_duration || 0) % 60);
    document.querySelector('.additional-stats-cards .stat-card:nth-child(2) .stat-value').textContent = 
        `${hours}h ${minutes}m`;
}

// Grafikonok frissítése
function updateCharts(timeSeriesData, period) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    // Ha már létezik grafikon, megsemmisítjük
    if (mainChart) {
        mainChart.destroy();
    }

    // Adatok előkészítése
    const labels = timeSeriesData.map(item => item.label);
    const distances = timeSeriesData.map(item => parseFloat(item.distance) || 0);

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
                borderRadius: 4
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
                    callbacks: {
                        label: (context) => `${context.parsed.y.toFixed(1)} km`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Distance (km)'
                    }
                }
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