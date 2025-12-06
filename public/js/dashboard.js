// Dashboard kezelése
let currentPeriod = 'month';
let mainChart = null;
let difficultyChart = null;
let currentDate = new Date(); // Track current date for navigation

// Címek az időszakokhoz
const periodTitles = {
    'week': 'this week',
    'month': 'this month',
    'year': 'this year'
};

// Statisztikák lekérése és megjelenítése
async function fetchAndDisplayStats(period, date = new Date()) {
    try {
        const dateStr = date.toISOString().split('T')[0];
        const response = await fetch(`/api/dashboard-stats?period=${period}&date=${dateStr}&t=${Date.now()}`, {
            credentials: 'include',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        const data = await response.json();

        if (response.ok) {
            updateStatCards(data.stats);
            updateCharts(data.timeSeries || [], period);
            updateDifficultyChart(data.difficulty || []);
            updatePersonalBest(data.stats);
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
    }

    // Hardest run - now it's in the right-column, find it directly
    const hardestRunValue = parseInt(stats.max_difficulty || 0);
    const hardestRunCard = document.querySelector('.right-column .stat-card');
    if (hardestRunCard) {
        const hardestValueEl = hardestRunCard.querySelector('.stat-value');
        if (hardestValueEl) hardestValueEl.textContent = `${hardestRunValue}/10`;
    }    // A többi kártyát ID alapján frissíted, ami sokkal jobb és stabilabb
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

// Update Personal Best Section
function updatePersonalBest(stats) {
    const longestDistance = parseFloat(stats.longest_distance || 0);
    const longestDistanceEl = document.getElementById('longestDistance');
    if (longestDistanceEl) {
        longestDistanceEl.textContent = longestDistance > 0 ? `${longestDistance.toFixed(2)} km` : '0 km';
        const dateEl = document.getElementById('longestDistanceDate');
        if (dateEl) dateEl.textContent = stats.longest_distance_date ? new Date(stats.longest_distance_date).toLocaleDateString('en-US') : 'No runs yet';
    }

    const longestTime = parseInt(stats.longest_duration || 0);
    const longestTimeEl = document.getElementById('longestTime');
    if (longestTimeEl) {
        const hours = Math.floor(longestTime / 60);
        const minutes = longestTime % 60;
        longestTimeEl.textContent = longestTime > 0 ? `${hours}h ${minutes}m` : '0h 00m';
        const dateEl = document.getElementById('longestTimeDate');
        if (dateEl) dateEl.textContent = stats.longest_duration_date ? new Date(stats.longest_duration_date).toLocaleDateString('en-US') : 'No runs yet';
    }

    const fastestPace = parseFloat(stats.fastest_pace || 0);
    const fastestPaceEl = document.getElementById('fastestPace');
    if (fastestPaceEl) {
        if (fastestPace > 0) {
            const minutes = Math.floor(fastestPace);
            const seconds = Math.round((fastestPace - minutes) * 60);
            fastestPaceEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
        } else {
            fastestPaceEl.textContent = '0:00 min/km';
        }
        const dateEl = document.getElementById('fastestPaceDate');
        if (dateEl) dateEl.textContent = stats.fastest_pace_date ? new Date(stats.fastest_pace_date).toLocaleDateString('en-US') : 'No runs yet';
    }

    const mostCalories = parseInt(stats.max_calories || 0);
    const mostCaloriesEl = document.getElementById('mostCalories');
    if (mostCaloriesEl) {
        mostCaloriesEl.textContent = mostCalories > 0 ? `${mostCalories} kcal` : '0 kcal';
        const dateEl = document.getElementById('mostCaloriesDate');
        if (dateEl) dateEl.textContent = stats.max_calories_date ? new Date(stats.max_calories_date).toLocaleDateString('en-US') : 'No runs yet';
    }

    const biggestClimb = parseInt(stats.max_elevation || 0);
    const biggestClimbEl = document.getElementById('biggestClimb');
    if (biggestClimbEl) {
        biggestClimbEl.textContent = biggestClimb > 0 ? `${biggestClimb} m` : '0 m';
        const dateEl = document.getElementById('biggestClimbDate');
        if (dateEl) dateEl.textContent = stats.max_elevation_date ? new Date(stats.max_elevation_date).toLocaleDateString('en-US') : 'No runs yet';
    }
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
                        ctx.font = 'bold 13px system-ui, Arial, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        // Use level color to match the chart bars
                        const levelColor = getComputedStyle(document.documentElement).getPropertyValue('--level-color').trim();
                        ctx.fillStyle = levelColor;
                        ctx.fillText(text, x, y - 6);
                        ctx.restore();
                    }
                });
            });
        }
    };    // JAVÍTÁS: A config és a new Chart visszakerült a függvénybe
    const config = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Distance (km)',
                data: distances,
                backgroundColor: distances.map(d => d > 0 ? getComputedStyle(document.documentElement).getPropertyValue('--level-color').trim() + 'e5' : 'rgba(200,200,200,0.25)'),
                borderColor: distances.map(d => d > 0 ? getComputedStyle(document.documentElement).getPropertyValue('--level-color').trim() : 'rgba(200,200,200,0.5)'),
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
        '#023e8a'  // 1
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


// Modal Functions
function openRunDetailsModal(metric, dateStr) {
    const modal = document.getElementById('runDetailsModal');
    if (!modal) {
        console.error('Run details modal not found');
        return;
    }
    
    // Fetch runs from the specific date
    fetchRunDetailsForDate(dateStr, metric);
    
    modal.classList.add('show');
}

function closeRunDetailsModal() {
    const modal = document.getElementById('runDetailsModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

async function fetchRunDetailsForDate(dateStr, metric) {
    try {
        console.log('Fetching runs for date:', dateStr, 'metric:', metric);
        const response = await fetch(`/api/runs?date=${dateStr}&t=${Date.now()}`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        console.log('Response data:', data);
        if (response.ok && data.runs && data.runs.length > 0) {
            // Find the run that matches the metric
            const run = findRunByMetric(data.runs, metric);
            if (run) {
                populateRunDetails(run);
            } else {
                console.warn('No run found matching metric:', metric);
            }
        } else {
            console.warn('No runs found for date:', dateStr);
        }
    } catch (error) {
        console.error('Error fetching run details:', error);
    }
}

function findRunByMetric(runs, metric) {
    // Return the first run from the date (or could match by specific metric in future)
    if (runs.length > 0) {
        return runs[0];
    }
    return null;
}

function populateRunDetails(run) {
    // Populate modal with run details
    const detailDate = document.getElementById('detailDate');
    const detailDistance = document.getElementById('detailDistance');
    const detailDuration = document.getElementById('detailDuration');
    const detailPace = document.getElementById('detailPace');
    const detailDifficulty = document.getElementById('detailDifficulty');
    const detailHeartRate = document.getElementById('detailHeartRate');
    const detailCalories = document.getElementById('detailCalories');
    const detailElevation = document.getElementById('detailElevation');
    
    if (detailDate) detailDate.textContent = new Date(run.date).toLocaleDateString('en-US');
    if (detailDistance) detailDistance.textContent = `${parseFloat(run.distance).toFixed(2)} km`;
    
    if (detailDuration) {
        const minutes = parseInt(run.duration || 0);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        detailDuration.textContent = `${hours}h ${mins}m`;
    }
    
    if (detailPace) {
        const pace = parseFloat(run.pace || 0);
        const minutes = Math.floor(pace);
        const seconds = Math.round((pace - minutes) * 60);
        detailPace.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
    }
    
    if (detailDifficulty) detailDifficulty.textContent = run.difficulty || 'N/A';
    if (detailHeartRate) detailHeartRate.textContent = run.avg_heart_rate ? `${run.avg_heart_rate} bpm` : 'N/A';
    if (detailCalories) detailCalories.textContent = run.calories ? `${run.calories} kcal` : 'N/A';
    if (detailElevation) detailElevation.textContent = run.elevation ? `${run.elevation} m` : 'N/A';
}

// Date navigation functions
function navigateDate(direction) {
    if (currentPeriod === 'week') {
        currentDate.setDate(currentDate.getDate() + direction * 7);
    } else if (currentPeriod === 'month') {
        currentDate.setMonth(currentDate.getMonth() + direction);
    } else if (currentPeriod === 'year') {
        currentDate.setFullYear(currentDate.getFullYear() + direction);
    }
    updateDateDisplay();
    fetchAndDisplayStats(currentPeriod, currentDate);
}

function updateDateDisplay() {
    // No longer needed - display removed from UI
}

// Időszak választó gombok kezelése
document.addEventListener('DOMContentLoaded', () => {
    const periodButtons = document.querySelectorAll('.period-button');
    
    periodButtons.forEach(button => {
        button.addEventListener('click', () => {
            periodButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentPeriod = button.dataset.period;
            currentDate = new Date(); // Reset to today
            updateDateDisplay();
            fetchAndDisplayStats(currentPeriod, currentDate);
        });
    });
    
    // Setup navigation buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            navigateDate(-1);
        });
        prevBtn.addEventListener('mouseenter', (e) => {
            e.target.style.backgroundColor = 'var(--bg-tertiary)';
            e.target.style.color = 'var(--level-color)';
        });
        prevBtn.addEventListener('mouseleave', (e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.color = 'var(--text-secondary)';
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            navigateDate(1);
        });
        nextBtn.addEventListener('mouseenter', (e) => {
            e.target.style.backgroundColor = 'var(--bg-tertiary)';
            e.target.style.color = 'var(--level-color)';
        });
        nextBtn.addEventListener('mouseleave', (e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.color = 'var(--text-secondary)';
        });
    }
    
    // Initial display
    fetchAndDisplayStats(currentPeriod, currentDate);
    
    // Setup personal best card plus button listeners
    const plusButtons = document.querySelectorAll('.card-plus-btn');
    plusButtons.forEach(button => {
        button.addEventListener('click', () => {
            const metric = button.dataset.pb;
            let date = null;
            
            // Get the date from the corresponding date element
            const card = button.closest('.personal-best-card');
            if (card) {
                const dateElement = card.querySelector('small');
                if (dateElement && dateElement.textContent !== 'No runs yet') {
                    const dateStr = dateElement.textContent; // Format: "MM/DD/YYYY"
                    const [month, day, year] = dateStr.split('/');
                    const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`; // Convert to "YYYY-MM-DD"
                    openRunDetailsModal(metric, formattedDate);
                }
            }
        });
    });
    
    // Modal close button
    const closeBtn = document.getElementById('closeRunDetails');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeRunDetailsModal();
        });
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('runDetailsModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeRunDetailsModal();
            }
        });
    }

    // Kezdeti adatok betöltése
    fetchAndDisplayStats(currentPeriod);
});


