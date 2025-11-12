// Dashboard kezelése
let currentPeriod = 'month';
let mainChart = null;

// Címek az időszakokhoz
const periodTitles = {
    'week': 'this week',
    'month': 'this month',
    'year': 'this year'
};

// Időszakok címkéinek generálása
function generateLabels(period) {
    if (period === 'week') {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days;
    } else if (period === 'month') {
        return Array.from({length: 31}, (_, i) => (i + 1).toString());
    } else if (period === 'year') {
        return ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'];
    }
    return [];
}

// Statisztikák lekérése és megjelenítése
async function fetchAndDisplayStats(period) {
    try {
        console.log('Fetching stats for period:', period);
        const response = await fetch(`/api/dashboard-stats?period=${period}&t=${Date.now()}`, {
            credentials: 'include',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        const data = await response.json();

        if (response.ok) {
            console.log('Raw stats data:', data.stats);
            updateStatCards(data.stats);
            updateCharts(data.timeSeries || [], period);
            // Cím frissítése
            document.getElementById('periodTitle').textContent = periodTitles[period];
        } else {
            console.error('Hiba a statisztikák lekérésekor:', data.error);
            if (response.status === 401) {
                // Redirect to login page if not authenticated
                window.location.href = '/login.html';
            }
        }
    } catch (error) {
        console.error('Hiba:', error);
    }
}

// Statisztika kártyák frissítése
function updateStatCards(stats) {
    console.log('Updating stats with:', stats); // Debug log

    const statsCards = document.querySelector('.stats-cards');
    if (!statsCards) {
        console.warn('Could not find .stats-cards container');
        return;
    }

    // Get all stat cards
    const statCards = Array.from(statsCards.children);

    // Elevation gained
    const elevationValue = parseInt(stats.total_elevation || 0);
    console.log('Elevation value:', elevationValue);
    const elevationCard = statCards[0];
    const elevationValueEl = elevationCard.querySelector('.stat-value');
    if (elevationValueEl) elevationValueEl.textContent = `${elevationValue}m`;
    const elevationSmall = elevationCard.querySelector('small') || elevationCard.appendChild(document.createElement('small'));
    elevationSmall.textContent = `+${elevationValue}m to last month`;

    // Hardest run
    const hardestRunValue = parseInt(stats.max_difficulty || 0);
    console.log('Hardest run value:', hardestRunValue, 'Date:', stats.hardest_run_date);
    const hardestRunCard = statCards[1];
    const hardestValueEl = hardestRunCard.querySelector('.stat-value');
    if (hardestValueEl) hardestValueEl.textContent = `${hardestRunValue}/10`;
    const hardestSmall = hardestRunCard.querySelector('small') || hardestRunCard.appendChild(document.createElement('small'));
    if (stats.hardest_run_date && hardestRunValue > 0) {
        hardestSmall.textContent = stats.hardest_run_date;
    } else {
        hardestSmall.textContent = 'No runs in this period';
    }

    // Total runs in this period
    const totalRunsValue = parseInt(stats.total_runs || 0);
    const runsCard = statCards[2];
    const runsValueEl = runsCard.querySelector('.stat-value');
    if (runsValueEl) {
        runsValueEl.textContent = `${totalRunsValue}`;
    }
    // Update small text to show current period
    const runSmall = runsCard.querySelector('small') || runsCard.appendChild(document.createElement('small'));
    runSmall.textContent = `in ${periodTitles[currentPeriod]}`;

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
    
    // Also update total runs to keep them in sync (profile/header)
    const totalRunsProfileValue = parseInt(stats.total_runs || 0);
    const totalRunsElements = document.querySelectorAll('#totalRuns');
    totalRunsElements.forEach(element => {
        element.textContent = totalRunsProfileValue.toString();
    });
}

// Grafikonok frissítése
function updateCharts(timeSeriesData, period) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    // Ha már létezik grafikon, megsemmisítjük
    if (mainChart) {
        mainChart.destroy();
    }

    // Generáljuk az időszaknak megfelelő címkéket
    const periodLabels = generateLabels(period);
    
    // Adatok előkészítése egy üres tömbbel minden lehetséges napra/hónapra
    const distances = new Array(periodLabels.length).fill(0);
    
    // A meglévő adatok beillesztése a megfelelő helyre
    timeSeriesData.forEach(item => {
        let index;
        if (period === 'week') {
            // A hét napjainak indexe (0-6)
            const d = new Date(item.date);
            index = d.getDay();
        } else if (period === 'month') {
            // A hónap napjának indexe (1-31 -> 0-30)
            const d = new Date(item.date);
            index = d.getDate() - 1;
        } else if (period === 'year') {
            // A hónap indexe (1-12 -> 0-11)
            const d = new Date(item.date);
            index = d.getMonth();
        }
        if (index >= 0 && index < distances.length) {
            distances[index] = parseFloat(item.distance) || 0;
        }
    });

    // Grafikon konfigurálása az időszaknak megfelelően
    // Plugin to draw data labels on bars for values > 0
    const dataLabelPlugin = {
        id: 'datalabelsOnBars',
        afterDatasetsDraw(chart) {
            const { ctx } = chart;
            chart.data.datasets.forEach((dataset, dsIndex) => {
                const meta = chart.getDatasetMeta(dsIndex);
                meta.data.forEach((bar, index) => {
                    const value = dataset.data[index];
                    if (value && value > 0) {
                        const x = bar.x;
                        const y = bar.y;
                        const text = `${value.toFixed(1)} km`;
                        ctx.save();
                        // stroke for contrast
                        ctx.font = '12px system-ui, Arial, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                        ctx.strokeText(text, x, y - 6);
                        ctx.fillStyle = 'rgba(0,0,0,0.85)';
                        ctx.fillText(text, x, y - 6);
                        ctx.restore();
                    }
                });
            });
        }
    };

    const config = {
        type: 'bar',
        data: {
            labels: periodLabels,
            datasets: [{
                label: 'Distance (km)',
                data: distances,
                // color each bar differently depending on whether there was a run
                backgroundColor: distances.map(d => d > 0 ? 'rgba(24, 144, 255, 0.9)' : 'rgba(200,200,200,0.25)'),
                borderColor: distances.map(d => d > 0 ? 'rgba(24, 144, 255, 1)' : 'rgba(200,200,200,0.5)'),
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
                        text: 'Distance (km)'
                    }
                }
            }
        }
        ,
        // attach our custom plugin so it runs for this chart instance
        plugins: [dataLabelPlugin]
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