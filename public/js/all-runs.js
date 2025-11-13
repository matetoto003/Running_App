// All Runs functionality
if (document.getElementById('allRunsToggle')) {
    const toggleButton = document.getElementById('allRunsToggle');
    const runsContainer = document.getElementById('allRunsContainer');
    let runsLoaded = false;

    toggleButton.addEventListener('click', async () => {
        // Toggle visibility
        const isVisible = runsContainer.style.display !== 'none';
        runsContainer.style.display = isVisible ? 'none' : 'block';
        toggleButton.classList.toggle('active');

        // Load runs if not already loaded
        if (!runsLoaded && runsContainer.style.display !== 'none') {
            try {
                const response = await fetch('/api/all-runs', {
                    credentials: 'include'
                });
                const runs = await response.json();

                const tableBody = document.getElementById('runsTableBody');
                
                if (!Array.isArray(runs) || runs.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No runs yet</td></tr>';
                } else {
                    tableBody.innerHTML = runs.map(run => {
                        const difficulty = parseInt(run.difficulty);
                        let difficultyClass = 'easy';
                        if (difficulty >= 7) difficultyClass = 'hard';
                        else if (difficulty >= 5) difficultyClass = 'medium';

                        const hours = Math.floor(run.duration_min / 60);
                        const minutes = Math.round(run.duration_min % 60);
                        const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

                        return `
                            <tr>
                                <td>${run.run_date}</td>
                                <td>${parseFloat(run.distance_km).toFixed(1)} km</td>
                                <td>${durationStr}</td>
                                <td><span class="difficulty-badge ${difficultyClass}">${difficulty}/10</span></td>
                            </tr>
                        `;
                    }).join('');
                }
                runsLoaded = true;
            } catch (error) {
                console.error('Error fetching runs:', error);
                const tableBody = document.getElementById('runsTableBody');
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: red;">Error loading runs</td></tr>';
            }
        }
    });
}
