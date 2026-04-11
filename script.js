// BarrPeps Database - Optimized Version

let peptidesData = [];
let experimentsData = [];
let referencesData = [];
let modificationsData = [];

let currentView = 'table';
let sortColumn = 'peptide_name';
let sortDirection = 'asc';
let filteredPeptides = [];
let selectedAAs = [];

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
        { peptide_id: 1, trivial_name: "ANG1005", sequence_1: "TFFYGGSRGKRNNFKTEEY", length: 19, molecular_weight: 5110.41, origin: "synthetic", conformation: "Linear" },
        { peptide_id: 2, trivial_name: "Insulin", sequence_1: "GIVEQCCTSICSLYQLENYCN", length: 51, molecular_weight: 5807.57, origin: "human", conformation: "Linear" },
        { peptide_id: 3, trivial_name: "dynantin", sequence_1: "GGFLRRIRPK", length: 10, molecular_weight: 1388.71, origin: "synthetic", conformation: "Linear" }
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
        var cleanSeq = rawSeq.replace(/\([^)]+\)/g, '').replace(/[^A-Za-z]/g, '');
        
        enhanced.push({
            id: pid,
            peptide_name: p['trivial_name'] || p['peptide_name'] || 'Peptide_' + pid,
            sequence_one_letter: rawSeq,
            sequence_clean: cleanSeq,
            sequence_three_letter: p['sequence_3'] || p['sequence_three_letter'] || '',
            length: parseInt(p['length']) || cleanSeq.length,
            molecular_weight: parseFloat(p['molecular_weight']) || 0,
            molecular_formula: p['molecular_formula'] || '',
            structure_type: p['conformation'] || p['structure_type'] || '',
            disulfide_bridge: p['disulfide_bridge'] || '',
            nature: p['nature'] || '',
            source_organism: p['origin'] || p['source_organism'] || '',
            experiments: experimentsMap[pid] || [],
            references: referencesMap[pid] || [],
            modifications: modificationsMap[pid] || [],
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

// ========== HOME PAGE ==========
function initHomePage() {
    updateHomeStats();
    displayFeaturedPeptides();
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

function applyFilters() {
    var searchTerm = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';
    var structType = document.getElementById('structureFilter') ? document.getElementById('structureFilter').value : 'all';
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
        if (structType !== 'all' && (p.structure_type || '').toLowerCase() !== structType.toLowerCase()) continue;
        if (selectedAAs.length > 0 && !containsAllAAs(p.sequence_clean || '', selectedAAs)) continue;
        
        result.push(p);
    }
    
    filteredPeptides = result;
    updateBrowseStats();
    displayBrowseResults();
}

function resetFilters() {
    var inputs = ['searchInput', 'lengthMin', 'lengthMax', 'structureFilter'];
    for (var i = 0; i < inputs.length; i++) {
        var el = document.getElementById(inputs[i]);
        if (el) el.value = (inputs[i] === 'lengthMin' ? 0 : (inputs[i] === 'lengthMax' ? 100 : ''));
    }
    if (document.getElementById('structureFilter')) document.getElementById('structureFilter').value = 'all';
    
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
    
    if (currentView === 'table') displayTableView(container);
    else displayCardView(container);
}

function displayTableView(container) {
    var html = '<div class="table-view"><tr><thead><tr>' +
        '<th onclick="sortBy(\'peptide_name\')">Name</th>' +
        '<th onclick="sortBy(\'sequence_one_letter\')">Sequence</th>' +
        '<th onclick="sortBy(\'length\')">Length</th>' +
        '<th onclick="sortBy(\'molecular_weight\')">MW (Da)</th>' +
        '<th onclick="sortBy(\'structure_type\')">Structure</th>' +
        '<th onclick="sortBy(\'source_organism\')">Source</th>' +
        '<th>Details</th>' +
        '</table></thead><tbody>';
    
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

// ========== PEPTIDE DETAIL PAGE - OPTIMIZED ==========
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
    displayOptimizedPeptideDetail(peptide);
}

function formatSequenceWithMods(seq) {
    if (!seq) return 'N/A';
    return seq
        .replace(/\(Me2\)/g, '<span class="modification" title="Dimethylated">(Me₂)</span>')
        .replace(/\(D\)/g, '<span class="modification" title="D-amino acid">(D)</span>')
        .replace(/\(NMe\)/g, '<span class="modification" title="N-methylated">(N-Me)</span>')
        .replace(/-NH2/g, '<span class="modification" title="Amidated">-NH₂</span>')
        .replace(/\(Ac\)/g, '<span class="modification" title="Acetylated">(Ac)</span>')
        .replace(/\(Pen\)/g, '<span class="modification" title="Penicillamine">(Pen)</span>');
}

function formatResultWithUnit(exp) {
    var result = exp['result'];
    var unit = exp['unit'];
    if (result !== undefined && result !== null && result !== '') {
        return result + (unit ? ' ' + unit : '');
    }
    return null;
}

function displayOptimizedPeptideDetail(peptide) {
    // Modifications - only if exists
    var modsHtml = '';
    if (peptide.modifications && peptide.modifications.length > 0) {
        var modList = [];
        for (var i = 0; i < peptide.modifications.length; i++) {
            var modValue = peptide.modifications[i]['modifications'];
            if (modValue) modList.push(modValue);
        }
        if (modList.length > 0) {
            modsHtml = '<div class="detail-section"><h3>Modifications</h3>' +
                '<div class="detail-row"><span class="detail-value">' + modList.join(', ') + '</span></div>' +
                '</div>';
        }
    }
    
    // Experiments - only non-empty fields, Result with Unit combined
    var experimentsHtml = '';
    if (peptide.experiments && peptide.experiments.length > 0) {
        for (var i = 0; i < peptide.experiments.length; i++) {
            var exp = peptide.experiments[i];
            var hasContent = false;
            var expHtml = '<div class="experiment-item" style="margin-bottom: 1rem; padding: 0.5rem; background: #f0f4f8; border-radius: 6px;">';
            
            // Method (always show if exists)
            if (exp['method']) {
                expHtml += '<div class="detail-row"><span class="detail-label">Method:</span><span class="detail-value">' + exp['method'] + '</span></div>';
                hasContent = true;
            }
            
            // Method Type
            if (exp['method_type']) {
                expHtml += '<div class="detail-row"><span class="detail-label">Type:</span><span class="detail-value">' + exp['method_type'] + '</span></div>';
                hasContent = true;
            }
            
            // Response
            if (exp['response']) {
                expHtml += '<div class="detail-row"><span class="detail-label">Response:</span><span class="detail-value">' + exp['response'] + '</span></div>';
                hasContent = true;
            }
            
            // Result with Unit (combined)
            var resultWithUnit = formatResultWithUnit(exp);
            if (resultWithUnit) {
                expHtml += '<div class="detail-row"><span class="detail-label">Result:</span><span class="detail-value">' + resultWithUnit + '</span></div>';
                hasContent = true;
            }
            
            // Label
            if (exp['label']) {
                expHtml += '<div class="detail-row"><span class="detail-label">Label:</span><span class="detail-value">' + exp['label'] + '</span></div>';
                hasContent = true;
            }
            
            // Transport Type
            if (exp['transport_type']) {
                expHtml += '<div class="detail-row"><span class="detail-label">Transport:</span><span class="detail-value">' + exp['transport_type'] + '</span></div>';
                hasContent = true;
            }
            
            // Cell Line
            if (exp['cell_line']) {
                expHtml += '<div class="detail-row"><span class="detail-label">Cell Line:</span><span class="detail-value">' + exp['cell_line'] + '</span></div>';
                hasContent = true;
            }
            
            // Animal Model
            if (exp['animal_model']) {
                expHtml += '<div class="detail-row"><span class="detail-label">Animal Model:</span><span class="detail-value">' + exp['animal_model'] + '</span></div>';
                hasContent = true;
            }
            
            // Delivery
            if (exp['delivery']) {
                expHtml += '<div class="detail-row"><span class="detail-label">Delivery:</span><span class="detail-value">' + exp['delivery'] + '</span></div>';
                hasContent = true;
            }
            
            // Combination
            if (exp['combination']) {
                expHtml += '<div class="detail-row"><span class="detail-label">Combination:</span><span class="detail-value">' + exp['combination'] + '</span></div>';
                hasContent = true;
            }
            
            expHtml += '</div>';
            
            if (hasContent) {
                experimentsHtml += expHtml;
            }
        }
    }
    
    if (experimentsHtml === '') {
        experimentsHtml = '<div class="detail-section"><div class="detail-row"><span class="detail-value">No experimental data available</span></div></div>';
    } else {
        experimentsHtml = '<div class="detail-section"><h3>Experimental Data</h3>' + experimentsHtml + '</div>';
    }
    
    // References - only non-empty fields
    var referencesHtml = '';
    if (peptide.references && peptide.references.length > 0) {
        for (var i = 0; i < peptide.references.length; i++) {
            var ref = peptide.references[i];
            var hasContent = false;
            var refHtml = '<div class="reference-item" style="margin-bottom: 1rem; padding: 0.5rem; background: #f0f4f8; border-radius: 6px;">';
            
            if (ref['authors']) {
                refHtml += '<div class="detail-row"><span class="detail-label">Authors:</span><span class="detail-value">' + ref['authors'] + '</span></div>';
                hasContent = true;
            }
            if (ref['title']) {
                refHtml += '<div class="detail-row"><span class="detail-label">Title:</span><span class="detail-value">' + ref['title'] + '</span></div>';
                hasContent = true;
            }
            if (ref['year']) {
                refHtml += '<div class="detail-row"><span class="detail-label">Year:</span><span class="detail-value">' + ref['year'] + '</span></div>';
                hasContent = true;
            }
            if (ref['journal']) {
                refHtml += '<div class="detail-row"><span class="detail-label">Journal:</span><span class="detail-value">' + ref['journal'] + '</span></div>';
                hasContent = true;
            }
            
            refHtml += '</div>';
            
            if (hasContent) {
                referencesHtml += refHtml;
            }
        }
    }
    
    if (referencesHtml === '') {
        referencesHtml = '<div class="detail-section"><div class="detail-row"><span class="detail-value">No references available</span></div></div>';
    } else {
        referencesHtml = '<div class="detail-section"><h3>References</h3>' + referencesHtml + '</div>';
    }
    
    // Build final HTML
    var html = '<div class="peptide-detail-container">' +
        '<div style="margin-bottom:1rem;">' +
            '<a href="browse.html" class="btn-secondary back-button">← Back to Browse</a>' +
            '<h1 style="color:#2c5282; margin-top:0.5rem;">' + (peptide.peptide_name || 'N/A') + '</h1>' +
            '<p style="color:#718096;">ID: ' + peptide.id + '</p>' +
        '</div>' +
        
        // Basic Information (always show)
        '<div class="detail-section"><h3>Basic Information</h3>' +
            '<div class="detail-row"><span class="detail-label">Sequence:</span><span class="detail-value" style="font-family:monospace; word-break:break-all;">' + formatSequenceWithMods(peptide.sequence_one_letter) + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Length:</span><span class="detail-value">' + (peptide.length || 'N/A') + ' aa</span></div>' +
            '<div class="detail-row"><span class="detail-label">Molecular Weight:</span><span class="detail-value">' + (peptide.molecular_weight ? peptide.molecular_weight.toFixed(2) : 'N/A') + ' Da</span></div>' +
            (peptide.molecular_formula ? '<div class="detail-row"><span class="detail-label">Formula:</span><span class="detail-value">' + peptide.molecular_formula + '</span></div>' : '') +
        '</div>' +
        
        // Structural Properties (only if exists)
        (peptide.structure_type || peptide.disulfide_bridge || peptide.nature ? 
            '<div class="detail-section"><h3>Structural Properties</h3>' +
                (peptide.structure_type ? '<div class="detail-row"><span class="detail-label">Structure:</span><span class="detail-value">' + peptide.structure_type + '</span></div>' : '') +
                (peptide.disulfide_bridge ? '<div class="detail-row"><span class="detail-label">Disulfide Bridges:</span><span class="detail-value">' + peptide.disulfide_bridge + '</span></div>' : '') +
                (peptide.nature ? '<div class="detail-row"><span class="detail-label">Nature:</span><span class="detail-value">' + peptide.nature + '</span></div>' : '') +
            '</div>' : '') +
        
        // Source (only if exists)
        (peptide.source_organism && peptide.source_organism !== 'N/A' ? 
            '<div class="detail-section"><h3>Biological Source</h3>' +
                '<div class="detail-row"><span class="detail-label">Organism:</span><span class="detail-value">' + peptide.source_organism + '</span></div>' +
            '</div>' : '') +
        
        // Modifications
        modsHtml +
        
        // Experimental Data
        experimentsHtml +
        
        // References
        referencesHtml +
        
        // Notes (only if exists)
        (peptide.notes ? 
            '<div class="detail-section"><h3>Additional Information</h3>' +
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