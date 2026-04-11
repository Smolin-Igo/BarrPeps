// BarrPeps Database - Main JavaScript
// Direct Excel file reader using SheetJS - reads all 4 sheets

let peptidesData = [];
let experimentsData = [];
let referencesData = [];
let modificationsData = [];

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

// ========== EXCEL FILE LOADER - ALL SHEETS ==========
async function loadExcelData() {
    // Check if XLSX library is loaded
    if (typeof XLSX === 'undefined') {
        console.log('Waiting for SheetJS library to load...');
        // Wait a bit and try again
        setTimeout(loadExcelData, 500);
        return;
    }
    
    try {
        console.log('Loading Excel file: database.xlsx');
        
        const response = await fetch('database.xlsx');
        if (!response.ok) {
            throw new Error('HTTP error! status: ' + response.status);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Load all sheets
        const sheets = workbook.SheetNames;
        console.log('Sheets found:', sheets);
        
        for (let s = 0; s < sheets.length; s++) {
            const sheetName = sheets[s];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            const sheetLower = sheetName.toLowerCase();
            if (sheetLower === 'peptides') {
                peptidesData = data;
                console.log('Loaded ' + peptidesData.length + ' peptides');
            } else if (sheetLower === 'experiments') {
                experimentsData = data;
                console.log('Loaded ' + experimentsData.length + ' experiments');
            } else if (sheetLower === 'references') {
                referencesData = data;
                console.log('Loaded ' + referencesData.length + ' references');
            } else if (sheetLower === 'modifications') {
                modificationsData = data;
                console.log('Loaded ' + modificationsData.length + ' modifications');
            }
        }
        
        // Process and merge data
        processAllData();
        
    } catch (error) {
        console.error('Error loading Excel:', error);
        var errorHtml = '<div class="error-message">' +
            '<p>Error loading database.xlsx: ' + error.message + '</p>' +
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
}

function formatSequenceWithModifications(sequence) {
    if (!sequence) return 'N/A';
    
    var formatted = sequence
        .replace(/\(Me2\)/g, '<span class="modification" title="Dimethylated">(Me₂)</span>')
        .replace(/\(D\)/g, '<span class="modification" title="D-amino acid">(D)</span>')
        .replace(/\(NMe\)/g, '<span class="modification" title="N-methylated">(N-Me)</span>')
        .replace(/-NH2/g, '<span class="modification" title="Amidated">-NH₂</span>')
        .replace(/\(NαMe\)/g, '<span class="modification" title="N-alpha-methylated">(Nα-Me)</span>')
        .replace(/\(3,4-dehydro\)/g, '<span class="modification" title="Dehydro">(3,4-dehydro)</span>')
        .replace(/\(2\'-N-succinimide-paclitaxel\)/g, '<span class="modification" title="Paclitaxel conjugated">(Paclitaxel)</span>')
        .replace(/\(Ac\)/g, '<span class="modification" title="Acetylated">(Ac)</span>')
        .replace(/\(Pen\)/g, '<span class="modification" title="Penicillamine">(Pen)</span>');
    
    return formatted;
}

function getModificationsForPeptide(peptideId) {
    if (!modificationsData || modificationsData.length === 0) return [];
    var result = [];
    for (var i = 0; i < modificationsData.length; i++) {
        if (modificationsData[i]['peptide_id'] === peptideId) {
            result.push(modificationsData[i]);
        }
    }
    return result;
}

function getReferencesForPeptide(peptideId) {
    if (!referencesData || referencesData.length === 0) return [];
    var result = [];
    for (var i = 0; i < referencesData.length; i++) {
        if (referencesData[i]['peptide_id'] === peptideId) {
            result.push(referencesData[i]);
        }
    }
    return result;
}

function getExperimentsForPeptide(peptideId) {
    if (!experimentsData || experimentsData.length === 0) return [];
    var result = [];
    for (var i = 0; i < experimentsData.length; i++) {
        if (experimentsData[i]['peptide_id'] === peptideId) {
            result.push(experimentsData[i]);
        }
    }
    return result;
}

function processAllData() {
    // Build enhanced peptide objects with all related data
    var enhancedPeptides = [];
    
    for (var idx = 0; idx < peptidesData.length; idx++) {
        var peptide = peptidesData[idx];
        var peptideId = peptide['peptide_id'] || idx + 1;
        var modifications = getModificationsForPeptide(peptideId);
        var references = getReferencesForPeptide(peptideId);
        var experiments = getExperimentsForPeptide(peptideId);
        
        // Collect unique transport types from experiments
        var transportTypes = [];
        var seenTypes = {};
        for (var i = 0; i < experiments.length; i++) {
            var t = experiments[i]['transport_type'];
            if (t && !seenTypes[t]) {
                seenTypes[t] = true;
                transportTypes.push(t);
            }
        }
        
        // Collect modification types
        var modTypes = [];
        var seenMods = {};
        for (var i = 0; i < modifications.length; i++) {
            var m = modifications[i]['modifications'];
            if (m && !seenMods[m]) {
                seenMods[m] = true;
                modTypes.push(m);
            }
        }
        
        // Find best reference
        var primaryRef = null;
        for (var i = 0; i < references.length; i++) {
            if (references[i]['source_ref_id'] && references[i]['authors']) {
                primaryRef = references[i];
                break;
            }
        }
        if (!primaryRef && references.length > 0) {
            primaryRef = references[0];
        }
        
        var enhancedPeptide = {
            id: peptideId,
            peptide_name: peptide['trivial_name'] || peptide['peptide_name'] || 'Peptide_' + peptideId,
            sequence_one_letter: peptide['sequence_1'] || peptide['sequence_one_letter'] || '',
            sequence_three_letter: peptide['sequence_3'] || peptide['sequence_three_letter'] || '',
            length: parseInt(peptide['length']) || 0,
            molecular_weight: parseFloat(peptide['molecular_weight']) || 0,
            molecular_formula: peptide['molecular_formula'] || '',
            net_charge: null,
            hydrophobicity: null,
            structure_type: peptide['conformation'] || peptide['structure_type'] || '',
            source_organism: peptide['origin'] || peptide['source_organism'] || '',
            disulfide_bridge: peptide['disulfide_bridge'] || '',
            nature: peptide['nature'] || '',
            
            // Related data from other sheets
            modifications: modTypes,
            modifications_detail: modifications,
            references: references,
            experiments: experiments,
            transport_types: transportTypes,
            
            // Literature info
            authors: primaryRef ? primaryRef['authors'] : '',
            title: primaryRef ? primaryRef['title'] : '',
            year: primaryRef ? primaryRef['year'] : '',
            journal: primaryRef ? primaryRef['journal'] : '',
            
            // Legacy fields for compatibility
            notes: peptide['disulfide_bridge'] ? 'Disulfide bridges: ' + peptide['disulfide_bridge'] : '',
            PDB: null
        };
        
        enhancedPeptides.push(enhancedPeptide);
    }
    
    peptidesData = enhancedPeptides;
    filteredPeptides = [];
    for (var i = 0; i < peptidesData.length; i++) {
        filteredPeptides.push(peptidesData[i]);
    }
    
    console.log('Processed ' + peptidesData.length + ' peptides with all related data');
    
    var currentPage = window.location.pathname.split('/').pop();
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
    var aaCounts = {
        'A': 0, 'R': 0, 'N': 0, 'D': 0, 'C': 0, 'Q': 0, 'E': 0, 'G': 0,
        'H': 0, 'I': 0, 'L': 0, 'K': 0, 'M': 0, 'F': 0, 'P': 0, 'S': 0,
        'T': 0, 'W': 0, 'Y': 0, 'V': 0
    };
    
    var totalAAs = 0;
    
    for (var p = 0; p < peptidesData.length; p++) {
        var seq = peptidesData[p].sequence_one_letter || '';
        for (var i = 0; i < seq.length; i++) {
            var aa = seq[i];
            if (aaCounts[aa] !== undefined) {
                aaCounts[aa]++;
                totalAAs++;
            }
        }
    }
    
    var aaPercentages = {};
    for (var aa in aaCounts) {
        aaPercentages[aa] = totalAAs > 0 ? (aaCounts[aa] / totalAAs * 100).toFixed(1) : 0;
    }
    
    return aaPercentages;
}

function calculateLengthDistribution() {
    var lengths = [];
    for (var p = 0; p < peptidesData.length; p++) {
        var l = peptidesData[p].length;
        if (l > 0) lengths.push(l);
    }
    
    if (lengths.length === 0) return {};
    
    var maxLength = lengths[0];
    for (var i = 1; i < lengths.length; i++) {
        if (lengths[i] > maxLength) maxLength = lengths[i];
    }
    
    var binSize = 10;
    var bins = {};
    
    for (var i = 0; i <= maxLength + binSize; i += binSize) {
        var binStart = i;
        var binEnd = i + binSize;
        var binLabel = binStart + '-' + binEnd;
        bins[binLabel] = 0;
    }
    
    for (var i = 0; i < lengths.length; i++) {
        var length = lengths[i];
        var binIndex = Math.floor(length / binSize);
        var binStart = binIndex * binSize;
        var binLabel = binStart + '-' + (binStart + binSize);
        bins[binLabel]++;
    }
    
    var filteredBins = {};
    var hasData = false;
    for (var label in bins) {
        if (bins[label] > 0) hasData = true;
        if (hasData || bins[label] > 0) {
            filteredBins[label] = bins[label];
        }
    }
    
    return filteredBins;
}

function calculateChargeDistribution() {
    var charges = [];
    for (var p = 0; p < peptidesData.length; p++) {
        var c = peptidesData[p].net_charge;
        if (c !== null && c !== '') charges.push(c);
    }
    
    var chargeCounts = {};
    for (var i = 0; i < charges.length; i++) {
        var charge = charges[i];
        var roundedCharge = Math.round(charge);
        var key = roundedCharge >= 0 ? '+' + roundedCharge : '' + roundedCharge;
        if (chargeCounts[key] === undefined) {
            chargeCounts[key] = 0;
        }
        chargeCounts[key]++;
    }
    
    var sortedKeys = Object.keys(chargeCounts).sort(function(a, b) {
        var numA = parseInt(a) || 0;
        var numB = parseInt(b) || 0;
        return numA - numB;
    });
    
    var sortedCounts = {};
    for (var i = 0; i < sortedKeys.length; i++) {
        var key = sortedKeys[i];
        sortedCounts[key] = chargeCounts[key];
    }
    
    return sortedCounts;
}

function createLengthChart() {
    var ctx = document.getElementById('lengthChart');
    if (!ctx) return;
    
    var distribution = calculateLengthDistribution();
    var labels = Object.keys(distribution);
    var data = Object.values(distribution);
    
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
                tooltip: { callbacks: { label: function(context) { return context.raw + ' peptides'; } } }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Count', font: { size: 10 } }, ticks: { stepSize: 1, font: { size: 9 } } },
                x: { title: { display: true, text: 'Length (amino acids)', font: { size: 10 } }, ticks: { font: { size: 8 }, rotation: 45 } }
            }
        }
    });
}

function createChargeChart() {
    var ctx = document.getElementById('chargeChart');
    if (!ctx) return;
    
    var distribution = calculateChargeDistribution();
    var labels = Object.keys(distribution);
    var data = Object.values(distribution);
    
    if (chargeChart) chargeChart.destroy();
    
    var backgroundColors = [];
    for (var i = 0; i < labels.length; i++) {
        var val = parseInt(labels[i]);
        if (val > 0) backgroundColors.push('rgba(66, 153, 225, 0.7)');
        else if (val < 0) backgroundColors.push('rgba(245, 101, 101, 0.7)');
        else backgroundColors.push('rgba(160, 174, 192, 0.7)');
    }
    
    chargeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Peptides',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(function(c) { return c.replace('0.7', '1'); }),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 10 } } },
                tooltip: { callbacks: { label: function(context) { return context.raw + ' peptides'; } } }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Count', font: { size: 10 } }, ticks: { stepSize: 1, font: { size: 9 } } },
                x: { title: { display: true, text: 'Net Charge', font: { size: 10 } }, ticks: { font: { size: 9 } } }
            }
        }
    });
}

function createAAChart() {
    var ctx = document.getElementById('aaChart');
    if (!ctx) return;
    
    var distribution = calculateAADistribution();
    var labels = Object.keys(distribution);
    var data = Object.values(distribution);
    
    if (aaChart) aaChart.destroy();
    
    var colors = ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f56565', '#38b2ac', '#ecc94b', '#ed64a6', '#a0aec0', '#4a5568'];
    
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
                tooltip: { callbacks: { label: function(context) { return context.raw + '% of all residues'; } } }
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
    
    setTimeout(function() {
        if (peptidesData.length > 0) {
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
    var sumCharge = 0;
    var chargeCount = 0;
    for (var i = 0; i < peptidesData.length; i++) {
        sumLength += peptidesData[i].length;
        if (peptidesData[i].net_charge !== null) {
            sumCharge += parseFloat(peptidesData[i].net_charge) || 0;
            chargeCount++;
        }
    }
    
    var avgLength = sumLength / total;
    var avgCharge = chargeCount > 0 ? sumCharge / chargeCount : 0;
    
    var totalEl = document.getElementById('totalPeptides');
    var avgLengthEl = document.getElementById('avgLength');
    var avgChargeEl = document.getElementById('avgCharge');
    
    if (totalEl) totalEl.textContent = total;
    if (avgLengthEl) avgLengthEl.textContent = avgLength.toFixed(1);
    if (avgChargeEl) avgChargeEl.textContent = avgCharge.toFixed(1);
}

function displayFeaturedPeptides() {
    var container = document.getElementById('featuredPeptides');
    if (!container) return;
    
    var featured = [];
    for (var i = 0; i < Math.min(peptidesData.length, 6); i++) {
        featured.push(peptidesData[i]);
    }
    
    if (featured.length === 0) {
        container.innerHTML = '<div class="loading">No peptides found in database</div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < featured.length; i++) {
        var peptide = featured[i];
        var peptideUrl = getPeptideUrl(peptide.id, peptide.peptide_name);
        
        html += '<div class="peptide-card" onclick="window.location.href=\'' + peptideUrl + '\'" style="cursor: pointer;">' +
            '<div class="card-header">' +
                '<h3 style="color: #2c5282;">' + (peptide.peptide_name || 'Unnamed Peptide') + '</h3>' +
            '</div>' +
            '<div class="card-content">' +
                '<div class="card-row">' +
                    '<div class="card-label">Source:</div>' +
                    '<div class="card-value">' + (peptide.source_organism || 'N/A') + '</div>' +
                '</div>' +
                '<div class="card-row">' +
                    '<div class="card-label">Length / MW:</div>' +
                    '<div class="card-value">' + (peptide.length || 'N/A') + ' aa / ' + (peptide.molecular_weight ? peptide.molecular_weight.toFixed(1) : 'N/A') + ' Da</div>' +
                '</div>' +
                '<div class="card-row">' +
                    '<div class="card-label">Structure:</div>' +
                    '<div class="card-value">' + (peptide.structure_type || 'N/A') + '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }
    
    container.innerHTML = html;
}

// ========== BROWSE PAGE ==========

function initBrowsePage() {
    console.log('Initializing browse page');
    filteredPeptides = [];
    for (var i = 0; i < peptidesData.length; i++) {
        filteredPeptides.push(peptidesData[i]);
    }
    updateBrowseStats();
    displayBrowseResults();
    setupBrowseEventListeners();
    initAASelector();
}

function setupBrowseEventListeners() {
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                applyAllFilters();
            }
        });
    }
}

function updateBrowseStats() {
    var count = filteredPeptides.length;
    var countElement = document.getElementById('resultsCount');
    if (countElement) countElement.textContent = 'Found peptides: ' + count;
}

function initAASelector() {
    var buttons = document.querySelectorAll('.aa-btn-compact');
    for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        btn.addEventListener('click', function() {
            var aa = this.getAttribute('data-aa');
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                var newSelected = [];
                for (var j = 0; j < selectedAAs.length; j++) {
                    if (selectedAAs[j] !== aa) newSelected.push(selectedAAs[j]);
                }
                selectedAAs = newSelected;
            } else {
                this.classList.add('selected');
                selectedAAs.push(aa);
            }
        });
    }
}

function containsAllAAs(sequence, requiredAAs) {
    if (!requiredAAs || requiredAAs.length === 0) return true;
    for (var i = 0; i < requiredAAs.length; i++) {
        if (sequence.indexOf(requiredAAs[i]) === -1) return false;
    }
    return true;
}

function checkModification(peptide, modType) {
    var notes = (peptide.notes || '').toLowerCase();
    var name = (peptide.peptide_name || '').toLowerCase();
    var sequence = (peptide.sequence_one_letter || '').toLowerCase();
    var mods = peptide.modifications || [];
    
    switch(modType) {
        case 'amidation': 
            if (notes.indexOf('amid') !== -1) return true;
            if (name.indexOf('amid') !== -1) return true;
            if (sequence.indexOf('nh2') !== -1) return true;
            for (var i = 0; i < mods.length; i++) {
                if (mods[i].toLowerCase().indexOf('amid') !== -1) return true;
            }
            return false;
        case 'acylation': 
            if (notes.indexOf('acyl') !== -1) return true;
            if (name.indexOf('acyl') !== -1) return true;
            for (var i = 0; i < mods.length; i++) {
                if (mods[i].toLowerCase().indexOf('acyl') !== -1) return true;
            }
            return false;
        case 'cyclization': 
            if (notes.indexOf('cycl') !== -1) return true;
            if (notes.indexOf('cyclic') !== -1) return true;
            for (var i = 0; i < mods.length; i++) {
                if (mods[i].toLowerCase().indexOf('cycl') !== -1) return true;
            }
            return false;
        case 'glycosylation': 
            if (notes.indexOf('glyco') !== -1) return true;
            for (var i = 0; i < mods.length; i++) {
                if (mods[i].toLowerCase().indexOf('glyco') !== -1) return true;
            }
            return false;
        case 'phosphorylation': 
            if (notes.indexOf('phospho') !== -1) return true;
            for (var i = 0; i < mods.length; i++) {
                if (mods[i].toLowerCase().indexOf('phospho') !== -1) return true;
            }
            return false;
        case 'methylated': 
            if (notes.indexOf('methyl') !== -1) return true;
            if (sequence.indexOf('me') !== -1) return true;
            if (sequence.indexOf('nme') !== -1) return true;
            for (var i = 0; i < mods.length; i++) {
                if (mods[i].toLowerCase().indexOf('methyl') !== -1) return true;
            }
            return false;
        case 'acetylated': 
            if (notes.indexOf('acetyl') !== -1) return true;
            if (sequence.indexOf('ac') !== -1) return true;
            for (var i = 0; i < mods.length; i++) {
                if (mods[i].toLowerCase().indexOf('acetyl') !== -1) return true;
            }
            return false;
        default: 
            return true;
    }
}

function applyAllFilters() {
    var searchInput = document.getElementById('searchInput');
    var structureFilter = document.getElementById('structureFilter');
    var lengthMin = document.getElementById('lengthMin');
    var lengthMax = document.getElementById('lengthMax');
    var modFilter = document.getElementById('modFilter');
    
    var searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    var structureType = structureFilter ? structureFilter.value : 'all';
    var minLen = (lengthMin ? parseInt(lengthMin.value) : 0) || 0;
    var maxLen = (lengthMax ? parseInt(lengthMax.value) : 100) || 1000;
    var modType = modFilter ? modFilter.value : 'all';
    
    var tempFiltered = [];
    for (var i = 0; i < peptidesData.length; i++) {
        tempFiltered.push(peptidesData[i]);
    }
    
    // Search filter
    if (searchTerm) {
        var newFiltered = [];
        for (var i = 0; i < tempFiltered.length; i++) {
            var p = tempFiltered[i];
            var inName = p.peptide_name && p.peptide_name.toLowerCase().indexOf(searchTerm) !== -1;
            var inSeq = p.sequence_one_letter && p.sequence_one_letter.toLowerCase().indexOf(searchTerm) !== -1;
            var inSource = p.source_organism && p.source_organism.toLowerCase().indexOf(searchTerm) !== -1;
            if (inName || inSeq || inSource) {
                newFiltered.push(p);
            }
        }
        tempFiltered = newFiltered;
    }
    
    // Length filter
    var lengthFiltered = [];
    for (var i = 0; i < tempFiltered.length; i++) {
        var p = tempFiltered[i];
        if (p.length >= minLen && p.length <= maxLen) {
            lengthFiltered.push(p);
        }
    }
    tempFiltered = lengthFiltered;
    
    // Structure filter
    if (structureType !== 'all') {
        var structFiltered = [];
        for (var i = 0; i < tempFiltered.length; i++) {
            var p = tempFiltered[i];
            if ((p.structure_type || '').toLowerCase() === structureType.toLowerCase()) {
                structFiltered.push(p);
            }
        }
        tempFiltered = structFiltered;
    }
    
    // Amino acid filter
    if (selectedAAs.length > 0) {
        var aaFiltered = [];
        for (var i = 0; i < tempFiltered.length; i++) {
            var p = tempFiltered[i];
            if (containsAllAAs(p.sequence_one_letter || '', selectedAAs)) {
                aaFiltered.push(p);
            }
        }
        tempFiltered = aaFiltered;
    }
    
    // Modification filter
    if (modType !== 'all') {
        var modFiltered = [];
        for (var i = 0; i < tempFiltered.length; i++) {
            var p = tempFiltered[i];
            if (checkModification(p, modType)) {
                modFiltered.push(p);
            }
        }
        tempFiltered = modFiltered;
    }
    
    filteredPeptides = tempFiltered;
    updateBrowseStats();
    displayBrowseResults();
}

function resetAllFilters() {
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
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('selected');
    }
    
    filteredPeptides = [];
    for (var i = 0; i < peptidesData.length; i++) {
        filteredPeptides.push(peptidesData[i]);
    }
    updateBrowseStats();
    displayBrowseResults();
}

function downloadResults() {
    if (filteredPeptides.length === 0) {
        alert('No results to download');
        return;
    }
    
    var headers = ['ID', 'Peptide Name', 'Sequence', 'Length', 'MW (Da)', 'Molecular Formula', 'Structure Type', 'Source Organism', 'Disulfide Bridges', 'Modifications', 'Transport Types'];
    
    var rows = [];
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        rows.push([
            p.id || '',
            p.peptide_name || '',
            p.sequence_one_letter || '',
            p.length || '',
            p.molecular_weight || '',
            p.molecular_formula || '',
            p.structure_type || '',
            p.source_organism || '',
            p.disulfide_bridge || '',
            (p.modifications || []).join('; '),
            (p.transport_types || []).join('; ')
        ]);
    }
    
    var csvContent = '';
    for (var i = 0; i < headers.length; i++) {
        csvContent += (i > 0 ? ',' : '') + '"' + headers[i] + '"';
    }
    csvContent += '\n';
    
    for (var i = 0; i < rows.length; i++) {
        for (var j = 0; j < rows[i].length; j++) {
            csvContent += (j > 0 ? ',' : '') + '"' + String(rows[i][j]).replace(/"/g, '""') + '"';
        }
        csvContent += '\n';
    }
    
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    var url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'barrpeps_results_' + new Date().toISOString().slice(0,19).replace(/:/g, '-') + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function displayBrowseResults() {
    var container = document.getElementById('resultsContainer');
    if (!container) return;
    
    var count = filteredPeptides.length;
    
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
    var html = '<div class="table-view">' +
        '<table>' +
            '<thead>' +
                <tr>' +
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
        var peptide = filteredPeptides[i];
        var sequenceDisplay = peptide.sequence_one_letter ? 
            (peptide.sequence_one_letter.length > 30 ? 
                peptide.sequence_one_letter.substring(0, 30) + '...' : 
                peptide.sequence_one_letter) : 'N/A';
        
        var peptideUrl = getPeptideUrl(peptide.id, peptide.peptide_name);
        
        html += '<tr>' +
            '<td style="padding: 0.7rem 0.5rem;">' +
                '<a href="' + peptideUrl + '" style="text-decoration: none; color: #2c5282; font-weight: bold;">' + (peptide.peptide_name || 'N/A') + '</a>' +
            '</td>' +
            '<td style="font-family: monospace; font-size: 0.65rem;">' + sequenceDisplay + '</td>' +
            '<td>' + (peptide.length || 'N/A') + '</td>' +
            '<td>' + (peptide.molecular_weight ? peptide.molecular_weight.toFixed(1) : 'N/A') + '</td>' +
            '<td>' + (peptide.structure_type || 'N/A') + '</td>' +
            '<td>' + (peptide.source_organism || 'N/A') + '</td>' +
            '<td><a href="' + peptideUrl + '" class="btn-primary" style="padding: 0.25rem 0.6rem; font-size: 0.65rem; text-decoration: none;">View</a></td>' +
        '</tr>';
    }
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function displayCardBrowseView(container) {
    var html = '<div class="peptide-grid">';
    
    for (var i = 0; i < filteredPeptides.length; i++) {
        var peptide = filteredPeptides[i];
        var peptideUrl = getPeptideUrl(peptide.id, peptide.peptide_name);
        
        html += '<div class="peptide-card" onclick="window.location.href=\'' + peptideUrl + '\'" style="cursor: pointer;">' +
            '<div class="card-header">' +
                '<h3 style="color: #2c5282;">' + (peptide.peptide_name || 'Unnamed Peptide') + '</h3>' +
            '</div>' +
            '<div class="card-content">' +
                '<div class="card-row">' +
                    '<div class="card-label">Source:</div>' +
                    '<div class="card-value">' + (peptide.source_organism || 'N/A') + '</div>' +
                '</div>' +
                '<div class="card-row">' +
                    '<div class="card-label">Length / MW:</div>' +
                    '<div class="card-value">' + (peptide.length || 'N/A') + ' aa / ' + (peptide.molecular_weight ? peptide.molecular_weight.toFixed(1) : 'N/A') + ' Da</div>' +
                '</div>' +
                '<div class="card-row">' +
                    '<div class="card-label">Structure:</div>' +
                    '<div class="card-value">' + (peptide.structure_type || 'N/A') + '</div>' +
                '</div>' +
                '<div class="card-row">' +
                    '<div class="card-label">Sequence:</div>' +
                    '<div class="card-value" style="font-family: monospace; font-size: 0.65rem; word-break: break-all;">' + (peptide.sequence_one_letter || 'N/A') + '</div>' +
                '</div>' +
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
    console.log('Initializing peptide page');
    
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
        var detailContainer = document.getElementById('peptideDetail');
        if (detailContainer) {
            detailContainer.innerHTML = '<div class="error-message">' +
                '<p>Peptide not found</p>' +
                '<a href="browse.html" class="btn-primary">Browse Database</a>' +
                '</div>';
        }
        return;
    }
    
    document.title = peptide.peptide_name + ' - BarrPeps Database';
    
    displayPeptideDetail(peptide);
}

function formatReferenceList(references) {
    if (!references || references.length === 0) return 'N/A';
    
    var result = '';
    for (var i = 0; i < references.length; i++) {
        var ref = references[i];
        var authors = ref['authors'] || '';
        var year = ref['year'] || '';
        var journal = ref['journal'] || '';
        var title = ref['title'] || '';
        
        if (authors && year && journal) {
            result += authors + ' (' + year + '). ' + title + '. ' + journal + '.';
        } else if (authors && year) {
            result += authors + ' (' + year + '). ' + (title || '');
        } else {
            result += title || 'Reference';
        }
        if (i < references.length - 1) result += '<br><br>';
    }
    return result;
}

function formatExperiments(experiments) {
    if (!experiments || experiments.length === 0) return 'N/A';
    
    var uniqueExperiments = [];
    var seen = {};
    
    for (var i = 0; i < experiments.length; i++) {
        var exp = experiments[i];
        var key = exp['method'] + '_' + exp['response'] + '_' + exp['result'];
        if (!seen[key]) {
            seen[key] = true;
            uniqueExperiments.push(exp);
        }
    }
    
    var result = '';
    var limit = Math.min(uniqueExperiments.length, 10);
    for (var i = 0; i < limit; i++) {
        var exp = uniqueExperiments[i];
        var method = exp['method'] || 'N/A';
        var response = exp['response'] || 'N/A';
        var resultVal = exp['result'] || 'N/A';
        var unit = exp['unit'] || '';
        var transportType = exp['transport_type'] || '';
        
        var text = '<strong>' + method + '</strong>: ' + response + ' = ' + resultVal + ' ' + unit;
        if (transportType) text += ' (' + transportType + ')';
        result += text;
        if (i < limit - 1) result += '<br>';
    }
    return result;
}

function displayPeptideDetail(peptide) {
    var formattedSequence = formatSequenceWithModifications(peptide.sequence_one_letter);
    var refsHtml = formatReferenceList(peptide.references);
    var experimentsHtml = formatExperiments(peptide.experiments);
    
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
        '<div style="margin-bottom: 1rem;">' +
            '<a href="browse.html" class="btn-secondary back-button" style="display: inline-block; text-decoration: none;">← Back to Browse</a>' +
            '<h1 style="color: #2c5282; font-size: 1.4rem; margin-bottom: 0.2rem;">' + (peptide.peptide_name || 'N/A') + '</h1>' +
            '<p style="color: #718096; font-size: 0.7rem;">ID: ' + peptide.id + '</p>' +
        '</div>' +
        
        '<div class="detail-section">' +
            '<h3>Basic Information</h3>' +
            '<div class="detail-row"><span class="detail-label">Peptide Name:</span><span class="detail-value">' + (peptide.peptide_name || 'N/A') + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Sequence (1-letter):</span><span class="detail-value" style="font-family: monospace; font-size: 0.8rem; word-break: break-all;">' + formattedSequence + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Sequence (3-letter):</span><span class="detail-value" style="font-size: 0.7rem; word-break: break-all;">' + (peptide.sequence_three_letter || 'N/A') + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Length:</span><span class="detail-value">' + (peptide.length || 'N/A') + ' aa</span></div>' +
            '<div class="detail-row"><span class="detail-label">Molecular Weight:</span><span class="detail-value">' + (peptide.molecular_weight ? peptide.molecular_weight.toFixed(2) : 'N/A') + ' Da</span></div>' +
            '<div class="detail-row"><span class="detail-label">Molecular Formula:</span><span class="detail-value">' + (peptide.molecular_formula || 'N/A') + '</span></div>' +
        '</div>' +
        
        '<div class="detail-section">' +
            '<h3>Structural Properties</h3>' +
            '<div class="detail-row"><span class="detail-label">Structure Type:</span><span class="detail-value">' + (peptide.structure_type || 'N/A') + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Disulfide Bridges:</span><span class="detail-value">' + (peptide.disulfide_bridge || 'N/A') + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Nature:</span><span class="detail-value">' + (peptide.nature || 'N/A') + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Modifications:</span><span class="detail-value">' + modsHtml + '</span></div>' +
        '</div>' +
        
        '<div class="detail-section">' +
            '<h3>Biological Source</h3>' +
            '<div class="detail-row"><span class="detail-label">Organism:</span><span class="detail-value">' + (peptide.source_organism || 'N/A') + '</span></div>' +
        '</div>';
    
    if (peptide.transport_types && peptide.transport_types.length > 0) {
        html += '<div class="detail-section">' +
            '<h3>Transport Properties</h3>' +
            '<div class="detail-row"><span class="detail-label">Transport Types:</span><span class="detail-value">' + peptide.transport_types.join(', ') + '</span></div>' +
        '</div>';
    }
    
    if (experimentsHtml !== 'N/A') {
        html += '<div class="detail-section">' +
            '<h3>Experimental Data</h3>' +
            '<div class="detail-row"><span class="detail-label">Experiments:</span><span class="detail-value" style="font-size: 0.8rem;">' + experimentsHtml + '</span></div>' +
        '</div>';
    }
    
    if (refsHtml !== 'N/A') {
        html += '<div class="detail-section">' +
            '<h3>References</h3>' +
            '<div class="detail-row"><span class="detail-label">Literature:</span><span class="detail-value" style="font-size: 0.8rem;">' + refsHtml + '</span></div>' +
        '</div>';
    }
    
    html += '<div class="detail-section">' +
            '<h3>Additional Information</h3>' +
            '<div class="detail-row"><span class="detail-label">Notes:</span><span class="detail-value">' + (peptide.notes || 'N/A') + '</span></div>' +
        '</div>' +
    '</div>';
    
    var detailContainer = document.getElementById('peptideDetail');
    if (detailContainer) {
        detailContainer.innerHTML = html;
    }
}

// ========== INITIALIZATION ==========

window.searchPeptides = applyAllFilters;
window.resetFilters = resetAllFilters;
window.setView = setView;
window.sortBy = sortBy;
window.showUnderConstruction = showUnderConstruction;
window.closeModal = closeModal;
window.applyAllFilters = applyAllFilters;
window.resetAllFilters = resetAllFilters;
window.downloadResults = downloadResults;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting Excel load...');
    // Small delay to ensure libraries are loaded
    setTimeout(loadExcelData, 100);
});