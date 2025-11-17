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
                console.log('Loaded runs:', runs);

                const tableBody = document.getElementById('runsTableBody');
                
                if (!Array.isArray(runs) || runs.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">No runs yet</td></tr>';
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
                                <td style="text-align: center; display: flex; gap: 8px; justify-content: center;">
                                    <button class="edit-run-btn" data-run-id="${run.id}" style="background: none; border: none; cursor: pointer; font-size: 1.2em; color: var(--text-secondary); padding: 4px 8px; border-radius: 4px; transition: all 0.2s;" title="Edit">✎</button>
                                    <button class="delete-run-btn" data-run-id="${run.id}" style="background: none; border: none; cursor: pointer; font-size: 1.2em; color: var(--text-secondary); padding: 4px 8px; border-radius: 4px; transition: all 0.2s;" title="Delete">🗑️</button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                    
                    // Add event listeners to edit buttons
                    document.querySelectorAll('.edit-run-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            const runId = e.target.dataset.runId;
                            console.log('Edit button clicked, run ID:', runId);
                            openEditRunModal(runId, runs);
                        });
                        
                        btn.addEventListener('mouseenter', (e) => {
                            e.target.style.backgroundColor = 'var(--bg-tertiary)';
                            e.target.style.color = 'var(--level-color)';
                        });
                        
                        btn.addEventListener('mouseleave', (e) => {
                            e.target.style.backgroundColor = 'transparent';
                            e.target.style.color = 'var(--text-secondary)';
                        });
                    });
                    
                    // Add event listeners to delete buttons
                    document.querySelectorAll('.delete-run-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            const runId = e.target.dataset.runId;
                            console.log('Delete button clicked, run ID:', runId);
                            openDeleteConfirmModal(runId);
                        });
                        
                        btn.addEventListener('mouseenter', (e) => {
                            e.target.style.backgroundColor = '#dc3545';
                            e.target.style.color = 'white';
                        });
                        
                        btn.addEventListener('mouseleave', (e) => {
                            e.target.style.backgroundColor = 'transparent';
                            e.target.style.color = 'var(--text-secondary)';
                        });
                    });
                }
                runsLoaded = true;
            } catch (error) {
                console.error('Error fetching runs:', error);
                const tableBody = document.getElementById('runsTableBody');
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Error loading runs</td></tr>';
            }
        }
    });
}

// Delete confirmation modal
function openDeleteConfirmModal(runId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'deleteConfirmModal';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2>Delete Run</h2>
                <button class="modal-close" id="closeDeleteModal">&times;</button>
            </div>
            
            <div class="modal-body">
                <p style="font-size: 16px; margin-bottom: 20px;">Are you sure you want to delete this run? This action cannot be undone.</p>
                
                <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancelDeleteBtn" style="padding: 8px 16px; border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
                    <button id="confirmDeleteBtn" style="padding: 8px 16px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600;">Delete</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal
    document.getElementById('closeDeleteModal').addEventListener('click', () => {
        modal.remove();
    });
    
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
        modal.remove();
    });
    
    // Confirm delete
    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/delete-run/${runId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (response.ok) {
                modal.remove();
                location.reload();
            } else {
                const error = await response.json();
                console.error('Error deleting run:', error);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Edit run modal functionality
function openEditRunModal(runId, runs) {
    console.log('openEditRunModal called with runId:', runId, 'runs:', runs);
    const run = runs.find(r => r.id == runId);
    console.log('Found run:', run);
    if (!run) {
        console.error('Run not found with ID:', runId);
        return;
    }

    // Create modal HTML
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'editRunModal';
    
    const hours = Math.floor(run.duration_min / 60);
    const minutes = Math.round(run.duration_min % 60);
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Run</h2>
                <button class="modal-close" id="closeEditRunModal">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="form-group">
                    <label for="editRunDate">Date</label>
                    <input type="date" id="editRunDate" value="${run.run_date}" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--input-bg); color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
                </div>
                
                <div class="form-group">
                    <label for="editRunDistance">Distance (km)</label>
                    <input type="number" id="editRunDistance" value="${parseFloat(run.distance_km).toFixed(1)}" step="0.1" min="0" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--input-bg); color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="editRunHours">Hours</label>
                        <input type="number" id="editRunHours" value="${hours}" min="0" max="24" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--input-bg); color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
                    </div>
                    
                    <div class="form-group">
                        <label for="editRunMinutes">Minutes</label>
                        <input type="number" id="editRunMinutes" value="${minutes}" min="0" max="59" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--input-bg); color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="editRunDifficulty">Difficulty (1-10)</label>
                    <input type="number" id="editRunDifficulty" value="${run.difficulty}" min="1" max="10" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--input-bg); color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
                </div>
                
                <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button class="cancel-button" id="cancelEditRunBtn" style="padding: 8px 16px; border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
                    <button class="submit-button levelcolor" id="saveEditRunBtn" style="padding: 8px 16px; background-color: var(--level-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600;">Save Changes</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal
    document.getElementById('closeEditRunModal').addEventListener('click', () => {
        modal.remove();
    });
    
    document.getElementById('cancelEditRunBtn').addEventListener('click', () => {
        modal.remove();
    });
    
    // Save changes
    document.getElementById('saveEditRunBtn').addEventListener('click', async () => {
        const date = document.getElementById('editRunDate').value;
        const distance = parseFloat(document.getElementById('editRunDistance').value);
        const hours = parseInt(document.getElementById('editRunHours').value);
        const minutes = parseInt(document.getElementById('editRunMinutes').value);
        const difficulty = parseInt(document.getElementById('editRunDifficulty').value);
        
        const durationMin = hours * 60 + minutes;
        
        try {
            const response = await fetch(`/api/update-run/${runId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    run_date: date,
                    distance_km: distance,
                    duration_min: durationMin,
                    difficulty: difficulty
                })
            });
            
            if (response.ok) {
                modal.remove();
                // Reload the runs
                location.reload();
            } else {
                const error = await response.json();
                console.error('Error updating run:', error);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}
