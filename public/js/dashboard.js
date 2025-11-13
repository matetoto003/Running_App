// Dashboard kezelése
let currentPeriod = 'month';
let mainChart = null;
let difficultyChart = null;

// Címek az időszakokhoz
const periodTitles = {
    'week': 'this week',
    'month': 'this month',
    'year': 'this year'
};

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
            console.log('Difficulty data:', data.difficulty); // Log a kördiagram adataihoz
            updateStatCards(data.stats);
            updateCharts(data.timeSeries || [], period);
            updateDifficultyChart(data.difficulty || []); // Hívás a kördiagram frissítésére
            document.getElementById('periodTitle').textContent = periodTitles[period];
        } else {
            console.error('Hiba a statisztikák lekérésekor:', data.error);
            if (response.status === 401) {
                window.location.href = '/login.html';
            }
        }
    } catch (error) {
        console.error('Hiba:', error);
    }
}

// Statisztika kártyák frissítése
function updateStatCards(stats) {
    const statsCardsContainer = document.querySelector('.stats-cards');
    if (!statsCardsContainer) {
        console.warn('Could not find .stats-cards container');
        return;
    }

    // Csak a '.stat-card' osztályú elemeket kérjük le
    const statCards = Array.from(statsCardsContainer.querySelectorAll('.stat-card'));

    // Elevation gained (Feltételezi, hogy ez az első .stat-card)
    const elevationValue = parseInt(stats.total_elevation || 0);
    const elevationCard = statCards[0];
    if (elevationCard) {
        const elevationValueEl = elevationCard.querySelector('.stat-value');
        if (elevationValueEl) elevationValueEl.textContent = `${elevationValue}m`;
        const elevationSmall = elevationCard.querySelector('small') || elevationCard.appendChild(document.createElement('small'));
        elevationSmall.textContent = `+${elevationValue}m to last month`;
    }

    // Hardest run - now it's in the right-column, find it directly
    const hardestRunValue = parseInt(stats.max_difficulty || 0);
    const hardestRunCard = document.querySelector('.right-column .stat-card');
    if (hardestRunCard) {
        const hardestValueEl = hardestRunCard.querySelector('.stat-value');
        if (hardestValueEl) hardestValueEl.textContent = `${hardestRunValue}/10`;
        const hardestSmall = hardestRunCard.querySelector('small') || hardestRunCard.appendChild(document.createElement('small'));
        if (stats.hardest_run_date && hardestRunValue > 0) {
            hardestSmall.textContent = new Date(stats.hardest_run_date).toLocaleDateString('hu-HU');
        } else {
            hardestSmall.textContent = 'No runs in this period';
        }
    }    // A többi kártyát ID alapján frissíted, ami sokkal jobb és stabilabb
    const totalDistance = parseFloat(stats.total_distance || 0);
    const formattedDistance = totalDistance.toFixed(1);
    document.getElementById('dashboardTotalDistance').textContent = `${formattedDistance} km`;
    const totalDistanceElements = document.querySelectorAll('#totalDistance');
    totalDistanceElements.forEach(element => {
        element.textContent = `${formattedDistance} km`;
    });

    const totalCalories = parseInt(stats.total_calories || 0);
    document.getElementById('totalCalories').textContent = totalCalories.toLocaleString();

    const hours = Math.floor((parseFloat(stats.total_duration || 0)) / 60);
    const minutes = Math.round((parseFloat(stats.total_duration || 0)) % 60);
    document.getElementById('totalHours').textContent = `${hours}h ${minutes}m`;
    
    const avgHeartRate = parseInt(stats.avg_heart_rate || 0);
    const avgHeartRateEl = document.getElementById('avgHeartRate');
    if (avgHeartRateEl) {
        avgHeartRateEl.textContent = avgHeartRate > 0 ? `${avgHeartRate} bpm` : '0 bpm';
    }
    
    const avgPaceMinutes = parseFloat(stats.avg_pace || 0);
    const avgTempoEl = document.getElementById('avgTempo');
    if (avgTempoEl) {
        if (avgPaceMinutes > 0) {
            const minutes = Math.floor(avgPaceMinutes);
            const seconds = Math.round((avgPaceMinutes - minutes) * 60);
            const formattedTempo = `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
            avgTempoEl.textContent = formattedTempo;
        } else {
            avgTempoEl.textContent = '0:00 min/km';
        }
    }
    
    const totalRunsProfileValue = parseInt(stats.total_runs || 0);
    const totalRunsElements = document.querySelectorAll('#totalRuns');
    totalRunsElements.forEach(element => {
        element.textContent = totalRunsProfileValue.toString();
    });
}

// Oszlopdiagram (Bar Chart) frissítése
function updateCharts(timeSeriesData, period) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (mainChart) {
        mainChart.destroy();
    }

    // A server.js már a teljes, nullákkal kitöltött listát küldi,
    // így a kliens oldali 'generateLabels' felesleges.
    const labels = timeSeriesData.map(item => item.label.trim());
    const distances = timeSeriesData.map(item => parseFloat(item.distance) || 0);

    // Plugin a címkékhez
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

    // JAVÍTÁS: A config és a new Chart visszakerült a függvénybe
    const config = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Distance (km)',
                data: distances,
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
        },
        plugins: [dataLabelPlugin]
    };

    mainChart = new Chart(ctx, config);
} // <-- ITT ZÁRÓDIK AZ updateCharts FÜGGVÉNY


// Kördiagram (Pie Chart) frissítése
function updateDifficultyChart(difficultyData) {
    const ctx = document.getElementById('difficultyPieChart').getContext('2d');
    if (!ctx) return; // Ha a canvas nem létezik, ne csináljon semmit

    if (difficultyChart) {
        difficultyChart.destroy();
    }

    // Ha nincsenek adatok, ne csináljunk semmit
    if (!difficultyData || difficultyData.length === 0) {
        console.log('Nincs adat a kördiagramhoz.');
        return; 
    }

    const labels = difficultyData.map(item => `Difficulty ${item.difficulty}/10`);
    const counts = difficultyData.map(item => item.count);
    const backgroundColors = [
        '#d90429', // 10
        '#ef233c', // 9
        '#fb5607', // 8
        '#fca311', // 7
        '#ffc300', // 6
        '#70e000', // 5
        '#38b000', // 4
        '#008000', // 3
        '#0077b6', // 2
        '#023e8a'  // 1
    ];

    difficultyChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Run Counts',
                data: counts,
                backgroundColor: backgroundColors.slice(0, counts.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
return `${label}: ${value} runs`;
                        }
                    }
                }
            }
        }
    });
}


// Időszak választó gombok kezelése
document.addEventListener('DOMContentLoaded', () => {
    const periodButtons = document.querySelectorAll('.period-button');
    
    periodButtons.forEach(button => {
        button.addEventListener('click', () => {
            periodButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentPeriod = button.dataset.period;
            fetchAndDisplayStats(currentPeriod);
        });
    });

    // Kezdeti adatok betöltése
    fetchAndDisplayStats(currentPeriod);
});