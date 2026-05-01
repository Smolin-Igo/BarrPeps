// BarrPeps Database - Full Version with PDB Visualization

let peptidesData = [];
let experimentsData = [];
let referencesData = [];
let modificationsData = [];
let pdbData = [];

let currentView = 'table';
let sortColumn = 'peptide_name';
let sortDirection = 'asc';
let filteredPeptides = [];

// PDB Viewer variables
let pdbViewer = null;
let pdbContentCache = null;

// Chart instances
let lengthChart = null;
let aaChart = null;

// Multi-select variables
var selectedMods = [];
var selectedSources = [];

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

// ========== SAVE/RESTORE FILTERS ==========

function saveFilters() {
    var filters = {
        search: document.getElementById('searchInput')?.value || '',
        lengthMin: document.getElementById('lengthMin')?.value || '0',
        lengthMax: document.getElementById('lengthMax')?.value || '100',
        disulfide: document.getElementById('disulfideFilter')?.value || 'all',
        pdb: document.getElementById('pdbFilter')?.value || 'all',
        selectedSources: selectedSources.slice(),
        selectedMods: selectedMods.slice(),
        sortColumn: sortColumn,
        sortDirection: sortDirection,
        currentView: currentView
    };
    sessionStorage.setItem('barrpeps_filters', JSON.stringify(filters));
}

function restoreFilters() {
    var saved = sessionStorage.getItem('barrpeps_filters');
    if (!saved) return false;
    
    try {
        var filters = JSON.parse(saved);
        
        if (document.getElementById('searchInput')) document.getElementById('searchInput').value = filters.search || '';
        if (document.getElementById('lengthMin')) document.getElementById('lengthMin').value = filters.lengthMin || '0';
        if (document.getElementById('lengthMax')) document.getElementById('lengthMax').value = filters.lengthMax || '100';
        if (document.getElementById('disulfideFilter')) document.getElementById('disulfideFilter').value = filters.disulfide || 'all';
        if (document.getElementById('pdbFilter')) document.getElementById('pdbFilter').value = filters.pdb || 'all';
        
        selectedSources = filters.selectedSources || [];
        selectedMods = filters.selectedMods || [];
        
        if (filters.sortColumn) sortColumn = filters.sortColumn;
        if (filters.sortDirection) sortDirection = filters.sortDirection;
        if (filters.currentView) currentView = filters.currentView;
        
        // Восстанавливаем чекбоксы
        setTimeout(function() {
            if (selectedSources.length > 0) {
                document.querySelectorAll('#sourceDropdown input[type="checkbox"]').forEach(function(cb) {
                    cb.checked = selectedSources.indexOf(cb.value) !== -1;
                });
                var st = document.getElementById('sourceSelectedText');
                if (st) st.textContent = selectedSources.length + ' selected';
            }
            if (selectedMods.length > 0) {
                document.querySelectorAll('#modDropdown input[type="checkbox"]').forEach(function(cb) {
                    cb.checked = selectedMods.indexOf(cb.value) !== -1;
                });
                var mt = document.getElementById('modSelectedText');
                if (mt) mt.textContent = selectedMods.length + ' selected';
            }
        }, 200);
        
        return true;
    } catch(e) {
        return false;
    }
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
            
            // Загружаем peptides с прямым доступом к ячейкам для литературы
            var peptidesSheet = workbook.Sheets['peptides'];
            if (peptidesSheet) {
                peptidesData = XLSX.utils.sheet_to_json(peptidesSheet);
                console.log('Peptides loaded:', peptidesData.length);
                
                // Находим колонку literature
                var range = XLSX.utils.decode_range(peptidesSheet['!ref']);
                var literatureCol = -1;
                
                for (var col = range.s.c; col <= range.e.c; col++) {
                    var cellAddress = XLSX.utils.encode_cell({r: 0, c: col});
                    var cell = peptidesSheet[cellAddress];
                    if (cell && cell.v && String(cell.v).toLowerCase() === 'literature') {
                        literatureCol = col;
                        break;
                    }
                }
                
                if (literatureCol >= 0) {
                    for (var row = 1; row <= range.e.r; row++) {
                        var cellAddress = XLSX.utils.encode_cell({r: row, c: literatureCol});
                        var cell = peptidesSheet[cellAddress];
                        if (cell && peptidesData[row - 1]) {
                            peptidesData[row - 1].literature = cell.w || cell.v || '';
                        }
                    }
                }
            }
            
            // Остальные листы
            for (var s = 0; s < sheetNames.length; s++) {
                var sheetName = sheetNames[s];
                if (sheetName.toLowerCase() === 'peptides') continue;
                
                var worksheet = workbook.Sheets[sheetName];
                var jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                var lowerName = sheetName.toLowerCase();
                if (lowerName === 'experiments') experimentsData = jsonData;
                else if (lowerName === 'references') referencesData = jsonData;
                else if (lowerName === 'modifications') modificationsData = jsonData;
                else if (lowerName === 'pdb') pdbData = jsonData;
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

function processAllData() {
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
    
    var pdbMap = {};
    for (var i = 0; i < pdbData.length; i++) {
        var pdb = pdbData[i];
        var pid = pdb['peptide_id'];
        if (pid) {
            if (!pdbMap[pid]) pdbMap[pid] = [];
            pdbMap[pid].push(pdb);
        }
    }
    
    var enhanced = [];
    for (var i = 0; i < peptidesData.length; i++) {
        var p = peptidesData[i];
        var pid = p['peptide_id'] || i + 1;
        var rawSeq = p['sequence_1'] || '';
        var threeSeq = p['sequence_3'] || '';
        
        var cleanSeq = '';
        var modsForPeptide = modificationsMap[pid] || [];
        if (modsForPeptide.length > 0) {
            cleanSeq = modsForPeptide[0]['sequence_1_clean'] || '';
        }
        if (!cleanSeq && rawSeq) {
            cleanSeq = rawSeq.replace(/\([^)]+\)/g, '').replace(/[^A-Za-z]/g, '');
        }
        
        var allMods = [];
        for (var m = 0; m < modsForPeptide.length; m++) {
            var modVal = modsForPeptide[m]['modifications'];
            if (modVal && modVal !== 'N/A' && modVal !== '') {
                var parts = modVal.split(',').map(function(item) { return item.trim(); });
                for (var k = 0; k < parts.length; k++) {
                    if (parts[k] && allMods.indexOf(parts[k]) === -1) {
                        allMods.push(parts[k]);
                    }
                }
            }
        }
        
        var pdbInfo = pdbMap[pid] || [];
        var pdbIds = [];
        var relatedPdbIds = [];
        
        for (var j = 0; j < pdbInfo.length; j++) {
            var pdbId = pdbInfo[j]['PDB_ID'];
            var relatedPdb = pdbInfo[j]['Related_PDB'];
            
            if (pdbId && pdbId !== 'Nah' && pdbId !== '' && pdbId !== 'N/A') {
                var ids = pdbId.split(',').map(function(id) { return id.trim(); });
                for (var k = 0; k < ids.length; k++) {
                    if (ids[k] && ids[k] !== 'Nah' && ids[k] !== 'N/A') pdbIds.push(ids[k]);
                }
            }
            
            if (relatedPdb && relatedPdb !== 'Nah' && relatedPdb !== '') {
                var relIds = relatedPdb.split(',').map(function(id) { return id.trim(); });
                for (var k = 0; k < relIds.length; k++) {
                    if (relIds[k] && relIds[k] !== 'Nah' && relIds[k] !== 'N/A') relatedPdbIds.push(relIds[k]);
                }
            }
        }
        
        var uniquePdbIds = [];
        for (var j = 0; j < pdbIds.length; j++) {
            if (uniquePdbIds.indexOf(pdbIds[j]) === -1) uniquePdbIds.push(pdbIds[j]);
        }
        
        var uniqueRelatedPdbIds = [];
        for (var j = 0; j < relatedPdbIds.length; j++) {
            if (uniqueRelatedPdbIds.indexOf(relatedPdbIds[j]) === -1) uniqueRelatedPdbIds.push(relatedPdbIds[j]);
        }
        
        enhanced.push({
            id: pid,
            peptide_name: p['trivial_name'] || 'Peptide_' + pid,
            sequence_one_letter: rawSeq,
            sequence_clean: cleanSeq,
            sequence_three_letter: threeSeq,
            length: parseInt(p['length']) || cleanSeq.length,
            molecular_weight: parseFloat(p['molecular_weight']) || 0,
            molecular_formula: p['molecular_formula'] || '',
            structure_type: p['conformation'] || 'N/A',
            disulfide_bridge: p['disulfide_bridge'] || '',
            disulfide_bonds: parseDisulfideBonds(p['disulfide_bridge'] || ''),
            nature: p['nature'] || '',
            source_organism: p['origin'] || 'N/A',
            experiments: experimentsMap[pid] || [],
            references: referencesMap[pid] || [],
            modifications: allMods,
            pdb_ids: uniquePdbIds,
            related_pdb_ids: uniqueRelatedPdbIds,
            has_pdb: uniquePdbIds.length > 0,
            notes: p['literature'] || ''
        });
    }
    
    peptidesData = enhanced;
    filteredPeptides = [...peptidesData];
    
    var currentPage = window.location.pathname.split('/').pop();
    if (currentPage === 'index.html' || currentPage === '') {
        initHomePage();
    } else if (currentPage === 'browse.html') {
        initBrowsePage();
    } else if (currentPage === 'peptide.html') {
        initPeptidePage();
    }
}

function useFallbackData() {
    peptidesData = [];
    processAllData();
}

// Парсинг дисульфидных связей
function parseDisulfideBonds(disulfideStr) {
    if (!disulfideStr || disulfideStr.toLowerCase() === 'no' || disulfideStr === '') return [];
    
    var bonds = [];
    var parts = disulfideStr.split(/[;,]/);
    
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (!part) continue;
        
        var match = part.match(/Cys[-\s]*(\d+[A-Za-z]?)\s*-\s*Cys[-\s]*(\d+[A-Za-z]?)/i);
        if (match) {
            bonds.push({ cys1: match[1], cys2: match[2], raw: part });
            continue;
        }
        
        match = part.match(/Cys\s*\((\d+[A-Za-z]?)\)\s*-\s*Cys\s*\((\d+[A-Za-z]?)\)/i);
        if (match) {
            bonds.push({ cys1: match[1], cys2: match[2], raw: part });
        }
    }
    
    return bonds;
}

// Найти остатки пептида в PDB для раскраски
function findPeptideResiduesInPDB(pdbContent, peptideSequence, disulfideBonds) {
    if (!peptideSequence && (!disulfideBonds || disulfideBonds.length === 0)) return null;
    
    var lines = pdbContent.split('\n');
    var chains = {};
    var currentChain = null;
    var chainSequence = '';
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.startsWith('ATOM') && line.substring(13, 15).trim() === 'CA') {
            var chainId = line.substring(21, 22).trim();
            var resName = line.substring(17, 20).trim();
            var resSeq = parseInt(line.substring(22, 26).trim());
            
            if (currentChain !== chainId) {
                if (currentChain && chainSequence) {
                    chains[currentChain] = { sequence: chainSequence, residues: chains[currentChain]?.residues || [] };
                }
                currentChain = chainId;
                chainSequence = '';
                chains[chainId] = { sequence: '', residues: [] };
            }
            
            var aa1 = convertThreeToOne(resName);
            if (aa1) {
                chainSequence += aa1;
                chains[chainId].residues.push({ resSeq: resSeq, aa: aa1, chain: chainId });
            }
        }
    }
    if (currentChain && chainSequence) {
        chains[currentChain] = { sequence: chainSequence, residues: chains[currentChain]?.residues || [] };
    }
    
    // Если есть последовательность пептида - ищем по ней
    var peptideResidues = [];
    var peptideChain = null;
    
    if (peptideSequence) {
        var target = peptideSequence.toUpperCase();
        for (var chain in chains) {
            var idx = chains[chain].sequence.indexOf(target);
            if (idx !== -1) {
                peptideResidues = chains[chain].residues.slice(idx, idx + target.length);
                peptideChain = chain;
                break;
            }
        }
    }
    
    // Ищем цистеины из дисульфидных связей
    var cysteineAtoms = {};
    var cysteineResidues = {};
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.startsWith('ATOM')) {
            var atomName = line.substring(12, 16).trim();
            var resName = line.substring(17, 20).trim();
            var chainId = line.substring(21, 22).trim();
            var resSeq = parseInt(line.substring(22, 26).trim());
            
            if (resName === 'CYS' && (atomName === 'SG' || atomName === 'S')) {
                var x = parseFloat(line.substring(30, 38));
                var y = parseFloat(line.substring(38, 46));
                var z = parseFloat(line.substring(46, 54));
                var key = chainId + '_' + resSeq;
                cysteineAtoms[key] = { resSeq: resSeq, chain: chainId, x: x, y: y, z: z };
            }
            
            if (resName === 'CYS' && atomName === 'CA') {
                var cKey = chainId + '_' + resSeq;
                cysteineResidues[cKey] = { resSeq: resSeq, chain: chainId };
            }
        }
    }
    
    // Сопоставляем дисульфидные связи
    var matchedBonds = [];
    if (disulfideBonds && disulfideBonds.length > 0) {
        for (var i = 0; i < disulfideBonds.length; i++) {
            var bond = disulfideBonds[i];
            var cys1 = String(bond.cys1);
            var cys2 = String(bond.cys2);
            var found1 = null, found2 = null;
            
            for (var key in cysteineAtoms) {
                var cys = cysteineAtoms[key];
                var rs = String(cys.resSeq);
                var cr = cys.chain + rs;
                
                if (rs === cys1 || cr === cys1 || rs === cys1.replace(/[A-Za-z]/g, '') ||
                    (cys1.match(/^([A-Za-z])(\d+)$/) && cys.chain === RegExp.$1 && rs === RegExp.$2)) {
                    found1 = cys;
                }
                if (rs === cys2 || cr === cys2 || rs === cys2.replace(/[A-Za-z]/g, '') ||
                    (cys2.match(/^([A-Za-z])(\d+)$/) && cys.chain === RegExp.$1 && rs === RegExp.$2)) {
                    found2 = cys;
                }
            }
            
            if (found1 && found2) {
                matchedBonds.push({
                    cys1: found1,
                    cys2: found2,
                    label: bond.raw || ('Cys' + cys1 + '-Cys' + cys2)
                });
            }
        }
    }
    
    // Собираем цистеины, которые УЧАСТВУЮТ в связях
    var bondedCysteineKeys = {};
    for (var i = 0; i < matchedBonds.length; i++) {
        var b = matchedBonds[i];
        bondedCysteineKeys[b.cys1.chain + '_' + b.cys1.resSeq] = true;
        bondedCysteineKeys[b.cys2.chain + '_' + b.cys2.resSeq] = true;
    }
    
    // Оставляем только атомы цистеинов, участвующих в связях
    var bondedCysteineAtoms = {};
    for (var key in cysteineAtoms) {
        if (bondedCysteineKeys[key]) {
            bondedCysteineAtoms[key] = cysteineAtoms[key];
        }
    }
    
    return {
        peptideResidues: peptideResidues,
        peptideChain: peptideChain,
        cysteineAtoms: bondedCysteineAtoms,
        matchedBonds: matchedBonds
    };
}

function convertThreeToOne(three) {
    var map = { 'ALA':'A','ARG':'R','ASN':'N','ASP':'D','CYS':'C','GLN':'Q','GLU':'E','GLY':'G','HIS':'H','ILE':'I','LEU':'L','LYS':'K','MET':'M','PHE':'F','PRO':'P','SER':'S','THR':'T','TRP':'W','TYR':'Y','VAL':'V' };
    return map[three.toUpperCase()] || '';
}

function getRainbowColor(index, total) {
    if (total <= 1) return 0x00cc88;
    var ratio = index / (total - 1);
    var r, g, b;
    if (ratio < 0.25) { var t = ratio/0.25; r=0; g=Math.floor(100+155*t); b=255; }
    else if (ratio < 0.5) { var t = (ratio-0.25)/0.25; r=0; g=255; b=Math.floor(255*(1-t)); }
    else if (ratio < 0.75) { var t = (ratio-0.5)/0.25; r=Math.floor(255*t); g=255; b=0; }
    else { var t = (ratio-0.75)/0.25; r=255; g=Math.floor(255*(1-t)); b=0; }
    return (r<<16)|(g<<8)|b;
}

async function fetchPDBStructure(pdbId) {
    if (!pdbId || pdbId === '' || pdbId === 'N/A') return null;
    try {
        var r = await fetch('https://files.rcsb.org/download/' + pdbId + '.pdb');
        return r.ok ? await r.text() : null;
    } catch(e) { return null; }
}

// Извлечение дисульфидных связей из SSBOND записей PDB
function parseSSBOND(pdbContent) {
    var bonds = [];
    var lines = pdbContent.split('\n');
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.startsWith('SSBOND')) {
            // SSBOND   1 CYS A    6    CYS A   11
            // Иногда цепь может быть пробелом
            var chain1 = line.substring(15, 16).trim();
            var res1 = parseInt(line.substring(17, 21).trim());
            var chain2 = line.substring(29, 30).trim();
            var res2 = parseInt(line.substring(31, 35).trim());
            
            // Если цепь пустая (пробел), используем ' ' или первую найденную цепь
            if (!chain1) chain1 = ' ';
            if (!chain2) chain2 = ' ';
            
            bonds.push({
                chain1: chain1,
                res1: res1,
                chain2: chain2,
                res2: res2
            });
            
            console.log('SSBOND: Cys' + chain1 + '_' + res1 + ' - Cys' + chain2 + '_' + res2);
        }
    }
    
    console.log('Total SSBOND records:', bonds.length);
    return bonds;
}

// Поиск атомов серы для конкретных остатков цистеина
function findSGAtoms(pdbContent, cysteinePositions) {
    var lines = pdbContent.split('\n');
    var atoms = {};
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
            var atomName = line.substring(12, 16).trim();
            var resName = line.substring(17, 20).trim();
            var chainId = line.substring(21, 22).trim();
            var resSeq = parseInt(line.substring(22, 26).trim());
            
            if (resName === 'CYS' && (atomName === 'SG' || atomName === 'S')) {
                var x = parseFloat(line.substring(30, 38));
                var y = parseFloat(line.substring(38, 46));
                var z = parseFloat(line.substring(46, 54));
                
                var key = chainId + '_' + resSeq;
                atoms[key] = { chain: chainId, resSeq: resSeq, x: x, y: y, z: z };
            }
        }
    }
    
    return atoms;
}

// Найти пептид в PDB по последовательности
function findPeptideChain(pdbContent, peptideSequence) {
    if (!peptideSequence) return null;
    
    var lines = pdbContent.split('\n');
    var chains = {};
    var currentChain = null;
    var chainSeq = '';
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.startsWith('ATOM') && line.substring(13, 16).trim() === 'CA') {
            var chainId = line.substring(21, 22).trim();
            if (!chainId) chainId = ' ';
            
            var resName = line.substring(17, 20).trim();
            var resSeq = parseInt(line.substring(22, 26).trim());
            
            if (currentChain !== chainId) {
                if (currentChain !== null && chainSeq) {
                    if (!chains[currentChain]) chains[currentChain] = { seq: '', residues: [] };
                    chains[currentChain].seq = chainSeq;
                }
                currentChain = chainId;
                chainSeq = '';
                if (!chains[chainId]) chains[chainId] = { seq: '', residues: [] };
            }
            
            var aa = convertThreeToOne(resName);
            if (aa) {
                chainSeq += aa;
                chains[chainId].residues.push({ resSeq: resSeq, aa: aa });
            }
        }
    }
    if (currentChain !== null && chainSeq) {
        if (!chains[currentChain]) chains[currentChain] = { seq: '', residues: [] };
        chains[currentChain].seq = chainSeq;
    }
    
    var target = peptideSequence.toUpperCase();
    
    // ТОЛЬКО точное совпадение
    for (var chain in chains) {
        var idx = chains[chain].seq.indexOf(target);
        if (idx !== -1) {
            var residues = chains[chain].residues.slice(idx, idx + target.length);
            console.log('Found peptide in chain ' + chain + ': ' + residues.length + ' residues');
            return {
                chain: chain,
                residues: residues,
                startRes: residues[0].resSeq,
                endRes: residues[residues.length - 1].resSeq
            };
        }
    }
    
    console.log('Exact peptide sequence not found in PDB');
    return null;
}

function renderPDBStructure(pdbContent, pdbId, peptideSequence, disulfideBondsFromDB) {
    var container = document.getElementById('structure-viewer-pdb');
    if (!container || !pdbContent) return;
    
    var peptideInfo = findPeptideChain(pdbContent, peptideSequence);
    
    if (peptideInfo && peptideSequence) {
        if (peptideInfo.residues.length > peptideSequence.length * 1.5) {
            peptideInfo = null;
        }
    }
    
    var ssbonds = parseSSBOND(pdbContent);
    
    var allSGAtoms = {};
    var lines = pdbContent.split('\n');
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
            var atomName = line.substring(12, 16).trim();
            var resName = line.substring(17, 20).trim();
            var chainId = line.substring(21, 22).trim();
            var resSeq = parseInt(line.substring(22, 26).trim());
            
            if (resName === 'CYS' && (atomName === 'SG' || atomName === 'S')) {
                var x = parseFloat(line.substring(30, 38));
                var y = parseFloat(line.substring(38, 46));
                var z = parseFloat(line.substring(46, 54));
                var key = chainId + '_' + resSeq;
                allSGAtoms[key] = { chain: chainId, resSeq: resSeq, x: x, y: y, z: z };
            }
        }
    }
    
    var peptideBonds = [];
    var usedPairs = {};
    
    if (peptideInfo && ssbonds.length > 0) {
        var offset = peptideInfo.startRes - 1;
        
        for (var i = 0; i < ssbonds.length; i++) {
            var bond = ssbonds[i];
            
            var chain1Match = (bond.chain1 === peptideInfo.chain);
            var chain2Match = (bond.chain2 === peptideInfo.chain);
            var res1InRange = (bond.res1 >= peptideInfo.startRes && bond.res1 <= peptideInfo.endRes);
            var res2InRange = (bond.res2 >= peptideInfo.startRes && bond.res2 <= peptideInfo.endRes);
            
            if (chain1Match && chain2Match && res1InRange && res2InRange) {
                var pairKey = Math.min(bond.res1, bond.res2) + '_' + Math.max(bond.res1, bond.res2);
                var relRes1 = bond.res1 - offset;
                var relRes2 = bond.res2 - offset;
                
                var inDB = false;
                if (disulfideBondsFromDB && disulfideBondsFromDB.length > 0) {
                    for (var d = 0; d < disulfideBondsFromDB.length; d++) {
                        var dbBond = disulfideBondsFromDB[d];
                        var dbRes1 = parseInt(dbBond.cys1) || 0;
                        var dbRes2 = parseInt(dbBond.cys2) || 0;
                        if ((relRes1 === dbRes1 && relRes2 === dbRes2) || (relRes1 === dbRes2 && relRes2 === dbRes1)) {
                            inDB = true;
                            break;
                        }
                    }
                }
                
                if (!inDB) continue;
                
                if (!usedPairs[pairKey]) {
                    usedPairs[pairKey] = true;
                    var key1 = bond.chain1 + '_' + bond.res1;
                    var key2 = bond.chain2 + '_' + bond.res2;
                    if (allSGAtoms[key1] && allSGAtoms[key2]) {
                        peptideBonds.push({
                            atom1: allSGAtoms[key1], atom2: allSGAtoms[key2],
                            chain1: bond.chain1, res1: bond.res1,
                            chain2: bond.chain2, res2: bond.res2
                        });
                    }
                }
            }
        }
    }
    
    container.innerHTML = '';
    pdbViewer = $3Dmol.createViewer(container, { backgroundColor: 'white' });
    pdbViewer.addModel(pdbContent, 'pdb');
    
    if (peptideInfo && peptideInfo.residues && peptideInfo.residues.length > 0) {
        pdbViewer.setStyle({}, { cartoon: { color: 0x445566, opacity: 0.45 } });
        for (var i = 0; i < peptideInfo.residues.length; i++) {
            var color = getRainbowColor(i, peptideInfo.residues.length);
            pdbViewer.addStyle(
                { chain: peptideInfo.chain, resi: peptideInfo.residues[i].resSeq },
                { cartoon: { color: color, opacity: 0.95 } }
            );
        }
    } else {
        pdbViewer.setStyle({}, { cartoon: { colorscheme: 'ss', opacity: 0.85 } });
    }
    
    for (var i = 0; i < peptideBonds.length; i++) {
        var bond = peptideBonds[i];
        pdbViewer.addSphere({ center: {x:bond.atom1.x, y:bond.atom1.y, z:bond.atom1.z}, radius: 0.4, color: 0xffcc00 });
        pdbViewer.addSphere({ center: {x:bond.atom2.x, y:bond.atom2.y, z:bond.atom2.z}, radius: 0.4, color: 0xffcc00 });
    }
    
    pdbViewer.zoomTo();
    
    setTimeout(function() {
        for (var i = 0; i < peptideBonds.length; i++) {
            var b = peptideBonds[i];
            pdbViewer.addArrow({
                start: { x: b.atom1.x, y: b.atom1.y, z: b.atom1.z },
                end: { x: b.atom2.x, y: b.atom2.y, z: b.atom2.z },
                radius: 0.12, radiusRatio: 1.0, color: 0xff8800, alpha: 0.9
            });
        }
        pdbViewer.render();
    }, 100);
    
// Подсказка при наведении + подсветка через пересоздание стиля
var hoverPopup = document.createElement('div');
hoverPopup.style.cssText = 'position:fixed; display:none; background:#1a202c; color:white; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:500; z-index:99999; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,0.4); border-left:3px solid #ffcc00;';
document.body.appendChild(hoverPopup);

var lastHoveredKey = null;

document.addEventListener('mousemove', function(e) {
    if (hoverPopup.style.display === 'block') {
        hoverPopup.style.left = (e.clientX + 18) + 'px';
        hoverPopup.style.top = (e.clientY - 15) + 'px';
    }
});

pdbViewer.setHoverable({}, true, 
    function(atom, viewer, event) {
        if (atom) {
            var fullName = getFullResidueName(atom.resn);
            hoverPopup.textContent = fullName + ' (' + atom.resn + ' ' + atom.resi + ') - Chain ' + atom.chain;
            hoverPopup.style.display = 'block';
            hoverPopup.style.left = (event.clientX + 18) + 'px';
            hoverPopup.style.top = (event.clientY - 15) + 'px';
            
            // Подсвечиваем — просто добавляем яркий стиль поверх существующего
            var currentKey = atom.chain + '_' + atom.resi;
            if (lastHoveredKey !== currentKey) {
                // Убираем старую подсветку
                if (lastHoveredKey) {
                    var oldParts = lastHoveredKey.split('_');
                    pdbViewer.setStyle(
                        { chain: oldParts[0], resi: parseInt(oldParts[1]) },
                        { cartoon: { color: 0x445566, opacity: 0.45 } }
                    );
                }
                
                // Добавляем новую подсветку — ярко-розовый
                pdbViewer.setStyle(
                    { chain: atom.chain, resi: atom.resi },
                    { cartoon: { color: 0xff4488 }, stick: { color: 0xff4488, radius: 0.2 }, sphere: { color: 0xff4488, scale: 0.5 } }
                );
                
                lastHoveredKey = currentKey;
                pdbViewer.render();
            }
        } else {
            hoverPopup.style.display = 'none';
            // Убираем подсветку
            if (lastHoveredKey) {
                var oldParts = lastHoveredKey.split('_');
                pdbViewer.setStyle(
                    { chain: oldParts[0], resi: parseInt(oldParts[1]) },
                    { cartoon: { color: 0x445566, opacity: 0.45 } }
                );
                lastHoveredKey = null;
                pdbViewer.render();
            }
        }
    },
    function(atom) {
        hoverPopup.style.display = 'none';
        if (lastHoveredKey) {
            var oldParts = lastHoveredKey.split('_');
            pdbViewer.setStyle(
                { chain: oldParts[0], resi: parseInt(oldParts[1]) },
                { cartoon: { color: 0x445566, opacity: 0.45 } }
            );
            lastHoveredKey = null;
            pdbViewer.render();
        }
    }
);

function removeHoverHighlight() {
    if (lastHoveredResidue) {
        var prev = lastHoveredResidue.split('_');
        try {
            pdbViewer.removeStyle({ chain: prev[0], resi: parseInt(prev[1]) }, { stick: null, sphere: null });
            pdbViewer.render();
        } catch(e) {}
        lastHoveredResidue = null;
    }
}
    
    window.pdbContentCache = pdbContent;
    window.currentPdbInfo = { peptideInfo: peptideInfo, peptideBonds: peptideBonds };
    
    setTimeout(function() {
        if (!document.getElementById('btn-cartoon')) {
            var cc = document.createElement('div');
            cc.className = 'structure-controls';
            cc.innerHTML = '<button id="btn-cartoon" class="active" onclick="setRepresentation(\'cartoon\')">Cartoon</button>' +
                           '<button id="btn-ballstick" onclick="setRepresentation(\'ballAndStick\')">Ball & Stick</button>';
            container.parentNode.appendChild(cc);
        }
    }, 50);
}

function getFullResidueName(threeLetter) {
    var names = {
        'ALA':'Alanine','ARG':'Arginine','ASN':'Asparagine','ASP':'Aspartic acid',
        'CYS':'Cysteine','GLN':'Glutamine','GLU':'Glutamic acid','GLY':'Glycine',
        'HIS':'Histidine','ILE':'Isoleucine','LEU':'Leucine','LYS':'Lysine',
        'MET':'Methionine','PHE':'Phenylalanine','PRO':'Proline','SER':'Serine',
        'THR':'Threonine','TRP':'Tryptophan','TYR':'Tyrosine','VAL':'Valine'
    };
    return names[threeLetter.toUpperCase()] || threeLetter;
}

function setRepresentation(type) {
    if (!pdbViewer || !window.pdbContentCache) return;
    
    pdbViewer.removeAllModels();
    pdbViewer.addModel(window.pdbContentCache, 'pdb');
    
    var info = window.currentPdbInfo || {};
    var peptideInfo = info.peptideInfo;
    var peptideBonds = info.peptideBonds || [];
    
    if (type === 'cartoon') {
        if (peptideInfo && peptideInfo.residues && peptideInfo.residues.length > 0) {
            // Фон - приглушенный сине-серый
            pdbViewer.setStyle({}, { cartoon: { color: 0x445566, opacity: 0.5 } });
            
            for (var i = 0; i < peptideInfo.residues.length; i++) {
                var color = getRainbowColor(i, peptideInfo.residues.length);
                pdbViewer.addStyle(
                    { chain: peptideInfo.chain, resi: peptideInfo.residues[i].resSeq },
                    { cartoon: { color: color, opacity: 0.95 } }
                );
            }
        } else {
            pdbViewer.setStyle({}, { cartoon: { colorscheme: 'ss', opacity: 0.85 } });
        }
        
        // Сферы на атомах серы
        for (var i = 0; i < peptideBonds.length; i++) {
            var bond = peptideBonds[i];
            pdbViewer.addSphere({ center: {x:bond.atom1.x, y:bond.atom1.y, z:bond.atom1.z}, radius: 0.4, color: 0xffcc00 });
            pdbViewer.addSphere({ center: {x:bond.atom2.x, y:bond.atom2.y, z:bond.atom2.z}, radius: 0.4, color: 0xffcc00 });
        }
        
        pdbViewer.zoomTo();
        
        setTimeout(function() {
            for (var i = 0; i < peptideBonds.length; i++) {
                var b = peptideBonds[i];
                pdbViewer.addArrow({
                    start: { x: b.atom1.x, y: b.atom1.y, z: b.atom1.z },
                    end: { x: b.atom2.x, y: b.atom2.y, z: b.atom2.z },
                    radius: 0.12, radiusRatio: 1.0, color: 0xff8800, alpha: 0.9
                });
            }
            pdbViewer.render();
        }, 100);
        
    } else if (type === 'ballAndStick') {
        if (peptideInfo && peptideInfo.residues && peptideInfo.residues.length > 0) {
            // Фон - приглушенный сине-серый (контрастнее)
            pdbViewer.setStyle({}, { 
                stick: { color: 0x445566, radius: 0.06 },
                sphere: { color: 0x445566, scale: 0.12 }
            });
            
            for (var i = 0; i < peptideInfo.residues.length; i++) {
                var color = getRainbowColor(i, peptideInfo.residues.length);
                pdbViewer.addStyle(
                    { chain: peptideInfo.chain, resi: peptideInfo.residues[i].resSeq },
                    { 
                        stick: { color: color, radius: 0.12 }, 
                        sphere: { color: color, scale: 0.25 } 
                    }
                );
            }
        } else {
            pdbViewer.setStyle({}, { 
                stick: { colorscheme: 'elem', radius: 0.12 }, 
                sphere: { colorscheme: 'elem', scale: 0.25 } 
            });
        }
        
        // Сферы на атомах серы
        for (var i = 0; i < peptideBonds.length; i++) {
            var bond = peptideBonds[i];
            pdbViewer.addSphere({ center: {x:bond.atom1.x, y:bond.atom1.y, z:bond.atom1.z}, radius: 0.5, color: 0xffcc00 });
            pdbViewer.addSphere({ center: {x:bond.atom2.x, y:bond.atom2.y, z:bond.atom2.z}, radius: 0.5, color: 0xffcc00 });
        }
        
        pdbViewer.zoomTo();
        
        setTimeout(function() {
            for (var i = 0; i < peptideBonds.length; i++) {
                var b = peptideBonds[i];
                pdbViewer.addArrow({
                    start: { x: b.atom1.x, y: b.atom1.y, z: b.atom1.z },
                    end: { x: b.atom2.x, y: b.atom2.y, z: b.atom2.z },
                    radius: 0.15, radiusRatio: 1.0, color: 0xff8800, alpha: 0.9
                });
            }
            pdbViewer.render();
        }, 100);
    }
    
    var cb = document.getElementById('btn-cartoon');
    var bb = document.getElementById('btn-ballstick');
    if (cb) { cb.classList.remove('active'); if (type === 'cartoon') cb.classList.add('active'); }
    if (bb) { bb.classList.remove('active'); if (type === 'ballAndStick') bb.classList.add('active'); }
}

function switchPDB(index) {
    index = parseInt(index);
    if (!window.pdbStructures || !window.pdbStructures[index]) return;
    
    var s = window.pdbStructures[index];
    window.currentPdbIndex = index;
    
    var ispan = document.getElementById('currentPdbId');
    var ilink = document.getElementById('rcsbLink');
    if (ispan) ispan.textContent = s.id;
    if (ilink) ilink.href = 'https://www.rcsb.org/structure/' + s.id;
    
    renderPDBStructure(s.content, s.id, window.currentPeptideSequence, window.currentDisulfideBonds);
}

function openRelatedPdb() {
    var sel = document.getElementById('relatedPdbSelect');
    if (sel && sel.value) window.open('https://www.rcsb.org/structure/' + sel.value, '_blank');
}

// ========== CHARTS ==========
function calculateLengthDistribution() {
    var lengths = peptidesData.map(function(p) { return p.length; }).filter(function(l) { return l > 0; });
    if (lengths.length === 0) return {};
    var maxL = Math.max.apply(null, lengths);
    var bins = {};
    for (var i = 1; i <= Math.ceil(maxL/5)*5; i += 5) bins[i+'-'+(i+4)] = 0;
    lengths.forEach(function(l) {
        var bi = Math.floor((l-1)/5), bs = bi*5+1;
        var label = bs+'-'+(bs+4);
        if (bins[label] !== undefined) bins[label]++;
    });
    var f = {};
    for (var k in bins) if (bins[k] > 0) f[k] = bins[k];
    return f;
}

function calculateAADistribution() {
    var cnt = { 'A':0,'R':0,'N':0,'D':0,'C':0,'Q':0,'E':0,'G':0,'H':0,'I':0,'L':0,'K':0,'M':0,'F':0,'P':0,'S':0,'T':0,'W':0,'Y':0,'V':0 };
    var total = 0;
    peptidesData.forEach(function(p) {
        (p.sequence_clean||'').split('').forEach(function(a) { if (cnt[a] !== undefined) { cnt[a]++; total++; } });
    });
    var r = {};
    for (var a in cnt) r[a] = total > 0 ? (cnt[a]/total*100).toFixed(1) : 0;
    return r;
}

function createLengthChart() {
    var ctx = document.getElementById('lengthChart');
    if (!ctx || typeof Chart === 'undefined') return;
    var d = calculateLengthDistribution();
    if (lengthChart) lengthChart.destroy();
    lengthChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(d), datasets: [{ label: 'Peptides', data: Object.values(d), backgroundColor: 'rgba(66,153,225,0.7)' }] },
        options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

function createAAChart() {
    var ctx = document.getElementById('aaChart');
    if (!ctx || typeof Chart === 'undefined') return;
    var d = calculateAADistribution();
    if (aaChart) aaChart.destroy();
    aaChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(d), datasets: [{ label: '%', data: Object.values(d), backgroundColor: '#4299e1' }] },
        options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
    });
}

// ========== HOME PAGE ==========
function initHomePage() {
    updateHomeStats();
    displayFeaturedPeptides();
    setTimeout(function() {
        if (peptidesData.length > 0 && typeof Chart !== 'undefined') { createLengthChart(); createAAChart(); }
    }, 100);
}

function updateHomeStats() {
    var t = peptidesData.length;
    var sum = peptidesData.reduce(function(s,p) { return s + p.length; }, 0);
    var ae = document.getElementById('totalPeptides'), le = document.getElementById('avgLength');
    if (ae) ae.textContent = t;
    if (le) le.textContent = t > 0 ? (sum/t).toFixed(1) : '0';
}

function displayFeaturedPeptides() {
    var c = document.getElementById('featuredPeptides');
    if (!c) return;
    var fp = peptidesData.slice(0,6);
    var h = '';
    fp.forEach(function(p) {
        var u = getPeptideUrl(p.id, p.peptide_name);
        h += '<div class="peptide-card" onclick="location.href=\''+u+'\'" style="cursor:pointer"><div class="card-header"><h3>'+(p.peptide_name||'Unnamed')+'</h3></div><div class="card-content"><div class="card-row"><div class="card-label">Source:</div><div class="card-value">'+(p.source_organism||'N/A')+'</div></div><div class="card-row"><div class="card-label">Length:</div><div class="card-value">'+(p.length||'N/A')+' aa</div></div><div class="card-row"><div class="card-label">MW:</div><div class="card-value">'+(p.molecular_weight?p.molecular_weight.toFixed(1):'N/A')+' Da</div></div></div></div>';
    });
    c.innerHTML = h || '<div class="loading">No peptides found</div>';
}

// ========== BROWSE PAGE ==========
function initBrowsePage() {
    // Восстанавливаем фильтры
    var restored = restoreFilters();
    
    if (!restored) {
        filteredPeptides = [...peptidesData];
    } else {
        // Применяем сохраненные фильтры
        applyFilters();
        if (currentView) {
            setTimeout(function() {
                document.querySelectorAll('.toggle-btn').forEach(function(b,i) {
                    b.classList.toggle('active', (currentView==='table'&&i===0)||(currentView==='card'&&i===1));
                });
            }, 100);
        }
        return; // applyFilters уже вызвал displayBrowseResults
    }
    
    updateBrowseStats();
    displayBrowseResults();
    setupBrowseEventListeners();
    initModificationSelector();
    initSourceSelector();
}

function setupBrowseEventListeners() {
    ['searchInput','lengthMin','lengthMax','disulfideFilter','pdbFilter'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', function() { saveFilters(); applyFilters(); });
            if (id === 'searchInput') el.addEventListener('keypress', function(e) { if (e.key==='Enter') { saveFilters(); applyFilters(); } });
        }
    });
}

function initModificationSelector() {
    var dd = document.getElementById('modDropdown');
    if (!dd) return;
    var mt = {};
    peptidesData.forEach(function(p) {
        (p.modifications||[]).forEach(function(m) { if (m && m!=='N/A' && m!=='') mt[m.replace(/_/g,' ')] = m; });
    });
    var sk = Object.keys(mt).sort();
    dd.innerHTML = sk.map(function(k) { return '<div class="multiselect-option"><input type="checkbox" value="'+mt[k]+'" onchange="updateModSelectionAndFilter()"><label>'+k+'</label></div>'; }).join('');
}

function toggleModDropdown() { var d=document.getElementById('modDropdown'); if(d) d.classList.toggle('show'); }

function updateModSelectionAndFilter() {
    selectedMods = [];
    document.querySelectorAll('#modDropdown input:checked').forEach(function(cb) { selectedMods.push(cb.value); });
    var span = document.getElementById('modSelectedText');
    if (span) span.textContent = selectedMods.length === 0 ? 'All' : (selectedMods.length === 1 ? selectedMods[0].replace(/_/g,' ') : selectedMods.length+' selected');
    saveFilters();
    applyFilters();
}

function initSourceSelector() {
    var dd = document.getElementById('sourceDropdown');
    if (!dd) return;
    var src = {};
    peptidesData.forEach(function(p) {
        if (p.source_organism && p.source_organism !== 'N/A') {
            p.source_organism.split(',').forEach(function(s) {
                s = s.trim().toLowerCase();
                if (s) src[s.charAt(0).toUpperCase()+s.slice(1)] = s;
            });
        }
    });
    var sk = Object.keys(src).sort();
    dd.innerHTML = sk.map(function(k) { return '<div class="multiselect-option"><input type="checkbox" value="'+src[k]+'" onchange="updateSourceSelectionAndFilter()"><label>'+k+'</label></div>'; }).join('');
}

function toggleSourceDropdown() { var d=document.getElementById('sourceDropdown'); if(d) d.classList.toggle('show'); }

function updateSourceSelectionAndFilter() {
    selectedSources = [];
    document.querySelectorAll('#sourceDropdown input:checked').forEach(function(cb) { selectedSources.push(cb.value); });
    var span = document.getElementById('sourceSelectedText');
    if (span) span.textContent = selectedSources.length === 0 ? 'All' : (selectedSources.length === 1 ? selectedSources[0].charAt(0).toUpperCase()+selectedSources[0].slice(1) : selectedSources.length+' selected');
    saveFilters();
    applyFilters();
}

function updateBrowseStats() {
    var el = document.getElementById('resultsCount');
    if (el) el.textContent = 'Found peptides: ' + filteredPeptides.length;
}

function applyFilters() {
    var st = (document.getElementById('searchInput')?.value||'').toLowerCase();
    var dv = document.getElementById('disulfideFilter')?.value||'all';
    var pv = document.getElementById('pdbFilter')?.value||'all';
    var mn = parseInt(document.getElementById('lengthMin')?.value)||0;
    var mx = parseInt(document.getElementById('lengthMax')?.value)||1000;
    
    var result = [];
    for (var i = 0; i < peptidesData.length; i++) {
        var p = peptidesData[i];
        if (st && !(p.peptide_name||'').toLowerCase().includes(st) && !(p.sequence_one_letter||'').toLowerCase().includes(st) && !(p.source_organism||'').toLowerCase().includes(st)) continue;
        if (p.length < mn || p.length > mx) continue;
        if (selectedSources.length > 0) {
            var ps = (p.source_organism||'').toLowerCase().split(',').map(function(s){return s.trim();});
            if (!selectedSources.every(function(s){return ps.indexOf(s)!==-1;})) continue;
        }
        if (dv === 'yes' && (!p.disulfide_bridge || p.disulfide_bridge.toLowerCase()==='no')) continue;
        if (dv === 'no' && p.disulfide_bridge && p.disulfide_bridge.toLowerCase()!=='no') continue;
        if (pv === 'yes' && !p.has_pdb) continue;
        if (pv === 'no' && p.has_pdb) continue;
        if (selectedMods.length > 0) {
            var pm = p.modifications||[];
            if (!selectedMods.every(function(m){return pm.indexOf(m)!==-1;})) continue;
        }
        result.push(p);
    }
    filteredPeptides = result;
    updateBrowseStats();
    displayBrowseResults();
    
    // Сохраняем сортировку при возврате
    if (sortColumn && sortDirection) {
        sortBy(sortColumn);
        if (sortDirection === 'desc') sortBy(sortColumn); // дважды для desc
    }
}

function resetFilters() {
    ['searchInput'].forEach(function(id) { var el=document.getElementById(id); if(el) el.value=''; });
    ['disulfideFilter','pdbFilter'].forEach(function(id) { var el=document.getElementById(id); if(el) el.value='all'; });
    var lmin=document.getElementById('lengthMin'); if(lmin) lmin.value=0;
    var lmax=document.getElementById('lengthMax'); if(lmax) lmax.value=100;
    
    document.querySelectorAll('#sourceDropdown input,#modDropdown input').forEach(function(cb){cb.checked=false;});
    selectedSources=[]; selectedMods=[];
    var st=document.getElementById('sourceSelectedText'); if(st) st.textContent='All';
    var mt=document.getElementById('modSelectedText'); if(mt) mt.textContent='All';
    
    sortColumn='peptide_name'; sortDirection='asc';
    filteredPeptides=[...peptidesData];
    saveFilters();
    updateBrowseStats();
    displayBrowseResults();
}

function downloadFASTA() {
    if (!filteredPeptides.length) return alert('No results');
    var fa='';
    filteredPeptides.forEach(function(p) {
        fa+='>'+(p.peptide_name||'peptide_'+p.id)+'\n';
        var seq=p.sequence_clean||'';
        for(var i=0;i<seq.length;i+=60) fa+=seq.substring(i,i+60)+'\n';
    });
    var b=new Blob([fa],{type:'text/plain'}), a=document.createElement('a');
    a.href=URL.createObjectURL(b); a.download='barrpeps.fasta'; a.click();
}

function downloadFullCSV() {
    if (!filteredPeptides.length) return alert('No results');
    var h=['ID','Name','Sequence','Clean','Length','MW','Formula','Structure','Disulfide','Source','Modifications','PDB_IDs','Has_PDB'];
    var rows=filteredPeptides.map(function(p){return[p.id,p.peptide_name,p.sequence_one_letter,p.sequence_clean,p.length,p.molecular_weight,p.molecular_formula,p.structure_type,p.disulfide_bridge,p.source_organism,(p.modifications||[]).join('; '),(p.pdb_ids||[]).join('; '),p.has_pdb?'Yes':'No'];});
    var csv=h.join(',')+'\n'+rows.map(function(r){return r.map(function(c){return'"'+String(c||'').replace(/"/g,'""')+'"';}).join(',');}).join('\n');
    var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}), a=document.createElement('a');
    a.href=URL.createObjectURL(b); a.download='barrpeps_full.csv'; a.click();
}

function displayBrowseResults() {
    var c=document.getElementById('resultsContainer');
    if(!c) return;
    if(!filteredPeptides.length) { c.innerHTML='<div style="text-align:center;padding:2rem;">No peptides found</div>'; return; }
    if(currentView==='table') displayTableView(c); else displayCardView(c);
}

function displayTableView(container) {
    var h='<div class="table-wrapper"><table class="data-table" style="width:100%;min-width:1000px;"><thead><tr><th onclick="sortBy(\'peptide_name\')">Name</th><th onclick="sortBy(\'sequence_one_letter\')">Sequence</th><th onclick="sortBy(\'length\')">Len</th><th onclick="sortBy(\'molecular_weight\')">MW</th><th>Mods</th><th onclick="sortBy(\'source_organism\')">Source</th><th onclick="sortBy(\'has_pdb\')">PDB</th><th>Details</th></tr></thead><tbody>';
    filteredPeptides.forEach(function(p){
        var seq=(p.sequence_one_letter||''); if(seq.length>35) seq=seq.substring(0,35)+'...';
        var u=getPeptideUrl(p.id,p.peptide_name);
        var pdb=p.has_pdb?'<span style="background:#48bb78;color:white;padding:2px 6px;border-radius:10px;font-size:0.65rem;">Yes</span>':'<span style="color:#a0aec0;">No</span>';
        var mods='';
        if(p.modifications&&p.modifications.length){
            var mf=p.modifications.map(function(m){return m.replace(/_/g,' ');});
            mods='<span style="font-size:0.65rem;color:#d69e2e;" title="'+mf.join(', ')+'">'+mf.slice(0,3).join(', ')+(mf.length>3?' +'+(mf.length-3):'')+'</span>';
        }else{mods='<span style="color:#a0aec0;font-size:0.65rem;">—</span>';}
        h+='<tr><td><a href="'+u+'" style="color:#2c5282;font-weight:bold;">'+(p.peptide_name||'N/A')+'</a></td><td style="font-family:monospace;font-size:0.7rem;">'+seq+'</td><td>'+(p.length||'N/A')+'</td><td>'+(p.molecular_weight?p.molecular_weight.toFixed(1):'N/A')+'</td><td>'+mods+'</td><td>'+(p.source_organism||'N/A')+'</td><td style="text-align:center;">'+pdb+'</td><td><a href="'+u+'" class="btn-primary" style="padding:4px 10px;font-size:0.7rem;">View</a></td></tr>';
    });
    h+='</tbody></table></div>'; container.innerHTML=h;
}

function displayCardView(container) {
    var h='<div class="peptide-grid">';
    filteredPeptides.forEach(function(p){
        var u=getPeptideUrl(p.id,p.peptide_name);
        var pdb=p.has_pdb?'<span style="background:#48bb78;color:white;padding:2px 6px;border-radius:10px;font-size:0.6rem;margin-left:0.5rem;">PDB</span>':'';
        var mods='';
        if(p.modifications&&p.modifications.length){
            var mf=p.modifications.map(function(m){return m.replace(/_/g,' ');});
            mods='<div class="card-row"><div class="card-label">Mods:</div><div class="card-value" style="color:#d69e2e;" title="'+mf.join(', ')+'">'+mf.slice(0,2).join(', ')+(mf.length>2?' +'+(mf.length-2):'')+'</div></div>';
        }
        h+='<div class="peptide-card" onclick="location.href=\''+u+'\'" style="cursor:pointer;"><div class="card-header"><h3>'+(p.peptide_name||'Unnamed')+pdb+'</h3></div><div class="card-content"><div class="card-row"><div class="card-label">Source:</div><div class="card-value">'+(p.source_organism||'N/A')+'</div></div><div class="card-row"><div class="card-label">Length:</div><div class="card-value">'+(p.length||'N/A')+' aa</div></div><div class="card-row"><div class="card-label">MW:</div><div class="card-value">'+(p.molecular_weight?p.molecular_weight.toFixed(1):'N/A')+' Da</div></div>'+mods+'</div></div>';
    });
    h+='</div>'; container.innerHTML=h;
}

function setView(view) {
    currentView=view;
    document.querySelectorAll('.toggle-btn').forEach(function(b,i){b.classList.toggle('active',(view==='table'&&i===0)||(view==='card'&&i===1));});
    saveFilters();
    displayBrowseResults();
}

function sortBy(column) {
    if(sortColumn===column) sortDirection=sortDirection==='asc'?'desc':'asc';
    else{sortColumn=column;sortDirection='asc';}
    filteredPeptides.sort(function(a,b){
        var va=a[column], vb=b[column];
        if(va==null||va==='') va=-Infinity;
        if(vb==null||vb==='') vb=-Infinity;
        if(typeof va==='string'){va=va.toLowerCase();vb=vb.toLowerCase();}
        return (va<vb?-1:va>vb?1:0)*(sortDirection==='asc'?1:-1);
    });
    saveFilters();
    displayBrowseResults();
}

// ========== REFERENCES ==========
function formatLiteratureLinks(text) {
    if(!text||typeof text!=='string'||text.trim()===''||text==='{}'||text==='[]') return '';
    text=text.trim();
    var refs=[];
    if(text.startsWith('{')&&text.endsWith('}')){
        try{
            var p=JSON.parse(text.replace(/'/g,'"'));
            for(var k in p){
                if(p[k]&&typeof p[k]==='object'){
                    var r=p[k], s=(r['Author(s)']||'')+(r['Year']?' ('+r['Year']+')':'')+(r['Title']?' '+r['Title']:'')+(r['Journal']?' '+r['Journal']:'');
                    if(s.trim()) refs.push(s);
                }
            }
        }catch(e){refs.push(text);}
    }else{refs.push(text);}
    var h='';
    refs.forEach(function(t){
        t=t.replace(/(10\.\d{4,}\/[^\s,;.]+)/g,'<a href="https://doi.org/$1" target="_blank" style="color:#4299e1;">$1</a>');
        t=t.replace(/PMID:?\s*(\d+)/gi,'<a href="https://pubmed.ncbi.nlm.nih.gov/$1" target="_blank" style="color:#4299e1;">$&</a>');
        h+='<div class="detail-row" style="margin-bottom:0.5rem;"><span class="detail-value" style="font-size:0.8rem;line-height:1.5;">'+t+'</span></div>';
    });
    return h;
}

// ========== PEPTIDE DETAIL ==========
async function initPeptidePage() {
    var params=new URLSearchParams(window.location.search);
    var id=parseInt(params.get('id'));
    var peptide=peptidesData.find(function(p){return p.id===id;});
    if(!peptide){
        var dc=document.getElementById('peptideDetail');
        if(dc) dc.innerHTML='<div class="error-message"><p>Peptide not found</p><a href="browse.html" class="btn-primary">Browse Database</a></div>';
        return;
    }
    document.title=peptide.peptide_name+' - BarrPeps';
    
    var pdbContents=[], pdbIds=[];
    if(peptide.pdb_ids){
        for(var i=0;i<peptide.pdb_ids.length;i++){
            var c=await fetchPDBStructure(peptide.pdb_ids[i]);
            if(c){pdbContents.push(c);pdbIds.push(peptide.pdb_ids[i]);}
        }
    }
    displayPeptideDetail(peptide,pdbContents,pdbIds);
}

function displayPeptideDetail(peptide,pdbContents,pdbIds){
    var validStructures=[];
    for(var i=0;i<pdbIds.length;i++){if(pdbContents[i]) validStructures.push({id:pdbIds[i],content:pdbContents[i]});}
    var hasPDB=validStructures.length>0;
    window.currentPeptideSequence=peptide.sequence_clean;
    window.currentDisulfideBonds=peptide.disulfide_bonds||[];
    
    // Сохраняем ссылку "Back to Browse" с параметрами
    var backUrl = 'browse.html';
    
    var modsH='';
    if(peptide.modifications&&peptide.modifications.length){
        modsH='<div class="detail-section"><h3>Modifications</h3><div class="detail-row"><span class="detail-value">'+peptide.modifications.map(function(m){return m.replace(/_/g,' ');}).join(', ')+'</span></div></div>';
    }else{
        modsH='<div class="detail-section"><h3>Modifications</h3><div class="detail-row"><span class="detail-value">None reported</span></div></div>';
    }
    
    var pdbH='';
    if(peptide.pdb_ids&&peptide.pdb_ids.length){
        pdbH='<div class="detail-section"><h3>PDB Structures</h3><div class="detail-row"><span class="detail-label">Available:</span><span class="detail-value">'+peptide.pdb_ids.map(function(id){return'<a href="https://www.rcsb.org/structure/'+id+'" target="_blank" style="color:#4299e1;">'+id+'</a>';}).join(', ')+'</span></div>';
    }
    if(peptide.related_pdb_ids&&peptide.related_pdb_ids.length){
        pdbH+='<div class="detail-row" style="margin-top:0.75rem;"><span class="detail-label">Related:</span><span class="detail-value"><select id="relatedPdbSelect" style="padding:0.3rem;border:1px solid #cbd5e0;border-radius:6px;font-size:0.75rem;margin-right:0.5rem;"><option value="">-- Select --</option>'+peptide.related_pdb_ids.map(function(id){return'<option value="'+id+'">'+id+'</option>';}).join('')+'</select><button onclick="openRelatedPdb()" style="padding:0.3rem 0.8rem;background:#4299e1;color:white;border:none;border-radius:6px;font-size:0.7rem;cursor:pointer;">Open</button></span></div>';
    }
    if(pdbH) pdbH+='</div>';
    
    var expH='';
    if(peptide.experiments&&peptide.experiments.length){
        var seen={},unique=peptide.experiments.filter(function(e){var k=(e.method||'')+'|'+(e.response||'')+'|'+(e.result||'')+'|'+(e.unit||'');if(seen[k])return false;seen[k]=true;return true;});
        expH='<div class="detail-section"><h3>Experimental Data</h3><div class="table-wrapper"><table style="width:100%;font-size:0.75rem;"><thead><tr><th>Method</th><th>Type</th><th>Response</th><th>Result</th><th>Transport</th><th>Model</th></tr></thead><tbody>';
        unique.forEach(function(e){expH+='<tr><td>'+(e.method||'N/A')+'</td><td>'+(e.method_type||'N/A')+'</td><td>'+(e.response||'N/A')+'</td><td>'+(e.result||'')+(e.unit?' '+e.unit:'')+'</td><td>'+(e.transport_type||'N/A')+'</td><td>'+(e.cell_line||e.animal_model||'N/A')+'</td></tr>';});
        expH+='</tbody></table></div></div>';
    }else{
        expH='<div class="detail-section"><h3>Experimental Data</h3><div class="detail-row"><span class="detail-value">No experimental data available</span></div></div>';
    }
    
    var refH='', litH=formatLiteratureLinks(peptide.notes||'');
    refH=litH?'<div class="detail-section"><h3>References</h3>'+litH+'</div>':'<div class="detail-section"><h3>References</h3><div class="detail-row"><span class="detail-value">No references available</span></div></div>';
    
    var html='<div class="peptide-detail-container"><div style="margin-bottom:1rem;"><a href="'+backUrl+'" class="btn-secondary back-button">← Back to Browse</a><h1 style="color:#2c5282;margin-top:0.5rem;">'+(peptide.peptide_name||'N/A')+'</h1><p style="color:#718096;">ID: '+peptide.id+'</p></div>';
    
    if(hasPDB){
        var selH=validStructures.length>1?'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;"><h3 style="font-size:0.9rem;margin:0;">3D Structure</h3><select id="pdbSelector" onchange="switchPDB(this.value)">'+validStructures.map(function(s,i){return'<option value="'+i+'"'+(i===0?' selected':'')+'>'+s.id+'</option>';}).join('')+'</select></div>':'<h3 style="font-size:0.9rem;margin-bottom:0.6rem;">3D Structure - PDB: '+validStructures[0].id+'</h3>';
        html+='<div class="structure-viewer">'+selH+'<div id="structure-viewer-pdb" class="structure-container"></div><div class="structure-controls"><button id="btn-cartoon" class="active" onclick="setRepresentation(\'cartoon\')">Cartoon</button><button id="btn-ballstick" onclick="setRepresentation(\'ballAndStick\')">Ball & Stick</button></div><div class="structure-legend"><div class="legend-item"><div class="legend-color carbon"></div><span>Carbon</span></div><div class="legend-item"><div class="legend-color oxygen"></div><span>Oxygen</span></div><div class="legend-item"><div class="legend-color nitrogen"></div><span>Nitrogen</span></div><div class="legend-item"><div class="legend-color sulfur"></div><span>Sulfur</span></div><div class="legend-item"><div class="legend-color disulfide"></div><span>Disulfide</span></div></div><div class="pdb-info"><strong>PDB: <span id="currentPdbId">'+validStructures[0].id+'</span></strong> | <a href="https://www.rcsb.org/structure/'+validStructures[0].id+'" target="_blank" id="rcsbLink">RCSB</a></div></div>';
        window.pdbStructures=validStructures;
    }else{
        html+='<div class="structure-viewer"><h3>3D Structure</h3><div class="no-structure"><p>No PDB structure available.</p></div></div>';
    }
    
    html+='<div class="detail-section"><h3>Basic Information</h3><div class="detail-row"><span class="detail-label">Sequence:</span><span class="detail-value" style="font-family:monospace;word-break:break-all;">'+(peptide.sequence_one_letter||'N/A')+'</span></div><div class="detail-row"><span class="detail-label">Clean:</span><span class="detail-value" style="font-family:monospace;">'+(peptide.sequence_clean||'N/A')+'</span></div><div class="detail-row"><span class="detail-label">Length:</span><span class="detail-value">'+(peptide.length||'N/A')+' aa</span></div><div class="detail-row"><span class="detail-label">MW:</span><span class="detail-value">'+(peptide.molecular_weight?peptide.molecular_weight.toFixed(2):'N/A')+' Da</span></div>'+(peptide.molecular_formula?'<div class="detail-row"><span class="detail-label">Formula:</span><span class="detail-value">'+peptide.molecular_formula+'</span></div>':'')+'</div>'+(peptide.structure_type&&peptide.structure_type!=='N/A'?'<div class="detail-section"><h3>Structure</h3><div class="detail-row"><span class="detail-label">Type:</span><span class="detail-value">'+peptide.structure_type+'</span></div>'+(peptide.disulfide_bridge ? '<div class="detail-row"><span class="detail-label">Disulfide bonds:</span><span class="detail-value" style="color: #d69e2e; font-weight: 600;">' + peptide.disulfide_bridge + '</span></div>' : '')+'</div>':'')+(peptide.source_organism&&peptide.source_organism!=='N/A'?'<div class="detail-section"><h3>Source</h3><div class="detail-row"><span class="detail-label">Organism:</span><span class="detail-value">'+peptide.source_organism+'</span></div></div>':'')+pdbH+modsH+expH+refH+'</div>';
    
    var dc=document.getElementById('peptideDetail');
    if(dc) dc.innerHTML=html;
    
    if(hasPDB&&validStructures.length>0){
        setTimeout(function(){renderPDBStructure(validStructures[0].content,validStructures[0].id,peptide.sequence_clean,peptide.disulfide_bonds);},100);
    }
}

// ========== EXPORTS ==========
window.searchPeptides=applyFilters;
window.resetFilters=resetFilters;
window.setView=setView;
window.sortBy=sortBy;
window.applyAllFilters=applyFilters;
window.resetAllFilters=resetFilters;
window.downloadFASTA=downloadFASTA;
window.downloadFullCSV=downloadFullCSV;
window.setRepresentation=setRepresentation;
window.switchPDB=switchPDB;
window.openRelatedPdb=openRelatedPdb;
window.toggleModDropdown=toggleModDropdown;
window.updateModSelectionAndFilter=updateModSelectionAndFilter;
window.toggleSourceDropdown=toggleSourceDropdown;
window.updateSourceSelectionAndFilter=updateSourceSelectionAndFilter;
window.showUnderConstruction=showUnderConstruction;
window.closeModal=closeModal;

document.addEventListener('DOMContentLoaded',function(){
    if(typeof XLSX!=='undefined') loadExcelFile();
    else useFallbackData();
});
