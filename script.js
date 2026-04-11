// BarrPeps Database - Main JavaScript
// Excel File Reader for database.xlsx with 4 sheets

let peptidesData = [];
let experimentsData = [];
let referencesData = [];
let modificationsData = [];

let currentView = 'table';
let sortColumn = 'peptide_name';
let sortDirection = 'asc';
let filteredPeptides = [];

let selectedAAs = [];

let lengthChart = null;
let chargeChart = null;
let aaChart = null;

// Helper functions
function getPeptideUrl(peptideId, peptideName) {
    return 'peptide.html?id=' + peptideId + '&name=' + encodeURIComponent(peptideName);
}

function showUnderConstruction() {
    var modal = document.getElementById('underConstructionModal');
    if (modal) modal.style.display = 'flex';
}

function closeModal() {
    var modal = document.getElementById('underConstructionModal');
    if (modal) modal.style.display = 'none';
}

window.onclick = function(event) {
    var modal = document.getElementById('underConstructionModal');
    if (event.target === modal) closeModal();
}

// ========== EXCEL LOADER ==========
function loadExcelFile() {
    console.log('Attempting to load database.xlsx...');
    
    fetch('database.xlsx')
        .then(function(response) {
            if (!response.ok) {
                throw new Error('HTTP error: ' + response.status);
            }
            return response.arrayBuffer();
        })
        .then(function(arrayBuffer) {
            console.log('Excel file loaded, parsing...');
            var workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            var sheetNames = workbook.SheetNames;
            console.log('Sheets found:', sheetNames);
            
            // Process each sheet
            for (var s = 0; s < sheetNames.length; s++) {
                var sheetName = sheetNames[s];
                var worksheet = workbook.Sheets[sheetName];
                var jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                console.log('Sheet "' + sheetName + '" has ' + jsonData.length + ' rows');
                
                // Store data in appropriate array based on sheet name
                var lowerName = sheetName.toLowerCase();
                if (lowerName === 'peptides') {
                    peptidesData = jsonData;
                } else if (lowerName === 'experiments') {
                    experimentsData = jsonData;
                } else if (lowerName === 'references') {
                    referencesData = jsonData;
                } else if (lowerName === 'modifications') {
                    modificationsData = jsonData;
                }
            }
            
            // Validate data
            if (peptidesData.length === 0) {
                console.warn('No peptides data found in Excel file');
                showError('No peptides data found in database.xlsx');
                return;
            }
            
            console.log('Data summary:');
            console.log('  - Peptides: ' + peptidesData.length);
            console.log('  - Experiments: ' + experimentsData.length);
            console.log('  - References: ' + referencesData.length);
            console.log('  - Modifications: ' + modificationsData.length);
            
            // Process and merge all data
            processAllData();
        })
        .catch(function(error) {
            console.error('Error loading Excel:', error);
            showError('Error loading database.xlsx: ' + error.message);
        });
}

function showError(message) {
    var errorHtml = '<div class="error-message">' +
        '<p>' + message + '</p>' +
        '<p>Please ensure database.xlsx is in the same directory.</p>' +
        '<button onclick="location.reload()" class="btn-primary" style="margin-top: 1rem;">Retry</button>' +
        '</div>';
    
    var containers = ['featuredPeptides', 'resultsContainer', 'peptideDetail'];
    for (var c = 0; c < containers.length; c++) {
        var container = document.getElementById(containers[c]);
        if (container && container.innerHTML && container.innerHTML.indexOf('Loading') !== -1) {
            container.innerHTML = errorHtml;
        }
    }
}

// ========== DATA PROCESSING ==========
function processAllData() {
    console.log('Processing and merging data...');
    
    // Create a map for quick lookup of related data
    var experimentsMap = {};
    var referencesMap = {};
    var modificationsMap = {};
    
    // Group experiments by peptide_id
    for (var i = 0; i < experimentsData.length; i++) {
        var exp = experimentsData[i];
        var pid = exp['peptide_id'];
        if (pid) {
            if (!experimentsMap[pid]) experimentsMap[pid] = [];
            experimentsMap[pid].push(exp);
        }
    }
    
    // Group references by peptide_id
    for (var i = 0; i < referencesData.length; i++) {
        var ref = referencesData[i];
        var pid = ref['peptide_id'];
        if (pid) {
            if (!referencesMap[pid]) referencesMap[pid] = [];
            referencesMap[pid].push(ref);
        }
    }
    
    // Group modifications by peptide_id
    for (var i = 0; i < modificationsData.length; i++) {
        var mod = modificationsData[i];
        var pid = mod['peptide_id'];
        if (pid) {
            if (!modificationsMap[pid]) modificationsMap[pid] = [];
            modificationsMap[pid].push(mod);
        }
    }
    
    // Build enhanced peptide objects
    var enhancedPeptides = [];
    
    for (var i = 0; i < peptidesData.length; i++) {
        var sourcePeptide = peptidesData[i];
        var peptideId = sourcePeptide['peptide_id'];
        
        if (!peptideId) continue;
        
        // Get related data
        var relatedExperiments = experimentsMap[peptideId] || [];
        var relatedReferences = referencesMap[peptideId] || [];
        var relatedModifications = modificationsMap[peptideId] || [];
        
        // Extract transport types from experiments
        var transportTypes = [];
        var seenTransport = {};
        for (var e = 0; e < relatedExperiments.length; e++) {
            var tt = relatedExperiments[e]['transport_type'];
            if (tt && !seenTransport[tt]) {
                seenTransport[tt] = true;
                transportTypes.push(tt);
            }
        }
        
        // Extract modification types
        var modificationTypes = [];
        var seenMods = {};
        for (var m = 0; m < relatedModifications.length; m++) {
            var modType = relatedModifications[m]['modifications'];
            if (modType && !seenMods[modType]) {
                seenMods[modType] = true;
                modificationTypes.push(modType);
            }
        }
        
        // Get primary reference
        var primaryRef = null;
        for (var r = 0; r < relatedReferences.length; r++) {
            if (relatedReferences[r]['source_ref_id']) {
                primaryRef = relatedReferences[r];
                break;
            }
        }
        if (!primaryRef && relatedReferences.length > 0) {
            primaryRef = relatedReferences[0];
        }
        
        // Build clean sequence (remove special characters for length calculation)
        var rawSequence = sourcePeptide['sequence_1'] || sourcePeptide['sequence_one_letter'] || '';
        var cleanSequence = rawSequence.replace(/\([^)]+\)/g, '').replace(/[^A-Za-z]/g, '');
        
        // Create enhanced peptide object
        var enhanced = {
            // Basic info
            id: peptideId,
            peptide_name: sourcePeptide['trivial_name'] || sourcePeptide['peptide_name'] || 'Peptide_' + peptideId,
            sequence_one_letter: rawSequence,
            sequence_clean: cleanSequence,
            sequence_three_letter: sourcePeptide['sequence_3'] || sourcePeptide['sequence_three_letter'] || '',
            length: parseInt(sourcePeptide['length']) || cleanSequence.length,
            molecular_weight: parseFloat(sourcePeptide['molecular_weight']) || 0,
            molecular_formula: sourcePeptide['molecular_formula'] || '',
            
            // Structural info
            structure_type: sourcePeptide['conformation'] || sourcePeptide['structure_type'] || '',
            disulfide_bridge: sourcePeptide['disulfide_bridge'] || '',
            nature: sourcePeptide['nature'] || '',
            
            // Source
            source_organism: sourcePeptide['origin'] || sourcePeptide['source_organism'] || '',
            
            // Related data
            modifications: modificationTypes,
            experiments: relatedExperiments,
            references: relatedReferences,
            transport_types: transportTypes,
            
            // Literature
            authors: primaryRef ? primaryRef['authors'] : '',
            title: primaryRef ? primaryRef['title'] : '',
            year: primaryRef ? primaryRef['year'] : '',
            journal: primaryRef ? primaryRef['journal'] : '',
            
            // Legacy
            notes: sourcePeptide['disulfide_bridge'] ? 'Disulfide bridges: ' + sourcePeptide['disulfide_bridge'] : '',
            PDB: null,
            net_charge: null,
            hydrophobicity: null
        };
        
        enhancedPeptides.push(enhanced);
    }
    
    peptidesData = enhancedPeptides;
    filteredPeptides = [...peptidesData];
    
    console.log('Processed ' + peptidesData.length + ' peptides');
    
    // Initialize appropriate page
    var currentPage = window.location.pathname.split('/').pop();
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
    var aaCounts = {
        'A': 0, 'R': 0, 'N': 0, 'D': 0, 'C': 0, 'Q': 0, 'E': 0, 'G': 0,
        'H': 0, 'I': 0, 'L': 0, 'K': 0, 'M': 0, 'F': 0, 'P': 0, 'S': 0,
        'T': 0, 'W': 0, 'Y': 0, 'V': 0
    };
    var totalAAs = 0;
    
    for (var p = 0; p < peptidesData.length; p++) {
        var seq = peptidesData[p].sequence_clean || '';
        for (var i = 0; i < seq.length; i++) {
            var aa = seq[i];
            if (aaCounts[aa] !== undefined) {
                aaCounts[aa]++;
                totalAAs++;
            }
        }
    }
    
    var result = {};
    for (var aa in aaCounts) {
        result[aa] = totalAAs > 0 ? (aaCounts[aa] / totalAAs * 100).toFixed(1) : 0;
    }
    return result;
}

function calculateLengthDistribution() {
    var lengths = [];
    for (var p = 0; p < peptidesData.length; p++) {
        var l = peptidesData[p].length;
        if (l > 0) lengths.push(l);
    }
    if (lengths.length === 0) return {};
    
    var maxLength = Math.max.apply(null, lengths);
    var binSize = 10;
    var bins = {};
    
    for (var i = 0; i <= maxLength + binSize; i += binSize) {
        bins[i + '-' + (i + binSize)] = 0;
    }
    
    for (var i = 0; i < lengths.length; i++) {
        var len = lengths[i];
        var binIndex = Math.floor(len / binSize) * binSize;
        var label = binIndex + '-' + (binIndex + binSize);
        if (bins[label] !== undefined) bins[label]++;
    }
    
    var filtered = {};
    var hasData = false;
    for (var label in bins) {
        if (bins[label] > 0) hasData = true;
        if (hasData || bins[label] > 0) filtered[label] = bins[label];
    }
    return filtered;
}

function createLengthChart() {
    var ctx = document.getElementById('lengthChart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    var dist = calculateLengthDistribution();
    if (lengthChart) lengthChart.destroy();
    
    lengthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(dist),
            datasets: [{ label: 'Number of Peptides', data: Object.values(dist), backgroundColor: 'rgba(66,153,225,0.7)', borderColor: 'rgba(66,153,225,1)', borderWidth: 1 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Count' }, ticks: { stepSize: 1 } }, x: { title: { display: true, text: 'Length (aa)' }, ticks: { rotation: 45 } } }
        }
    });
}

function createAAChart() {
    var ctx = document.getElementById('aaChart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    var dist = calculateAADistribution();
    if (aaChart) aaChart.destroy();
    
    aaChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(dist),
            datasets: [{ label: 'Frequency (%)', data: Object.values(dist), backgroundColor: '#4299e1', borderColor: '#2c5282', borderWidth: 1 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Frequency (%)' } }, x: { title: { display: true, text: 'Amino Acid' } } }
        }
    });
}

function createChargeChart() {
    var ctx = document.getElementById('chargeChart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    var charges = [];
    for (var p = 0; p < peptidesData.length; p++) {
        var c = peptidesData[p].net_charge;
        if (c !== null && c !== '') charges.push(Math.round(c));
    }
    
    var counts = {};
    for (var i = 0; i < charges.length; i++) {
        var key = charges[i] >= 0 ? '+' + charges[i] : '' + charges[i];
        counts[key] = (counts[key] || 0) + 1;
    }
    
    if (chargeChart) chargeChart.destroy();
    
    chargeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(counts),
            datasets: [{ label: 'Number of Peptides', data: Object.values(counts), backgroundColor: 'rgba(66,153,225,0.7)', borderColor: 'rgba(66,153,225,1)', borderWidth: 1 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Count' }, ticks: { stepSize: 1 } }, x: { title: { display: true, text: 'Net Charge' } } }
        }
    });
}

// ========== HOME PAGE ==========
function initHomePage() {
    updateHomeStats();
    displayFeaturedPeptides();
    setTimeout(function() {
        if (peptidesData.length > 0 && typeof Chart !== 'undefined') {
            createLengthChart();
            createChargeChart();
            createAAChart();
        }
    }, 100);
}

function updateHomeStats() {
    var total = peptidesData.length;
    if (total === 0) return;
    
    var sumLength = 0;
    for (var i = 0; i < peptidesData.length; i++) sumLength += peptidesData[i].length;
    var avgLength = sumLength / total;
    
    var totalEl = document.getElementById('totalPeptides');
    var avgLengthEl = document.getElementById('avgLength');
    if (totalEl) totalEl.textContent = total;
    if (avgLengthEl) avgLengthEl.textContent = avgLength.toFixed(1);
}

function displayFeaturedPeptides() {
    var container = document.getElementById('featuredPeptides');
    if (!container) return;
    
    var featured = peptidesData.slice(0, 6);
    if (featured.length === 0) {
        container.innerHTML = '<div class="loading">No peptides found</div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < featured.length; i++) {
        var p = featured[i];
        var url = getPeptideUrl(p.id, p.peptide_name);
        html += '<div class="peptide-card" onclick="window.location.href=\'' + url + '\'" style="cursor:pointer;">' +
            '<div class="card-header"><h3>' + (p.peptide_name || 'Unnamed') + '</h3></div>' +
            '<div class="card-content">' +
                '<div class="card-row"><div class="card-label">Source:</div><div class="card-value">' + (p.source_organism || 'N/A') + '</div></div>' +
                '<div class="card-row"><div class="card-label">Length:</div><div class="card-value">' + (p.length || 'N/A') + ' aa</div></div>' +
                '<div class="card-row"><div class="card-label">MW:</div><div class="card-value">' + (p.molecular_weight ? p.molecular_weight.toFixed(1) : 'N/A') + ' Da</div></div>' +
            '</div>' +
        '</div>';
    }
    container.innerHTML = html;
}

// ========== BROWSE PAGE ==========
function initBrowsePage() {
    filteredPeptides = [...peptidesData];
    updateBrowseStats();
    displayBrowseResults();
    setupBrowseEventListeners();
    initAASelector();
}

function setupBrowseEventListeners() {
    var input = document.getElementById('searchInput');
    if (input) input.addEventListener('keypress', function(e) { if (e.key === 'Enter') applyFilters(); });
}

function updateBrowseStats() {
    var el = document.getElementById('resultsCount');
    if (el) el.textContent = 'Found peptides: ' + filteredPeptides.length;
}

function initAASelector() {
    var btns = document.querySelectorAll('.aa-btn-compact');
    for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function() {
            var aa = this.getAttribute('data-aa');
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                var newSel = [];
                for (var j = 0; j < selectedAAs.length; j++) {
                    if (selectedAAs[j] !== aa) newSel.push(selectedAAs[j]);
                }
                selectedAAs = newSel;
            } else {
                this.classList.add('selected');
                selectedAAs.push(aa);
            }
        });
    }
}

function containsAllAAs(seq, required) {
    if (!required || required.length === 0) return true;
    for (var i = 0; i < required.length; i++) {
        if (seq.indexOf(required[i]) === -1) return false;
    }
    return true;
}

function checkModification(peptide, modType) {
    var mods = peptide.modifications || [];
    for (var i = 0; i < mods.length; i++) {
        var m = mods[i].toLowerCase();
        if (modType === 'amidation' && (m.indexOf('amid') !== -1 || m.indexOf('nh2') !== -1)) return true;
        if (modType === 'acylation' && m.indexOf('acyl') !== -1) return true;
        if (modType === 'cyclization' && (m.indexOf('cycl') !== -1 || m.indexOf('cyclic') !== -1)) return true;
        if (modType === 'glycosylation' && m.indexOf('glyco') !== -1) return true;
        if (modType === 'phosphorylation' && m.indexOf('phospho') !== -1) return true;
        if (modType === 'methylated' && (m.indexOf('methyl') !== -1 || m.indexOf('me') !== -1)) return true;
        if (modType === 'acetylated' && (m.indexOf('acetyl') !== -1 || m.indexOf('ac') !== -1)) return true;
    }
    return false;
}

function applyFilters() {
    var searchTerm = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';
    var structType = document.getElementById('structureFilter') ? document.getElementById('structureFilter').value : 'all';
    var minLen = (document.getElementById('lengthMin') ? parseInt(document.getElementById('lengthMin').value) : 0) || 0;
    var maxLen = (document.getElementById('lengthMax') ? parseInt(document.getElementById('lengthMax').value) : 1000) || 1000;
    var modType = document.getElementById('modFilter') ? document.getElementById('modFilter').value : 'all';
    
    var result = [];
    for (var i = 0; i < peptidesData.length; i++) {
        var p = peptidesData[i];
        
        // Search filter
        if (searchTerm) {
            var inName = p.peptide_name && p.peptide_name.toLowerCase().indexOf(searchTerm) !== -1;
            var inSeq = p.sequence_one_letter && p.sequence_one_letter.toLowerCase().indexOf(searchTerm) !== -1;
            var inSource = p.source_organism && p.source_organism.toLowerCase().indexOf(searchTerm) !== -1;
            if (!inName && !inSeq && !inSource) continue;
        }
        
        // Length filter
        if (p.length < minLen || p.length > maxLen) continue;
        
        // Structure filter
        if (structType !== 'all' && (p.structure_type || '').toLowerCase() !== structType.toLowerCase()) continue;
        
        // Amino acid filter
        if (selectedAAs.length > 0 && !containsAllAAs(p.sequence_clean || '', selectedAAs)) continue;
        
        // Modification filter
        if (modType !== 'all' && !checkModification(p, modType)) continue;
        
        result.push(p);
    }
    
    filteredPeptides = result;
    updateBrowseStats();
    displayBrowseResults();
}

function resetFilters() {
    var inputs = ['searchInput', 'lengthMin', 'lengthMax', 'structureFilter', 'modFilter'];
    for (var i = 0; i < inputs.length; i++) {
        var el = document.getElementById(inputs[i]);
        if (el) el.value = (inputs[i] === 'lengthMin' ? 0 : (inputs[i] === 'lengthMax' ? 100 : ''));
    }
    if (document.getElementById('structureFilter')) document.getElementById('structureFilter').value = 'all';
    if (document.getElementById('modFilter')) document.getElementById('modFilter').value = 'all';
    
    selectedAAs = [];
    var btns = document.querySelectorAll('.aa-btn-compact');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('selected');
    
    filteredPeptides = [...peptidesData];
    updateBrowseStats();
    displayBrowseResults();
}

function downloadResults() {
    if (filteredPeptides.length === 0) {
        alert('No results to download');
        return;
    }
    
    var headers = ['ID', 'Name', 'Sequence', 'Length', 'MW (Da)', 'Formula', 'Structure', 'Source', 'Disulfide', 'Modifications'];
    var rows = [];
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        rows.push([p.id, p.peptide_name, p.sequence_one_letter, p.length, p.molecular_weight, p.molecular_formula, p.structure_type, p.source_organism, p.disulfide_bridge, (p.modifications || []).join('; ')]);
    }
    
    var csv = headers.join(',') + '\n';
    for (var i = 0; i < rows.length; i++) {
        var row = [];
        for (var j = 0; j < rows[i].length; j++) {
            row.push('"' + String(rows[i][j] || '').replace(/"/g, '""') + '"');
        }
        csv += row.join(',') + '\n';
    }
    
    var blob = new Blob([csv], { type: 'text/csv' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'barrpeps_export.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

function displayBrowseResults() {
    var container = document.getElementById('resultsContainer');
    if (!container) return;
    
    if (filteredPeptides.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:2rem;">No peptides found</div>';
        return;
    }
    
    if (currentView === 'table') displayTableView(container);
    else displayCardView(container);
}

function displayTableView(container) {
    var html = '<div class="table-view"><table><thead><tr>' +
        '<th onclick="sortBy(\'peptide_name\')">Name</th>' +
        '<th onclick="sortBy(\'sequence_one_letter\')">Sequence</th>' +
        '<th onclick="sortBy(\'length\')">Length</th>' +
        '<th onclick="sortBy(\'molecular_weight\')">MW (Da)</th>' +
        '<th onclick="sortBy(\'structure_type\')">Structure</th>' +
        '<th onclick="sortBy(\'source_organism\')">Source</th>' +
        '<th>Details</th>' +
        '</tr></thead><tbody>';
    
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        var seqShort = p.sequence_one_letter ? (p.sequence_one_letter.length > 30 ? p.sequence_one_letter.substring(0,30) + '...' : p.sequence_one_letter) : 'N/A';
        var url = getPeptideUrl(p.id, p.peptide_name);
        html += '<tr>' +
            '<td><a href="' + url + '" style="color:#2c5282;font-weight:bold;">' + (p.peptide_name || 'N/A') + '</a></td>' +
            '<td style="font-family:monospace;font-size:0.65rem;">' + seqShort + '</td>' +
            '<td>' + (p.length || 'N/A') + '</td>' +
            '<td>' + (p.molecular_weight ? p.molecular_weight.toFixed(1) : 'N/A') + '</td>' +
            '<td>' + (p.structure_type || 'N/A') + '</td>' +
            '<td>' + (p.source_organism || 'N/A') + '</td>' +
            '<td><a href="' + url + '" class="btn-primary" style="padding:0.25rem 0.6rem;font-size:0.65rem;">View</a></td>' +
            '</tr>';
    }
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function displayCardView(container) {
    var html = '<div class="peptide-grid">';
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        var url = getPeptideUrl(p.id, p.peptide_name);
        html += '<div class="peptide-card" onclick="window.location.href=\'' + url + '\'" style="cursor:pointer;">' +
            '<div class="card-header"><h3>' + (p.peptide_name || 'Unnamed') + '</h3></div>' +
            '<div class="card-content">' +
                '<div class="card-row"><div class="card-label">Source:</div><div class="card-value">' + (p.source_organism || 'N/A') + '</div></div>' +
                '<div class="card-row"><div class="card-label">Length:</div><div class="card-value">' + (p.length || 'N/A') + ' aa</div></div>' +
                '<div class="card-row"><div class="card-label">MW:</div><div class="card-value">' + (p.molecular_weight ? p.molecular_weight.toFixed(1) : 'N/A') + ' Da</div></div>' +
                '<div class="card-row"><div class="card-label">Structure:</div><div class="card-value">' + (p.structure_type || 'N/A') + '</div></div>' +
                '<div class="card-row"><div class="card-label">Sequence:</div><div class="card-value" style="font-family:monospace;font-size:0.65rem;">' + (p.sequence_one_letter || 'N/A') + '</div></div>' +
            '</div>' +
        '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

function setView(view) {
    currentView = view;
    var btns = document.querySelectorAll('.toggle-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    if (view === 'table' && btns[0]) btns[0].classList.add('active');
    else if (view === 'card' && btns[1]) btns[1].classList.add('active');
    displayBrowseResults();
}

function sortBy(column) {
    if (sortColumn === column) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    else { sortColumn = column; sortDirection = 'asc'; }
    
    filteredPeptides.sort(function(a, b) {
        var valA = a[column];
        var valB = b[column];
        if (valA === undefined || valA === null || valA === '') valA = -Infinity;
        if (valB === undefined || valB === null || valB === '') valB = -Infinity;
        if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    displayBrowseResults();
}

// ========== PEPTIDE DETAIL PAGE ==========
function initPeptidePage() {
    var urlParams = new URLSearchParams(window.location.search);
    var peptideId = parseInt(urlParams.get('id'));
    
    var peptide = null;
    for (var i = 0; i < peptidesData.length; i++) {
        if (peptidesData[i].id === peptideId) {
            peptide = peptidesData[i];
            break;
        }
    }
    
    if (!peptide) {
        document.getElementById('peptideDetail').innerHTML = '<div class="error-message">Peptide not found<br><a href="browse.html" class="btn-primary">Browse Database</a></div>';
        return;
    }
    
    document.title = peptide.peptide_name + ' - BarrPeps';
    displayPeptideDetail(peptide);
}

function formatSequenceWithMods(seq) {
    if (!seq) return 'N/A';
    return seq
        .replace(/\(Me2\)/g, '<span class="modification" title="Dimethylated">(Me₂)</span>')
        .replace(/\(D\)/g, '<span class="modification" title="D-amino acid">(D)</span>')
        .replace(/\(NMe\)/g, '<span class="modification" title="N-methylated">(N-Me)</span>')
        .replace(/-NH2/g, '<span class="modification" title="Amidated">-NH₂</span>');
}

function displayPeptideDetail(peptide) {
    var modsHtml = 'N/A';
    if (peptide.modifications && peptide.modifications.length > 0) {
        var mods = '';
        for (var i = 0; i < peptide.modifications.length; i++) {
            mods += '<span class="modification">' + peptide.modifications[i] + '</span>';
            if (i < peptide.modifications.length - 1) mods += ', ';
        }
        modsHtml = mods;
    }
    
    var html = '<div class="peptide-detail-container">' +
        '<div style="margin-bottom:1rem;"><a href="browse.html" class="btn-secondary back-button">← Back to Browse</a>' +
        '<h1 style="color:#2c5282;">' + (peptide.peptide_name || 'N/A') + '</h1>' +
        '<p style="color:#718096;">ID: ' + peptide.id + '</p></div>' +
        
        '<div class="detail-section"><h3>Basic Information</h3>' +
        '<div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">' + (peptide.peptide_name || 'N/A') + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Sequence:</span><span class="detail-value" style="font-family:monospace;">' + formatSequenceWithMods(peptide.sequence_one_letter) + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Length:</span><span class="detail-value">' + (peptide.length || 'N/A') + ' aa</span></div>' +
        '<div class="detail-row"><span class="detail-label">MW:</span><span class="detail-value">' + (peptide.molecular_weight ? peptide.molecular_weight.toFixed(2) : 'N/A') + ' Da</span></div>' +
        '<div class="detail-row"><span class="detail-label">Formula:</span><span class="detail-value">' + (peptide.molecular_formula || 'N/A') + '</span></div></div>' +
        
        '<div class="detail-section"><h3>Structural Properties</h3>' +
        '<div class="detail-row"><span class="detail-label">Structure:</span><span class="detail-value">' + (peptide.structure_type || 'N/A') + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Disulfide:</span><span class="detail-value">' + (peptide.disulfide_bridge || 'N/A') + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Modifications:</span><span class="detail-value">' + modsHtml + '</span></div></div>' +
        
        '<div class="detail-section"><h3>Source</h3>' +
        '<div class="detail-row"><span class="detail-label">Organism:</span><span class="detail-value">' + (peptide.source_organism || 'N/A') + '</span></div></div>';
    
    if (peptide.transport_types && peptide.transport_types.length > 0) {
        html += '<div class="detail-section"><h3>Transport</h3>' +
            '<div class="detail-row"><span class="detail-label">Types:</span><span class="detail-value">' + peptide.transport_types.join(', ') + '</span></div></div>';
    }
    
    if (peptide.references && peptide.references.length > 0) {
        var refs = '';
        for (var i = 0; i < peptide.references.length; i++) {
            var r = peptide.references[i];
            refs += (r['authors'] || '') + ' (' + (r['year'] || '') + '). ' + (r['title'] || '') + '. ' + (r['journal'] || '') + '<br><br>';
        }
        html += '<div class="detail-section"><h3>References</h3><div class="detail-row"><span class="detail-value">' + refs + '</span></div></div>';
    }
    
    html += '</div>';
    document.getElementById('peptideDetail').innerHTML = html;
}

// ========== EXPORTS ==========
window.searchPeptides = applyFilters;
window.resetFilters = resetFilters;
window.setView = setView;
window.sortBy = sortBy;
window.applyAllFilters = applyFilters;
window.resetAllFilters = resetFilters;
window.downloadResults = downloadResults;
window.showUnderConstruction = showUnderConstruction;
window.closeModal = closeModal;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM ready, loading Excel...');
    if (typeof XLSX !== 'undefined') {
        loadExcelFile();
    } else {
        console.error('XLSX library not loaded');
        showError('XLSX library not loaded. Please check your internet connection.');
    }
});