// BarrPeps Database - Full Version with Fixed Table View and Filters

let peptidesData = [];
let experimentsData = [];
let referencesData = [];
let modificationsData = [];

let currentView = 'table';
let sortColumn = 'peptide_name';
let sortDirection = 'asc';
let filteredPeptides = [];
let selectedAAs = [];

// Chart instances
let lengthChart = null;
let aaChart = null;

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
    console.log('Loading database.xlsx...');
    
    fetch('database.xlsx')
        .then(function(response) {
            if (!response.ok) throw new Error('HTTP error: ' + response.status);
            return response.arrayBuffer();
        })
        .then(function(arrayBuffer) {
            var workbook = XLSX.read(arrayBuffer, { type: 'array' });
            var sheetNames = workbook.SheetNames;
            console.log('Sheets found:', sheetNames);
            
            for (var s = 0; s < sheetNames.length; s++) {
                var sheetName = sheetNames[s];
                var worksheet = workbook.Sheets[sheetName];
                var jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                var lowerName = sheetName.toLowerCase();
                if (lowerName === 'peptides') {
                    peptidesData = jsonData;
                    console.log('Peptides:', peptidesData.length);
                } else if (lowerName === 'experiments') {
                    experimentsData = jsonData;
                    console.log('Experiments:', experimentsData.length);
                } else if (lowerName === 'references') {
                    referencesData = jsonData;
                    console.log('References:', referencesData.length);
                } else if (lowerName === 'modifications') {
                    modificationsData = jsonData;
                    console.log('Modifications:', modificationsData.length);
                }
            }
            
            if (peptidesData.length === 0) {
                useFallbackData();
            } else {
                processAllData();
            }
        })
        .catch(function(error) {
            console.error('Error:', error);
            useFallbackData();
        });
}

function useFallbackData() {
    console.log('Using fallback data');
    peptidesData = [
        { peptide_id: 1, trivial_name: "ANG1005", sequence_1: "TFFYGGSRGKRNNFKTEEY", sequence_3: "ThrPhePheTyrGlyGlySerArgGlyLysArgAsnAsnPheLysThrGluGluTyr", length: 19, molecular_weight: 5110.41, origin: "synthetic", conformation: "Linear" },
        { peptide_id: 2, trivial_name: "Insulin", sequence_1: "GIVEQCCTSICSLYQLENYCN", sequence_3: "GlyIleValGluGlnCysCysThrSerIleCysSerLeuTyrGlnLeuGluAsnTyrCysAsn", length: 21, molecular_weight: 5807.57, origin: "human", conformation: "Linear" },
        { peptide_id: 3, trivial_name: "dynantin", sequence_1: "GGFLRRIRPK", sequence_3: "GlyGlyPheLeuArgArgIleArgProLys", length: 10, molecular_weight: 1388.71, origin: "synthetic", conformation: "Linear" }
    ];
    processAllData();
}

function processAllData() {
    // Build maps for related data
    var experimentsMap = {};
    for (var i = 0; i < experimentsData.length; i++) {
        var exp = experimentsData[i];
        var pid = exp['peptide_id'];
        if (pid) {
            if (!experimentsMap[pid]) experimentsMap[pid] = [];
            experimentsMap[pid].push(exp);
        }
    }
    
    var referencesMap = {};
    for (var i = 0; i < referencesData.length; i++) {
        var ref = referencesData[i];
        var pid = ref['peptide_id'];
        if (pid) {
            if (!referencesMap[pid]) referencesMap[pid] = [];
            referencesMap[pid].push(ref);
        }
    }
    
    var modificationsMap = {};
    for (var i = 0; i < modificationsData.length; i++) {
        var mod = modificationsData[i];
        var pid = mod['peptide_id'];
        if (pid) {
            if (!modificationsMap[pid]) modificationsMap[pid] = [];
            modificationsMap[pid].push(mod);
        }
    }
    
    // Build enhanced peptides
    var enhanced = [];
    for (var i = 0; i < peptidesData.length; i++) {
        var p = peptidesData[i];
        var pid = p['peptide_id'] || i + 1;
        var rawSeq = p['sequence_1'] || p['sequence_one_letter'] || '';
        var threeSeq = p['sequence_3'] || p['sequence_three_letter'] || '';
        var cleanSeq = rawSeq.replace(/\([^)]+\)/g, '').replace(/[^A-Za-z]/g, '');
        
        // Collect unique modifications (no duplicates)
        var uniqueMods = [];
        var seenMods = {};
        var modsForPeptide = modificationsMap[pid] || [];
        for (var m = 0; m < modsForPeptide.length; m++) {
            var modVal = modsForPeptide[m]['modifications'];
            if (modVal && !seenMods[modVal]) {
                seenMods[modVal] = true;
                uniqueMods.push(modVal);
            }
        }
        
        enhanced.push({
            id: pid,
            peptide_name: p['trivial_name'] || p['peptide_name'] || 'Peptide_' + pid,
            sequence_one_letter: rawSeq,
            sequence_clean: cleanSeq,
            sequence_three_letter: threeSeq,
            length: parseInt(p['length']) || cleanSeq.length,
            molecular_weight: parseFloat(p['molecular_weight']) || 0,
            molecular_formula: p['molecular_formula'] || '',
            structure_type: p['conformation'] || p['structure_type'] || 'N/A',
            disulfide_bridge: p['disulfide_bridge'] || '',
            nature: p['nature'] || '',
            source_organism: p['origin'] || p['source_organism'] || 'N/A',
            experiments: experimentsMap[pid] || [],
            references: referencesMap[pid] || [],
            modifications: uniqueMods,
            notes: p['notes'] || ''
        });
    }
    
    peptidesData = enhanced;
    filteredPeptides = [...peptidesData];
    console.log('Processed', peptidesData.length, 'peptides');
    
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
function calculateLengthDistribution() {
    var lengths = [];
    for (var p = 0; p < peptidesData.length; p++) {
        var l = peptidesData[p].length;
        if (l > 0) lengths.push(l);
    }
    if (lengths.length === 0) return {};
    
    var maxLength = Math.max.apply(null, lengths);
    var minLength = Math.min.apply(null, lengths);
    var binSize = 5;
    var bins = {};
    
    var startBin = Math.floor(minLength / binSize) * binSize;
    var endBin = Math.ceil(maxLength / binSize) * binSize;
    
    for (var i = startBin; i <= endBin; i += binSize) {
        var binLabel = i + '-' + (i + binSize);
        bins[binLabel] = 0;
    }
    
    for (var i = 0; i < lengths.length; i++) {
        var len = lengths[i];
        var binIndex = Math.floor(len / binSize) * binSize;
        var binLabel = binIndex + '-' + (binIndex + binSize);
        if (bins[binLabel] !== undefined) bins[binLabel]++;
    }
    
    var filtered = {};
    for (var label in bins) {
        if (bins[label] > 0) {
            filtered[label] = bins[label];
        }
    }
    return filtered;
}

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

function createLengthChart() {
    var ctx = document.getElementById('lengthChart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    var dist = calculateLengthDistribution();
    if (lengthChart) lengthChart.destroy();
    
    lengthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(dist),
            datasets: [{ 
                label: 'Number of Peptides', 
                data: Object.values(dist), 
                backgroundColor: 'rgba(66,153,225,0.7)', 
                borderColor: 'rgba(66,153,225,1)', 
                borderWidth: 1 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { 
                legend: { position: 'top' }
            },
            scales: { 
                y: { beginAtZero: true, title: { display: true, text: 'Count' }, ticks: { stepSize: 1, precision: 0 } }, 
                x: { title: { display: true, text: 'Length (amino acids)' } }
            }
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
            datasets: [{ 
                label: 'Frequency (%)', 
                data: Object.values(dist), 
                backgroundColor: '#4299e1', 
                borderColor: '#2c5282', 
                borderWidth: 1 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { 
                legend: { position: 'top' }
            },
            scales: { 
                y: { beginAtZero: true, title: { display: true, text: 'Frequency (%)' } }, 
                x: { title: { display: true, text: 'Amino Acid' } }
            }
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
            createAAChart();
        }
    }, 100);
}

function updateHomeStats() {
    var total = peptidesData.length;
    var sumLen = 0;
    for (var i = 0; i < peptidesData.length; i++) sumLen += peptidesData[i].length;
    var avgLen = total > 0 ? sumLen / total : 0;
    
    var totalEl = document.getElementById('totalPeptides');
    var avgLenEl = document.getElementById('avgLength');
    if (totalEl) totalEl.textContent = total;
    if (avgLenEl) avgLenEl.textContent = avgLen.toFixed(1);
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

// ========== BROWSE PAGE WITH FIXED TABLE VIEW ==========
function initBrowsePage() {
    filteredPeptides = [...peptidesData];
    updateBrowseStats();
    displayBrowseResults();
    setupBrowseEventListeners();
    initAASelector();
    initStructureSelector();
    initModificationSelector();
}

function setupBrowseEventListeners() {
    var inputs = ['searchInput', 'lengthMin', 'lengthMax', 'structureFilter', 'modFilter'];
    for (var i = 0; i < inputs.length; i++) {
        var el = document.getElementById(inputs[i]);
        if (el) {
            el.addEventListener('change', applyFilters);
            if (inputs[i] === 'searchInput') {
                el.addEventListener('keypress', function(e) { if (e.key === 'Enter') applyFilters(); });
            }
        }
    }
}

function initStructureSelector() {
    var structSelect = document.getElementById('structureFilter');
    if (!structSelect) return;
    
    var structTypes = {};
    for (var i = 0; i < peptidesData.length; i++) {
        var st = peptidesData[i].structure_type;
        if (st && st !== 'N/A' && st !== '') {
            structTypes[st] = true;
        }
    }
    
    while (structSelect.options.length > 1) {
        structSelect.remove(1);
    }
    
    for (var type in structTypes) {
        var option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        structSelect.appendChild(option);
    }
}

function initModificationSelector() {
    var modSelect = document.getElementById('modFilter');
    if (!modSelect) return;
    
    var modTypes = {};
    for (var i = 0; i < peptidesData.length; i++) {
        var mods = peptidesData[i].modifications;
        for (var j = 0; j < mods.length; j++) {
            var mod = mods[j];
            if (mod && mod !== 'N/A' && mod !== '') {
                modTypes[mod] = true;
            }
        }
    }
    
    while (modSelect.options.length > 1) {
        modSelect.remove(1);
    }
    
    for (var type in modTypes) {
        var option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        modSelect.appendChild(option);
    }
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
            applyFilters();
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
    if (modType === 'all' || !modType) return true;
    var mods = peptide.modifications || [];
    for (var i = 0; i < mods.length; i++) {
        if (mods[i] === modType) return true;
    }
    return false;
}

function applyFilters() {
    var searchTerm = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';
    var structType = document.getElementById('structureFilter') ? document.getElementById('structureFilter').value : 'all';
    var modType = document.getElementById('modFilter') ? document.getElementById('modFilter').value : 'all';
    var minLen = (document.getElementById('lengthMin') ? parseInt(document.getElementById('lengthMin').value) : 0) || 0;
    var maxLen = (document.getElementById('lengthMax') ? parseInt(document.getElementById('lengthMax').value) : 1000) || 1000;
    
    var result = [];
    for (var i = 0; i < peptidesData.length; i++) {
        var p = peptidesData[i];
        
        if (searchTerm) {
            var inName = p.peptide_name && p.peptide_name.toLowerCase().indexOf(searchTerm) !== -1;
            var inSeq = p.sequence_one_letter && p.sequence_one_letter.toLowerCase().indexOf(searchTerm) !== -1;
            var inSource = p.source_organism && p.source_organism.toLowerCase().indexOf(searchTerm) !== -1;
            if (!inName && !inSeq && !inSource) continue;
        }
        
        if (p.length < minLen || p.length > maxLen) continue;
        
        if (structType !== 'all' && p.structure_type !== structType) continue;
        
        if (selectedAAs.length > 0 && !containsAllAAs(p.sequence_clean || '', selectedAAs)) continue;
        
        if (!checkModification(p, modType)) continue;
        
        result.push(p);
    }
    
    filteredPeptides = result;
    updateBrowseStats();
    displayBrowseResults();
}

function resetFilters() {
    var searchInput = document.getElementById('searchInput');
    var lengthMin = document.getElementById('lengthMin');
    var lengthMax = document.getElementById('lengthMax');
    var structureFilter = document.getElementById('structureFilter');
    var modFilter = document.getElementById('modFilter');
    
    if (searchInput) searchInput.value = '';
    if (lengthMin) lengthMin.value = 0;
    if (lengthMax) lengthMax.value = 100;
    if (structureFilter) structureFilter.value = 'all';
    if (modFilter) modFilter.value = 'all';
    
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
    
    var headers = ['ID', 'Name', 'Sequence', 'Length', 'MW (Da)', 'Structure', 'Source'];
    var rows = [];
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        rows.push([p.id, p.peptide_name, p.sequence_one_letter, p.length, p.molecular_weight, p.structure_type, p.source_organism]);
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
    
    if (currentView === 'table') {
        displayTableView(container);
    } else {
        displayCardView(container);
    }
}

function displayTableView(container) {
    var html = '<div class="table-view">' +
        '<table>' +
            '<thead>' +
                '<tr>' +
                    '<th onclick="sortBy(\'peptide_name\')">Name</th>' +
                    '<th onclick="sortBy(\'sequence_one_letter\')">Sequence</th>' +
                    '<th onclick="sortBy(\'length\')">Length</th>' +
                    '<th onclick="sortBy(\'molecular_weight\')">MW (Da)</th>' +
                    '<th onclick="sortBy(\'structure_type\')">Structure</th>' +
                    '<th onclick="sortBy(\'source_organism\')">Source</th>' +
                    '<th>Details</th>' +
                '</tr>' +
            '</thead>' +
            '<tbody>';
    
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        var seqShort = p.sequence_one_letter ? 
            (p.sequence_one_letter.length > 30 ? p.sequence_one_letter.substring(0,30) + '...' : p.sequence_one_letter) : 'N/A';
        var url = getPeptideUrl(p.id, p.peptide_name);
        
        html += '<tr>' +
            '<td style="padding: 0.7rem 0.5rem;"><a href="' + url + '" style="color:#2c5282;font-weight:bold;">' + (p.peptide_name || 'N/A') + '</a></td>' +
            '<td style="font-family:monospace;font-size:0.65rem;">' + seqShort + '</td>' +
            '<td>' + (p.length || 'N/A') + '</td>' +
            '<td>' + (p.molecular_weight ? p.molecular_weight.toFixed(1) : 'N/A') + '</td>' +
            '<td>' + (p.structure_type || 'N/A') + '</td>' +
            '<td>' + (p.source_organism || 'N/A') + '</td>' +
            '<td><a href="' + url + '" class="btn-primary" style="padding:0.25rem 0.6rem;font-size:0.65rem;text-decoration:none;">View</a></td>' +
        '</tr>';
    }
    
    html += '</tbody>' +
        '</table>' +
    '</div>';
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
            '</div>' +
        '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

function setView(view) {
    currentView = view;
    var btns = document.querySelectorAll('.toggle-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('active');
    }
    if (view === 'table' && btns[0]) {
        btns[0].classList.add('active');
    } else if (view === 'card' && btns[1]) {
        btns[1].classList.add('active');
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
    
    filteredPeptides.sort(function(a, b) {
        var valA = a[column];
        var valB = b[column];
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

function formatResultWithUnit(exp) {
    var result = exp['result'];
    var unit = exp['unit'];
    if (result !== undefined && result !== null && result !== '') {
        return result + (unit ? ' ' + unit : '');
    }
    return null;
}

function displayPeptideDetail(peptide) {
    var modsHtml = '';
    if (peptide.modifications && peptide.modifications.length > 0) {
        modsHtml = '<div class="detail-section"><h3>Modifications</h3>' +
            '<div class="detail-row"><span class="detail-value">' + peptide.modifications.join(', ') + '</span></div>' +
            '</div>';
    }
    
    var experimentsHtml = '';
    if (peptide.experiments && peptide.experiments.length > 0) {
        for (var i = 0; i < Math.min(peptide.experiments.length, 5); i++) {
            var exp = peptide.experiments[i];
            var expHtml = '<div class="experiment-item" style="margin-bottom:0.75rem;padding:0.5rem;background:#f0f4f8;border-radius:6px;">';
            if (exp['method']) expHtml += '<div><strong>Method:</strong> ' + exp['method'] + '</div>';
            if (exp['method_type']) expHtml += '<div><strong>Type:</strong> ' + exp['method_type'] + '</div>';
            if (exp['response']) expHtml += '<div><strong>Response:</strong> ' + exp['response'] + '</div>';
            var resWithUnit = formatResultWithUnit(exp);
            if (resWithUnit) expHtml += '<div><strong>Result:</strong> ' + resWithUnit + '</div>';
            if (exp['transport_type']) expHtml += '<div><strong>Transport:</strong> ' + exp['transport_type'] + '</div>';
            expHtml += '</div>';
            experimentsHtml += expHtml;
        }
    }
    
    if (experimentsHtml === '') {
        experimentsHtml = '<div class="detail-section"><div class="detail-row"><span class="detail-value">No experimental data available</span></div></div>';
    } else {
        experimentsHtml = '<div class="detail-section"><h3>Experimental Data</h3>' + experimentsHtml + '</div>';
    }
    
    var html = '<div class="peptide-detail-container">' +
        '<div style="margin-bottom:1rem;">' +
            '<a href="browse.html" class="btn-secondary back-button">← Back to Browse</a>' +
            '<h1 style="color:#2c5282; margin-top:0.5rem;">' + (peptide.peptide_name || 'N/A') + '</h1>' +
            '<p style="color:#718096;">ID: ' + peptide.id + '</p>' +
        '</div>' +
        
        '<div class="detail-section"><h3>Basic Information</h3>' +
            '<div class="detail-row"><span class="detail-label">Sequence:</span><span class="detail-value" style="font-family:monospace;word-break:break-all;">' + formatSequenceWithMods(peptide.sequence_one_letter) + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Clean Sequence:</span><span class="detail-value" style="font-family:monospace;">' + (peptide.sequence_clean || 'N/A') + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">3-Letter Seq:</span><span class="detail-value">' + (peptide.sequence_three_letter || 'N/A') + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Length:</span><span class="detail-value">' + (peptide.length || 'N/A') + ' aa</span></div>' +
            '<div class="detail-row"><span class="detail-label">MW:</span><span class="detail-value">' + (peptide.molecular_weight ? peptide.molecular_weight.toFixed(2) : 'N/A') + ' Da</span></div>' +
            (peptide.molecular_formula ? '<div class="detail-row"><span class="detail-label">Formula:</span><span class="detail-value">' + peptide.molecular_formula + '</span></div>' : '') +
        '</div>' +
        
        (peptide.structure_type && peptide.structure_type !== 'N/A' ? 
            '<div class="detail-section"><h3>Structural Properties</h3>' +
                '<div class="detail-row"><span class="detail-label">Structure:</span><span class="detail-value">' + peptide.structure_type + '</span></div>' +
                (peptide.disulfide_bridge ? '<div class="detail-row"><span class="detail-label">Disulfide:</span><span class="detail-value">' + peptide.disulfide_bridge + '</span></div>' : '') +
            '</div>' : '') +
        
        (peptide.source_organism && peptide.source_organism !== 'N/A' ? 
            '<div class="detail-section"><h3>Source</h3>' +
                '<div class="detail-row"><span class="detail-label">Organism:</span><span class="detail-value">' + peptide.source_organism + '</span></div>' +
            '</div>' : '') +
        
        modsHtml +
        experimentsHtml +
        
        (peptide.notes ? 
            '<div class="detail-section"><h3>Notes</h3>' +
                '<div class="detail-row"><span class="detail-value">' + peptide.notes + '</span></div>' +
            '</div>' : '') +
    '</div>';
    
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
    console.log('DOM ready');
    if (typeof XLSX !== 'undefined') {
        loadExcelFile();
    } else {
        console.warn('XLSX not available, using fallback');
        useFallbackData();
    }
});