// BarrPeps Database - Main JavaScript
// Direct Excel file reader using SheetJS

let peptidesData = [];
let currentView = 'table';
let sortColumn = 'peptide_name';
let sortDirection = 'asc';
let filteredPeptides = [];

// Selected amino acids for filtering
let selectedAAs = [];

// Chart instances
let lengthChart = null;
let chargeChart = null;
let aaChart = null;

// Helper functions
function getPeptideUrl(peptideId, peptideName) {
    return `peptide.html?id=${peptideId}&name=${encodeURIComponent(peptideName)}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copySMILES(smiles) {
    navigator.clipboard.writeText(smiles).then(() => {
        const btn = document.querySelector('.copy-btn');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        }
    }).catch(() => {
        alert('Failed to copy SMILES');
    });
}

function showUnderConstruction() {
    const modal = document.getElementById('underConstructionModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeModal() {
    const modal = document.getElementById('underConstructionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.onclick = function(event) {
    const modal = document.getElementById('underConstructionModal');
    if (event.target === modal) {
        closeModal();
    }
}

// ========== EXCEL FILE LOADER ==========
async function loadExcelData() {
    try {
        console.log('Loading Excel file: database.xlsx');
        
        const response = await fetch('database.xlsx');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet);
        console.log(`Loaded ${rawData.length} rows from Excel`);
        
        parseExcelData(rawData);
        
    } catch (error) {
        console.error('Error loading Excel:', error);
        const errorHtml = `
            <div class="error-message">
                <p>Error loading database.xlsx: ${error.message}</p>
                <p>Please ensure database.xlsx is in the same directory.</p>
                <button onclick="location.reload()" class="btn-primary" style="margin-top: 1rem;">Retry</button>
            </div>
        `;
        
        const containers = ['featuredPeptides', 'resultsContainer', 'peptideDetail'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container && container.innerHTML && container.innerHTML.includes('Loading')) {
                container.innerHTML = errorHtml;
            }
        });
    }
}

function formatSequenceWithModifications(sequence) {
    if (!sequence) return 'N/A';
    
    let formatted = sequence
        .replace(/\(Me2\)/g, '<span class="modification" title="Dimethylated">(Me₂)</span>')
        .replace(/\(D\)/g, '<span class="modification" title="D-amino acid">(D)</span>')
        .replace(/\(NMe\)/g, '<span class="modification" title="N-methylated">(N-Me)</span>')
        .replace(/-NH2/g, '<span class="modification" title="Amidated">-NH₂</span>')
        .replace(/\(NαMe\)/g, '<span class="modification" title="N-alpha-methylated">(Nα-Me)</span>')
        .replace(/\(3,4-dehydro\)/g, '<span class="modification" title="Dehydro">(3,4-dehydro)</span>')
        .replace(/\(2'-N-succinimide-paclitaxel\)/g, '<span class="modification" title="Paclitaxel conjugated">(Paclitaxel)</span>')
        .replace(/\(Ac\)/g, '<span class="modification" title="Acetylated">(Ac)</span>')
        .replace(/\(Pen\)/g, '<span class="modification" title="Penicillamine">(Pen)</span>');
    
    return formatted;
}

function parseExcelData(rawData) {
    peptidesData = [];
    
    rawData.forEach((row, index) => {
        const originalSequence = row['sequence_1'] || row['sequence_one_letter'] || '';
        
        const peptide = {
            id: row['peptide_id'] || index + 1,
            peptide_name: row['trivial_name'] || row['peptide_name'] || `Peptide_${index + 1}`,
            sequence_one_letter: originalSequence,
            sequence_three_letter: row['sequence_3'] || row['sequence_three_letter'] || '',
            length: parseInt(row['length']) || originalSequence.length || 0,
            molecular_weight: parseFloat(row['molecular_weight']) || 0,
            net_charge: null,
            hydrophobicity: null,
            structure_type: row['conformation'] || row['structure_type'] || '',
            source_organism: row['origin'] || row['source_organism'] || '',
            antimicrobial_targets: null,
            antimicrobial_mic: null,
            anticancer_cell_lines: null,
            anticancer_ic50: null,
            anticancer_selectivity: null,
            bbb_permeability_value: null,
            bbb_transport_type: null,
            bbb_model: null,
            toxicity_hemolysis: null,
            stability_serum: null,
            synergy: null,
            pmid: null,
            doi: null,
            notes: row['disulfide_bridge'] ? `Disulfide bridges: ${row['disulfide_bridge']}` : (row['notes'] || ''),
            created_date: null,
            molecular_formula: row['molecular_formula'] || '',
            disulfide_bridge: row['disulfide_bridge'] || '',
            nature: row['nature'] || '',
            PDB: null
        };
        
        peptidesData.push(peptide);
    });
    
    console.log(`Parsed ${peptidesData.length} peptides from Excel`);
    filteredPeptides = [...peptidesData];
    
    const currentPage = window.location.pathname.split('/').pop();
    console.log('Current page:', currentPage);
    
    if (currentPage === 'index.html' || currentPage === '') {
        initHomePage();
    } else if (currentPage === 'browse.html') {
        initBrowsePage();
    } else if (currentPage === 'peptide.html') {
        initPeptidePage();
    }
}

// ========== CHART FUNCTIONS ==========

function calculateAADistribution() {
    const aaCounts = {
        'A': 0, 'R': 0, 'N': 0, 'D': 0, 'C': 0, 'Q': 0, 'E': 0, 'G': 0,
        'H': 0, 'I': 0, 'L': 0, 'K': 0, 'M': 0, 'F': 0, 'P': 0, 'S': 0,
        'T': 0, 'W': 0, 'Y': 0, 'V': 0
    };
    
    let totalAAs = 0;
    
    peptidesData.forEach(peptide => {
        const seq = peptide.sequence_one_letter || '';
        for (let i = 0; i < seq.length; i++) {
            const aa = seq[i];
            if (aaCounts.hasOwnProperty(aa)) {
                aaCounts[aa]++;
                totalAAs++;
            }
        }
    });
    
    const aaPercentages = {};
    for (const [aa, count] of Object.entries(aaCounts)) {
        aaPercentages[aa] = totalAAs > 0 ? (count / totalAAs * 100).toFixed(1) : 0;
    }
    
    return aaPercentages;
}

function calculateLengthDistribution() {
    const lengths = peptidesData.map(p => p.length).filter(l => l > 0);
    const maxLength = Math.max(...lengths);
    
    const binSize = 10;
    const bins = {};
    
    for (let i = 0; i <= maxLength + binSize; i += binSize) {
        const binStart = i;
        const binEnd = i + binSize;
        const binLabel = `${binStart}-${binEnd}`;
        bins[binLabel] = 0;
    }
    
    lengths.forEach(length => {
        const binIndex = Math.floor(length / binSize);
        const binStart = binIndex * binSize;
        const binEnd = binStart + binSize;
        const binLabel = `${binStart}-${binEnd}`;
        bins[binLabel]++;
    });
    
    const filteredBins = {};
    let hasData = false;
    for (const [label, count] of Object.entries(bins)) {
        if (count > 0) hasData = true;
        if (hasData || count > 0) {
            filteredBins[label] = count;
        }
    }
    
    return filteredBins;
}

function calculateChargeDistribution() {
    const charges = peptidesData.map(p => p.net_charge).filter(c => c !== null && c !== '');
    const chargeCounts = {};
    
    charges.forEach(charge => {
        const roundedCharge = Math.round(charge);
        const key = roundedCharge >= 0 ? `+${roundedCharge}` : `${roundedCharge}`;
        chargeCounts[key] = (chargeCounts[key] || 0) + 1;
    });
    
    const sortedKeys = Object.keys(chargeCounts).sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
    });
    
    const sortedCounts = {};
    sortedKeys.forEach(key => {
        sortedCounts[key] = chargeCounts[key];
    });
    
    return sortedCounts;
}

function createLengthChart() {
    const ctx = document.getElementById('lengthChart');
    if (!ctx) return;
    
    const distribution = calculateLengthDistribution();
    const labels = Object.keys(distribution);
    const data = Object.values(distribution);
    
    if (lengthChart) lengthChart.destroy();
    
    lengthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Peptides',
                data: data,
                backgroundColor: 'rgba(66, 153, 225, 0.7)',
                borderColor: 'rgba(66, 153, 225, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 10 } } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.raw} peptides` } }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Count', font: { size: 10 } }, ticks: { stepSize: 1, font: { size: 9 } } },
                x: { title: { display: true, text: 'Length (amino acids)', font: { size: 10 } }, ticks: { font: { size: 8 }, rotation: 45 } }
            }
        }
    });
}

function createChargeChart() {
    const ctx = document.getElementById('chargeChart');
    if (!ctx) return;
    
    const distribution = calculateChargeDistribution();
    const labels = Object.keys(distribution);
    const data = Object.values(distribution);
    
    if (chargeChart) chargeChart.destroy();
    
    const backgroundColors = labels.map(label => {
        const val = parseInt(label);
        if (val > 0) return 'rgba(66, 153, 225, 0.7)';
        if (val < 0) return 'rgba(245, 101, 101, 0.7)';
        return 'rgba(160, 174, 192, 0.7)';
    });
    
    chargeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Peptides',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(c => c.replace('0.7', '1')),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 10 } } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.raw} peptides` } }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Count', font: { size: 10 } }, ticks: { stepSize: 1, font: { size: 9 } } },
                x: { title: { display: true, text: 'Net Charge', font: { size: 10 } }, ticks: { font: { size: 9 } } }
            }
        }
    });
}

function createAAChart() {
    const ctx = document.getElementById('aaChart');
    if (!ctx) return;
    
    const distribution = calculateAADistribution();
    const labels = Object.keys(distribution);
    const data = Object.values(distribution);
    
    if (aaChart) aaChart.destroy();
    
    const colors = ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f56565', '#38b2ac', '#ecc94b', '#ed64a6', '#a0aec0', '#4a5568'];
    
    aaChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequency (%)',
                data: data,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 10 } } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.raw}% of all residues` } }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Frequency (%)', font: { size: 10 } }, ticks: { font: { size: 9 } } },
                x: { title: { display: true, text: 'Amino Acid', font: { size: 10 } }, ticks: { font: { size: 9 }, weight: 'bold' } }
            }
        }
    });
}

// ========== HOME PAGE ==========

function initHomePage() {
    console.log('Initializing home page');
    updateHomeStats();
    displayFeaturedPeptides();
    
    setTimeout(() => {
        if (peptidesData.length > 0) {
            createLengthChart();
            createChargeChart();
            createAAChart();
        }
    }, 100);
}

function updateHomeStats() {
    const total = peptidesData.length;
    if (total === 0) return;
    
    const avgLength = peptidesData.reduce((sum, p) => sum + p.length, 0) / total;
    const avgCharge = peptidesData.reduce((sum, p) => sum + (parseFloat(p.net_charge) || 0), 0) / total;
    
    const totalEl = document.getElementById('totalPeptides');
    const avgLengthEl = document.getElementById('avgLength');
    const avgChargeEl = document.getElementById('avgCharge');
    
    if (totalEl) totalEl.textContent = total;
    if (avgLengthEl) avgLengthEl.textContent = avgLength.toFixed(1);
    if (avgChargeEl) avgChargeEl.textContent = avgCharge.toFixed(1);
}

function displayFeaturedPeptides() {
    const container = document.getElementById('featuredPeptides');
    if (!container) return;
    
    const featured = peptidesData.slice(0, 6);
    
    if (featured.length === 0) {
        container.innerHTML = '<div class="loading">No peptides found in database</div>';
        return;
    }
    
    let html = '';
    featured.forEach(peptide => {
        const peptideUrl = getPeptideUrl(peptide.id, peptide.peptide_name);
        
        html += `
            <div class="peptide-card" onclick="window.location.href='${peptideUrl}'" style="cursor: pointer;">
                <div class="card-header">
                    <h3 style="color: #2c5282;">${peptide.peptide_name || 'Unnamed Peptide'}</h3>
                </div>
                <div class="card-content">
                    <div class="card-row">
                        <div class="card-label">Source:</div>
                        <div class="card-value">${peptide.source_organism || 'N/A'}</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Length / MW:</div>
                        <div class="card-value">${peptide.length || 'N/A'} aa / ${peptide.molecular_weight ? peptide.molecular_weight.toFixed(1) : 'N/A'} Da</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Structure:</div>
                        <div class="card-value">${peptide.structure_type || 'N/A'}</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ========== BROWSE PAGE ==========

function initBrowsePage() {
    console.log('Initializing browse page');
    filteredPeptides = [...peptidesData];
    updateBrowseStats();
    displayBrowseResults();
    setupBrowseEventListeners();
    initAASelector();
}

function setupBrowseEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                applyAllFilters();
            }
        });
    }
}

function updateBrowseStats() {
    const count = filteredPeptides.length;
    const countElement = document.getElementById('resultsCount');
    if (countElement) countElement.textContent = `Found peptides: ${count}`;
}

function initAASelector() {
    const buttons = document.querySelectorAll('.aa-btn-compact');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            const aa = this.getAttribute('data-aa');
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                selectedAAs = selectedAAs.filter(a => a !== aa);
            } else {
                this.classList.add('selected');
                selectedAAs.push(aa);
            }
        });
    });
}

function containsAllAAs(sequence, requiredAAs) {
    if (!requiredAAs || requiredAAs.length === 0) return true;
    return requiredAAs.every(aa => sequence && sequence.includes(aa));
}

function checkModification(peptide, modType) {
    const notes = (peptide.notes || '').toLowerCase();
    const name = (peptide.peptide_name || '').toLowerCase();
    const sequence = (peptide.sequence_one_letter || '').toLowerCase();
    
    switch(modType) {
        case 'amidation': return notes.includes('amid') || name.includes('amid') || sequence.includes('nh2');
        case 'acylation': return notes.includes('acyl') || name.includes('acyl');
        case 'cyclization': return notes.includes('cycl') || notes.includes('cyclic');
        case 'glycosylation': return notes.includes('glyco');
        case 'phosphorylation': return notes.includes('phospho');
        case 'methylated': return notes.includes('methyl') || sequence.includes('me') || sequence.includes('nme');
        case 'acetylated': return notes.includes('acetyl') || sequence.includes('ac');
        default: return true;
    }
}

function applyAllFilters() {
    const searchTerm = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';
    const structureFilter = document.getElementById('structureFilter') ? document.getElementById('structureFilter').value : 'all';
    const lengthMin = (document.getElementById('lengthMin') ? parseInt(document.getElementById('lengthMin').value) : 0) || 0;
    const lengthMax = (document.getElementById('lengthMax') ? parseInt(document.getElementById('lengthMax').value) : 100) || 1000;
    const modFilter = document.getElementById('modFilter') ? document.getElementById('modFilter').value : 'all';
    
    let tempFiltered = [...peptidesData];
    
    if (searchTerm) {
        tempFiltered = tempFiltered.filter(p => 
            (p.peptide_name && p.peptide_name.toLowerCase().includes(searchTerm)) ||
            (p.sequence_one_letter && p.sequence_one_letter.toLowerCase().includes(searchTerm)) ||
            (p.source_organism && p.source_organism.toLowerCase().includes(searchTerm))
        );
    }
    
    tempFiltered = tempFiltered.filter(p => p.length >= lengthMin && p.length <= lengthMax);
    
    if (structureFilter !== 'all') {
        tempFiltered = tempFiltered.filter(p => (p.structure_type || '').toLowerCase() === structureFilter.toLowerCase());
    }
    
    if (selectedAAs.length > 0) {
        tempFiltered = tempFiltered.filter(p => containsAllAAs(p.sequence_one_letter || '', selectedAAs));
    }
    
    if (modFilter !== 'all') {
        tempFiltered = tempFiltered.filter(p => checkModification(p, modFilter));
    }
    
    filteredPeptides = tempFiltered;
    updateBrowseStats();
    displayBrowseResults();
}

function resetAllFilters() {
    const searchInput = document.getElementById('searchInput');
    const lengthMin = document.getElementById('lengthMin');
    const lengthMax = document.getElementById('lengthMax');
    const structureFilter = document.getElementById('structureFilter');
    const modFilter = document.getElementById('modFilter');
    
    if (searchInput) searchInput.value = '';
    if (lengthMin) lengthMin.value = 0;
    if (lengthMax) lengthMax.value = 100;
    if (structureFilter) structureFilter.value = 'all';
    if (modFilter) modFilter.value = 'all';
    
    selectedAAs = [];
    document.querySelectorAll('.aa-btn-compact').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    filteredPeptides = [...peptidesData];
    updateBrowseStats();
    displayBrowseResults();
}

function downloadResults() {
    if (filteredPeptides.length === 0) {
        alert('No results to download');
        return;
    }
    
    const headers = ['ID', 'Peptide Name', 'Sequence', 'Length', 'MW (Da)', 'Structure Type', 'Source Organism', 'Molecular Formula', 'Disulfide Bridges', 'Notes'];
    
    const rows = filteredPeptides.map(p => [
        p.id || '',
        p.peptide_name || '',
        p.sequence_one_letter || '',
        p.length || '',
        p.molecular_weight || '',
        p.structure_type || '',
        p.source_organism || '',
        p.molecular_formula || '',
        p.disulfide_bridge || '',
        (p.notes || '').replace(/,/g, ';')
    ]);
    
    const csvContent = [headers, ...rows].map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `barrpeps_results_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function displayBrowseResults() {
    const container = document.getElementById('resultsContainer');
    if (!container) return;
    
    const count = filteredPeptides.length;
    
    if (count === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem;">No peptides found</div>';
        return;
    }
    
    if (currentView === 'table') {
        displayTableView(container);
    } else {
        displayCardBrowseView(container);
    }
}

function displayTableView(container) {
    let html = `
        <div class="table-view">
            <table>
                <thead>
                    <tr>
                        <th onclick="sortBy('peptide_name')">Name</th>
                        <th onclick="sortBy('sequence_one_letter')">Sequence</th>
                        <th onclick="sortBy('length')">Length</th>
                        <th onclick="sortBy('molecular_weight')">MW (Da)</th>
                        <th onclick="sortBy('structure_type')">Structure</th>
                        <th onclick="sortBy('source_organism')">Source</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    filteredPeptides.forEach(peptide => {
        const sequenceDisplay = peptide.sequence_one_letter ? 
            (peptide.sequence_one_letter.length > 35 ? 
                peptide.sequence_one_letter.substring(0, 35) + '...' : 
                peptide.sequence_one_letter) : 'N/A';
        
        const peptideUrl = getPeptideUrl(peptide.id, peptide.peptide_name);
        
        html += `
            <tr>
                <td style="padding: 0.7rem 0.5rem;">
                    <a href="${peptideUrl}" style="text-decoration: none; color: #2c5282; font-weight: bold;">
                        ${peptide.peptide_name || 'N/A'}
                    </a>
                  </td>
                <td style="font-family: monospace; font-size: 0.65rem;">${sequenceDisplay}</td>
                <td>${peptide.length || 'N/A'}</td>
                <td>${peptide.molecular_weight ? peptide.molecular_weight.toFixed(1) : 'N/A'}</td>
                <td>${peptide.structure_type || 'N/A'}</td>
                <td>${peptide.source_organism || 'N/A'}</td>
                <td><a href="${peptideUrl}" class="btn-primary" style="padding: 0.25rem 0.6rem; font-size: 0.65rem; text-decoration: none;">View</a></td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function displayCardBrowseView(container) {
    let html = '<div class="peptide-grid">';
    
    filteredPeptides.forEach(peptide => {
        const peptideUrl = getPeptideUrl(peptide.id, peptide.peptide_name);
        
        html += `
            <div class="peptide-card" onclick="window.location.href='${peptideUrl}'" style="cursor: pointer;">
                <div class="card-header">
                    <h3 style="color: #2c5282;">${peptide.peptide_name || 'Unnamed Peptide'}</h3>
                </div>
                <div class="card-content">
                    <div class="card-row">
                        <div class="card-label">Source:</div>
                        <div class="card-value">${peptide.source_organism || 'N/A'}</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Length / MW:</div>
                        <div class="card-value">${peptide.length || 'N/A'} aa / ${peptide.molecular_weight ? peptide.molecular_weight.toFixed(1) : 'N/A'} Da</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Structure:</div>
                        <div class="card-value">${peptide.structure_type || 'N/A'}</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Sequence:</div>
                        <div class="card-value" style="font-family: monospace; font-size: 0.7rem; word-break: break-all;">${peptide.sequence_one_letter || 'N/A'}</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function setView(view) {
    currentView = view;
    const btns = document.querySelectorAll('.toggle-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    if (view === 'table') {
        if (btns[0]) btns[0].classList.add('active');
    } else {
        if (btns[1]) btns[1].classList.add('active');
    }
    displayBrowseResults();
}

function sortBy(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    filteredPeptides.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        
        if (valA === undefined || valA === null || valA === '') valA = -Infinity;
        if (valB === undefined || valB === null || valB === '') valB = -Infinity;
        
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    displayBrowseResults();
}

// ========== PEPTIDE DETAIL PAGE ==========

async function initPeptidePage() {
    console.log('Initializing peptide page');
    
    const urlParams = new URLSearchParams(window.location.search);
    const peptideId = parseInt(urlParams.get('id'));
    const peptide = peptidesData.find(p => p.id === peptideId);
    
    if (!peptide) {
        const detailContainer = document.getElementById('peptideDetail');
        if (detailContainer) {
            detailContainer.innerHTML = `
                <div class="error-message">
                    <p>Peptide not found</p>
                    <a href="browse.html" class="btn-primary">Browse Database</a>
                </div>
            `;
        }
        return;
    }
    
    document.title = `${peptide.peptide_name} - BarrPeps Database`;
    
    displayPeptideDetail(peptide);
}

function displayPeptideDetail(peptide) {
    const formattedSequence = formatSequenceWithModifications(peptide.sequence_one_letter);
    
    const html = `
        <div class="peptide-detail-container">
            <div style="margin-bottom: 1rem;">
                <a href="browse.html" class="btn-secondary back-button" style="display: inline-block; text-decoration: none;">← Back to Browse</a>
                <h1 style="color: #2c5282; font-size: 1.4rem; margin-bottom: 0.2rem;">${peptide.peptide_name || 'N/A'}</h1>
                <p style="color: #718096; font-size: 0.7rem;">ID: ${peptide.id}</p>
            </div>
            
            <div class="detail-section">
                <h3>Basic Information</h3>
                <div class="detail-row"><span class="detail-label">Peptide Name:</span><span class="detail-value">${peptide.peptide_name || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Sequence (1-letter):</span><span class="detail-value" style="font-family: monospace; font-size: 0.8rem; word-break: break-all;">${formattedSequence}</span></div>
                <div class="detail-row"><span class="detail-label">Sequence (3-letter):</span><span class="detail-value" style="font-size: 0.7rem; word-break: break-all;">${peptide.sequence_three_letter || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Length:</span><span class="detail-value">${peptide.length || 'N/A'} aa</span></div>
                <div class="detail-row"><span class="detail-label">Molecular Weight:</span><span class="detail-value">${peptide.molecular_weight ? peptide.molecular_weight.toFixed(2) : 'N/A'} Da</span></div>
                <div class="detail-row"><span class="detail-label">Molecular Formula:</span><span class="detail-value">${peptide.molecular_formula || 'N/A'}</span></div>
            </div>
            
            <div class="detail-section">
                <h3>Structural Properties</h3>
                <div class="detail-row"><span class="detail-label">Structure Type:</span><span class="detail-value">${peptide.structure_type || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Disulfide Bridges:</span><span class="detail-value">${peptide.disulfide_bridge || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Nature:</span><span class="detail-value">${peptide.nature || 'N/A'}</span></div>
            </div>
            
            <div class="detail-section">
                <h3>Biological Source</h3>
                <div class="detail-row"><span class="detail-label">Organism:</span><span class="detail-value">${peptide.source_organism || 'N/A'}</span></div>
            </div>
            
            <div class="detail-section">
                <h3>Additional Information</h3>
                <div class="detail-row"><span class="detail-label">Notes:</span><span class="detail-value">${peptide.notes || 'N/A'}</span></div>
            </div>
        </div>
    `;
    
    const detailContainer = document.getElementById('peptideDetail');
    if (detailContainer) {
        detailContainer.innerHTML = html;
    }
}

// ========== INITIALIZATION ==========

window.searchPeptides = applyAllFilters;
window.resetFilters = resetAllFilters;
window.setView = setView;
window.sortBy = sortBy;
window.copySMILES = copySMILES;
window.showUnderConstruction = showUnderConstruction;
window.closeModal = closeModal;
window.applyAllFilters = applyAllFilters;
window.resetAllFilters = resetAllFilters;
window.downloadResults = downloadResults;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting Excel load...');
    loadExcelData();
});