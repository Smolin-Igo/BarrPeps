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
                if (lowerName === 'experiments') {
                    experimentsData = jsonData;
                } else if (lowerName === 'references') {
                    referencesData = jsonData;
                } else if (lowerName === 'modifications') {
                    modificationsData = jsonData;
                } else if (lowerName === 'pdb') {
                    pdbData = jsonData;
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
    peptidesData = [];
    processAllData();
}

// Парсинг дисульфидных связей из строки БД
function parseDisulfideBonds(disulfideStr) {
    if (!disulfideStr || disulfideStr.toLowerCase() === 'no' || disulfideStr === '') {
        return [];
    }
    
    var bonds = [];
    
    // Разделяем по ; или ,
    var parts = disulfideStr.split(/[;,]/);
    
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (!part) continue;
        
        // Формат CysXXX-CysYYY (прямой)
        var match = part.match(/Cys[-\s]*(\d+[A-Za-z]?)\s*-\s*Cys[-\s]*(\d+[A-Za-z]?)/i);
        if (match) {
            bonds.push({
                cys1: match[1],
                cys2: match[2],
                raw: part
            });
            continue;
        }
        
        // Формат Cys(XXX)-Cys(YYY)
        match = part.match(/Cys\s*\((\d+[A-Za-z]?)\)\s*-\s*Cys\s*\((\d+[A-Za-z]?)\)/i);
        if (match) {
            bonds.push({
                cys1: match[1],
                cys2: match[2],
                raw: part
            });
        }
    }
    
    return bonds;
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

// ========== PDB FUNCTIONS ==========

async function fetchPDBStructure(pdbId) {
    if (!pdbId || pdbId === '' || pdbId === 'N/A') return null;
    try {
        var response = await fetch('https://files.rcsb.org/download/' + pdbId + '.pdb');
        if (!response.ok) return null;
        return await response.text();
    } catch (error) {
        return null;
    }
}

function convertThreeToOne(threeLetter) {
    var aaMap = {
        'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
        'GLN': 'Q', 'GLU': 'E', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
        'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
        'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V'
    };
    return aaMap[threeLetter.toUpperCase()] || '';
}

function getRainbowColor(index, total) {
    if (total <= 1) return 0x00cc88;
    var ratio = index / (total - 1);
    var r, g, b;
    
    if (ratio < 0.25) {
        var t = ratio / 0.25;
        r = 0; g = Math.floor(100 + 155 * t); b = 255;
    } else if (ratio < 0.5) {
        var t = (ratio - 0.25) / 0.25;
        r = 0; g = 255; b = Math.floor(255 * (1 - t));
    } else if (ratio < 0.75) {
        var t = (ratio - 0.5) / 0.25;
        r = Math.floor(255 * t); g = 255; b = 0;
    } else {
        var t = (ratio - 0.75) / 0.25;
        r = 255; g = Math.floor(255 * (1 - t)); b = 0;
    }
    
    return (r << 16) | (g << 8) | b;
}

function findPeptideResidues(pdbContent, targetSequence) {
    if (!targetSequence) return null;
    
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
                    chains[currentChain] = { sequence: chainSequence, residues: chains[currentChain] ? chains[currentChain].residues : [] };
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
        chains[currentChain] = { sequence: chainSequence, residues: chains[currentChain] ? chains[currentChain].residues : [] };
    }
    
    targetSequence = targetSequence.toUpperCase();
    
    for (var chain in chains) {
        var seq = chains[chain].sequence;
        var startIdx = seq.indexOf(targetSequence);
        if (startIdx !== -1) {
            return {
                chain: chain,
                residues: chains[chain].residues.slice(startIdx, startIdx + targetSequence.length),
                match: 'full'
            };
        }
    }
    
    return null;
}

function findCysteineAtoms(pdbContent) {
    var lines = pdbContent.split('\n');
    var cysteines = {}; // ключ: chain_resSeq
    
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
                cysteines[key] = { resSeq: resSeq, chain: chainId, x: x, y: y, z: z };
            }
        }
    }
    
    return cysteines;
}

function matchDisulfideBonds(cysteineAtoms, bondsFromDB) {
    var matchedBonds = [];
    
    if (!bondsFromDB || bondsFromDB.length === 0) return matchedBonds;
    
    for (var i = 0; i < bondsFromDB.length; i++) {
        var bond = bondsFromDB[i];
        var cys1 = String(bond.cys1);
        var cys2 = String(bond.cys2);
        
        var found1 = null;
        var found2 = null;
        
        for (var key in cysteineAtoms) {
            var cys = cysteineAtoms[key];
            var resSeq = String(cys.resSeq);
            var chainRes = cys.chain + resSeq;
            
            // Проверяем разные форматы
            if (resSeq === cys1 || chainRes === cys1 || 
                resSeq === cys1.replace(/[A-Za-z]/g, '') || 
                (cys1.match(/^([A-Za-z])(\d+)$/) && cys.chain === RegExp.$1 && resSeq === RegExp.$2)) {
                found1 = cys;
            }
            if (resSeq === cys2 || chainRes === cys2 || 
                resSeq === cys2.replace(/[A-Za-z]/g, '') || 
                (cys2.match(/^([A-Za-z])(\d+)$/) && cys.chain === RegExp.$1 && resSeq === RegExp.$2)) {
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
    
    return matchedBonds;
}

function renderPDBStructure(pdbContent, pdbId, peptideSequence, disulfideBondsFromDB) {
    var container = document.getElementById('structure-viewer-pdb');
    if (!container) return;
    
    if (!pdbContent) {
        container.innerHTML = '<div class="no-structure"><p>No PDB structure available.</p></div>';
        return;
    }
    
    // Находим пептид по последовательности
    var peptideInfo = null;
    if (peptideSequence) {
        peptideInfo = findPeptideResidues(pdbContent, peptideSequence);
    }
    
    // Находим все цистеины и сопоставляем связи
    var cysteineAtoms = findCysteineAtoms(pdbContent);
    var matchedBonds = matchDisulfideBonds(cysteineAtoms, disulfideBondsFromDB || []);
    
    container.innerHTML = '';
    pdbViewer = $3Dmol.createViewer(container, { backgroundColor: 'white' });
    pdbViewer.addModel(pdbContent, 'pdb');
    pdbViewer.zoomTo();
    
    window.pdbContentCache = pdbContent;
    window.peptideInfo = peptideInfo;
    window.cysteineAtoms = cysteineAtoms;
    window.matchedBonds = matchedBonds;
    
    setRepresentation('cartoon');
}

function setRepresentation(type) {
    if (!pdbViewer) return;
    
    pdbViewer.removeAllModels();
    pdbViewer.addModel(window.pdbContentCache, 'pdb');
    
    var peptideInfo = window.peptideInfo;
    var cysteineAtoms = window.cysteineAtoms || {};
    var matchedBonds = window.matchedBonds || [];
    
    if (type === 'cartoon') {
        if (peptideInfo && peptideInfo.residues) {
            // Серый фон для всего
            pdbViewer.setStyle({}, { cartoon: { color: 0xcccccc, opacity: 0.4 } });
            
            // Rainbow для пептида
            var residues = peptideInfo.residues;
            for (var i = 0; i < residues.length; i++) {
                var color = getRainbowColor(i, residues.length);
                pdbViewer.addStyle(
                    { chain: peptideInfo.chain, resi: residues[i].resSeq },
                    { cartoon: { color: color, opacity: 0.95 } }
                );
            }
            
            // Обновляем легенду
            var legendContainer = document.querySelector('.structure-legend');
            if (legendContainer) {
                var oldItem = document.getElementById('peptideLegendItem');
                if (oldItem) oldItem.remove();
                
                var newItem = document.createElement('div');
                newItem.id = 'peptideLegendItem';
                newItem.className = 'legend-item';
                newItem.style.width = '100%';
                newItem.style.marginTop = '0.3rem';
                newItem.style.justifyContent = 'center';
                newItem.innerHTML = '<div style="display: flex; align-items: center; gap: 0.3rem;">' +
                    '<span style="font-size: 0.6rem;">N</span>' +
                    '<div style="width: 100px; height: 12px; background: linear-gradient(to right, #0066ff, #00ff66, #ffff00, #ff6600, #ff0000); border-radius: 6px;"></div>' +
                    '<span style="font-size: 0.6rem;">C</span>' +
                    '</div><span style="margin-left: 0.5rem; font-size: 0.65rem;">Peptide (Chain ' + peptideInfo.chain + ')</span>';
                legendContainer.appendChild(newItem);
            }
        } else {
            pdbViewer.setStyle({}, { cartoon: { colorscheme: 'ss', opacity: 0.85 } });
        }
        
        // Выделяем ВСЕ цистеины (включая не входящие в связи)
        for (var key in cysteineAtoms) {
            var cys = cysteineAtoms[key];
            pdbViewer.addStyle(
                { chain: cys.chain, resi: cys.resSeq, atom: "SG" },
                { sphere: { color: 0xffcc00, scale: 0.25, opacity: 0.9 } }
            );
        }
        
        pdbViewer.removeAllShapes();
        
        // Добавляем цилиндры между атомами серы
        for (var i = 0; i < matchedBonds.length; i++) {
            var bond = matchedBonds[i];
            if (bond.cys1.x && bond.cys2.x) {
                try {
                    pdbViewer.addCylinder({
                        start: {x: bond.cys1.x, y: bond.cys1.y, z: bond.cys1.z},
                        end: {x: bond.cys2.x, y: bond.cys2.y, z: bond.cys2.z},
                        radius: 0.12,
                        color: 0xff8800,
                        fromCap: 1,
                        toCap: 1
                    });
                } catch(e) {}
            }
        }
    } 
    else if (type === 'ballAndStick') {
        if (peptideInfo && peptideInfo.residues) {
            pdbViewer.setStyle({}, { 
                stick: { color: 0xcccccc, radius: 0.08 },
                sphere: { color: 0xcccccc, scale: 0.15 }
            });
            
            var residues = peptideInfo.residues;
            for (var i = 0; i < residues.length; i++) {
                var color = getRainbowColor(i, residues.length);
                pdbViewer.addStyle(
                    { chain: peptideInfo.chain, resi: residues[i].resSeq },
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
        
        for (var key in cysteineAtoms) {
            var cys = cysteineAtoms[key];
            pdbViewer.addStyle(
                { chain: cys.chain, resi: cys.resSeq, atom: "SG" },
                { sphere: { color: 0xffcc00, scale: 0.3, opacity: 0.9 } }
            );
        }
        
        pdbViewer.removeAllShapes();
        
        for (var i = 0; i < matchedBonds.length; i++) {
            var bond = matchedBonds[i];
            if (bond.cys1.x && bond.cys2.x) {
                try {
                    pdbViewer.addCylinder({
                        start: {x: bond.cys1.x, y: bond.cys1.y, z: bond.cys1.z},
                        end: {x: bond.cys2.x, y: bond.cys2.y, z: bond.cys2.z},
                        radius: 0.15,
                        color: 0xff8800,
                        fromCap: 1,
                        toCap: 1
                    });
                } catch(e) {}
            }
        }
    }
    
    pdbViewer.zoomTo();
    pdbViewer.render();
    
    var cartoonBtn = document.getElementById('btn-cartoon');
    var ballBtn = document.getElementById('btn-ballstick');
    if (cartoonBtn) { cartoonBtn.classList.remove('active'); if (type === 'cartoon') cartoonBtn.classList.add('active'); }
    if (ballBtn) { ballBtn.classList.remove('active'); if (type === 'ballAndStick') ballBtn.classList.add('active'); }
}

function switchPDB(index) {
    index = parseInt(index);
    if (!window.pdbStructures || !window.pdbStructures[index]) return;
    
    var structure = window.pdbStructures[index];
    window.currentPdbIndex = index;
    
    var pdbIdSpan = document.getElementById('currentPdbId');
    var rcsbLink = document.getElementById('rcsbLink');
    if (pdbIdSpan) pdbIdSpan.textContent = structure.id;
    if (rcsbLink) rcsbLink.href = 'https://www.rcsb.org/structure/' + structure.id;
    
    renderPDBStructure(structure.content, structure.id, window.currentPeptideSequence, window.currentDisulfideBonds);
}

function openRelatedPdb() {
    var select = document.getElementById('relatedPdbSelect');
    if (select && select.value) {
        window.open('https://www.rcsb.org/structure/' + select.value, '_blank');
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
    var binSize = 5;
    var bins = {};
    
    for (var i = 1; i <= Math.ceil(maxLength / binSize) * binSize; i += binSize) {
        bins[i + '-' + (i + binSize - 1)] = 0;
    }
    
    for (var i = 0; i < lengths.length; i++) {
        var binIndex = Math.floor((lengths[i] - 1) / binSize);
        var binStart = binIndex * binSize + 1;
        var label = binStart + '-' + (binStart + binSize - 1);
        if (bins[label] !== undefined) bins[label]++;
    }
    
    var filtered = {};
    for (var label in bins) {
        if (bins[label] > 0) filtered[label] = bins[label];
    }
    return filtered;
}

function calculateAADistribution() {
    var aaCounts = { 'A':0,'R':0,'N':0,'D':0,'C':0,'Q':0,'E':0,'G':0,'H':0,'I':0,'L':0,'K':0,'M':0,'F':0,'P':0,'S':0,'T':0,'W':0,'Y':0,'V':0 };
    var total = 0;
    
    for (var p = 0; p < peptidesData.length; p++) {
        var seq = peptidesData[p].sequence_clean || '';
        for (var i = 0; i < seq.length; i++) {
            if (aaCounts[seq[i]] !== undefined) { aaCounts[seq[i]]++; total++; }
        }
    }
    
    var result = {};
    for (var aa in aaCounts) {
        result[aa] = total > 0 ? (aaCounts[aa] / total * 100).toFixed(1) : 0;
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
        data: { labels: Object.keys(dist), datasets: [{ label: 'Number of Peptides', data: Object.values(dist), backgroundColor: 'rgba(66,153,225,0.7)', borderColor: 'rgba(66,153,225,1)', borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Count' }, ticks: { stepSize: 1 } }, x: { title: { display: true, text: 'Length (aa)' } } } }
    });
}

function createAAChart() {
    var ctx = document.getElementById('aaChart');
    if (!ctx || typeof Chart === 'undefined') return;
    var dist = calculateAADistribution();
    if (aaChart) aaChart.destroy();
    aaChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(dist), datasets: [{ label: 'Frequency (%)', data: Object.values(dist), backgroundColor: '#4299e1', borderColor: '#2c5282', borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Frequency (%)' } }, x: { title: { display: true, text: 'Amino Acid' } } } }
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
    if (featured.length === 0) { container.innerHTML = '<div class="loading">No peptides found</div>'; return; }
    
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
            '</div></div>';
    }
    container.innerHTML = html;
}

// ========== BROWSE PAGE ==========
function initBrowsePage() {
    filteredPeptides = [...peptidesData];
    updateBrowseStats();
    displayBrowseResults();
    setupBrowseEventListeners();
    initModificationSelector();
    initSourceSelector();
}

function setupBrowseEventListeners() {
    var inputs = ['searchInput', 'lengthMin', 'lengthMax', 'disulfideFilter', 'pdbFilter'];
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

function initModificationSelector() {
    var dropdown = document.getElementById('modDropdown');
    if (!dropdown) return;
    var modTypes = {};
    for (var i = 0; i < peptidesData.length; i++) {
        var mods = peptidesData[i].modifications;
        for (var j = 0; j < mods.length; j++) {
            if (mods[j] && mods[j] !== 'N/A' && mods[j] !== '') {
                modTypes[mods[j].replace(/_/g, ' ')] = mods[j];
            }
        }
    }
    var sorted = Object.keys(modTypes).sort();
    var html = '';
    for (var k = 0; k < sorted.length; k++) {
        html += '<div class="multiselect-option"><input type="checkbox" value="' + modTypes[sorted[k]] + '" onchange="updateModSelectionAndFilter()"><label>' + sorted[k] + '</label></div>';
    }
    dropdown.innerHTML = html;
}

function toggleModDropdown() { var d = document.getElementById('modDropdown'); if (d) d.classList.toggle('show'); }

function updateModSelectionAndFilter() {
    selectedMods = [];
    var names = [];
    var cbs = document.querySelectorAll('#modDropdown input[type="checkbox"]');
    for (var i = 0; i < cbs.length; i++) {
        if (cbs[i].checked) { selectedMods.push(cbs[i].value); names.push(cbs[i].value.replace(/_/g, ' ')); }
    }
    var span = document.getElementById('modSelectedText');
    if (span) span.textContent = names.length === 0 ? 'All' : (names.length === 1 ? names[0] : names.length + ' selected');
    applyFilters();
}

function initSourceSelector() {
    var dropdown = document.getElementById('sourceDropdown');
    if (!dropdown) return;
    var sources = {};
    for (var i = 0; i < peptidesData.length; i++) {
        var source = peptidesData[i].source_organism;
        if (source && source !== 'N/A' && source !== '') {
            var parts = source.split(',').map(function(s) { return s.trim(); });
            for (var j = 0; j < parts.length; j++) {
                if (parts[j]) sources[parts[j].charAt(0).toUpperCase() + parts[j].slice(1).toLowerCase()] = parts[j].toLowerCase();
            }
        }
    }
    var sorted = Object.keys(sources).sort();
    var html = '';
    for (var k = 0; k < sorted.length; k++) {
        html += '<div class="multiselect-option"><input type="checkbox" value="' + sources[sorted[k]] + '" onchange="updateSourceSelectionAndFilter()"><label>' + sorted[k] + '</label></div>';
    }
    dropdown.innerHTML = html;
}

function toggleSourceDropdown() { var d = document.getElementById('sourceDropdown'); if (d) d.classList.toggle('show'); }

function updateSourceSelectionAndFilter() {
    selectedSources = [];
    var names = [];
    var cbs = document.querySelectorAll('#sourceDropdown input[type="checkbox"]');
    for (var i = 0; i < cbs.length; i++) {
        if (cbs[i].checked) { selectedSources.push(cbs[i].value); names.push(cbs[i].value.charAt(0).toUpperCase() + cbs[i].value.slice(1)); }
    }
    var span = document.getElementById('sourceSelectedText');
    if (span) span.textContent = names.length === 0 ? 'All' : (names.length === 1 ? names[0] : names.length + ' selected');
    applyFilters();
}

function updateBrowseStats() {
    var el = document.getElementById('resultsCount');
    if (el) el.textContent = 'Found peptides: ' + filteredPeptides.length;
}

function applyFilters() {
    var searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
    var disulfideVal = document.getElementById('disulfideFilter')?.value || 'all';
    var pdbVal = document.getElementById('pdbFilter')?.value || 'all';
    var minLen = parseInt(document.getElementById('lengthMin')?.value) || 0;
    var maxLen = parseInt(document.getElementById('lengthMax')?.value) || 1000;
    
    var result = [];
    for (var i = 0; i < peptidesData.length; i++) {
        var p = peptidesData[i];
        
        if (searchTerm) {
            if (!(p.peptide_name || '').toLowerCase().includes(searchTerm) &&
                !(p.sequence_one_letter || '').toLowerCase().includes(searchTerm) &&
                !(p.source_organism || '').toLowerCase().includes(searchTerm)) continue;
        }
        
        if (p.length < minLen || p.length > maxLen) continue;
        
        if (selectedSources.length > 0) {
            var pepSources = (p.source_organism || '').toLowerCase().split(',').map(function(s) { return s.trim(); });
            var hasAll = selectedSources.every(function(s) { return pepSources.indexOf(s) !== -1; });
            if (!hasAll) continue;
        }
        
        if (disulfideVal === 'yes' && (!p.disulfide_bridge || p.disulfide_bridge.toLowerCase() === 'no')) continue;
        if (disulfideVal === 'no' && p.disulfide_bridge && p.disulfide_bridge.toLowerCase() !== 'no') continue;
        
        if (pdbVal === 'yes' && !p.has_pdb) continue;
        if (pdbVal === 'no' && p.has_pdb) continue;
        
        if (selectedMods.length > 0) {
            var pepMods = p.modifications || [];
            var hasAllMods = selectedMods.every(function(m) { return pepMods.indexOf(m) !== -1; });
            if (!hasAllMods) continue;
        }
        
        result.push(p);
    }
    
    filteredPeptides = result;
    updateBrowseStats();
    displayBrowseResults();
}

function resetFilters() {
    ['searchInput','lengthMin','lengthMax','disulfideFilter','pdbFilter'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = id.includes('length') ? (id === 'lengthMin' ? 0 : 100) : (id.includes('Filter') ? 'all' : '');
    });
    
    document.querySelectorAll('#sourceDropdown input[type="checkbox"], #modDropdown input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
    selectedSources = [];
    selectedMods = [];
    var st = document.getElementById('sourceSelectedText'); if (st) st.textContent = 'All';
    var mt = document.getElementById('modSelectedText'); if (mt) mt.textContent = 'All';
    
    filteredPeptides = [...peptidesData];
    updateBrowseStats();
    displayBrowseResults();
}

function downloadFASTA() {
    if (filteredPeptides.length === 0) { alert('No results'); return; }
    var fasta = '';
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        fasta += '>' + (p.peptide_name || 'peptide_' + p.id) + '\n';
        var seq = p.sequence_clean || '';
        for (var j = 0; j < seq.length; j += 60) fasta += seq.substring(j, j + 60) + '\n';
    }
    var blob = new Blob([fasta], { type: 'text/plain' });
    var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'barrpeps.fasta'; link.click();
}

function downloadFullCSV() {
    if (filteredPeptides.length === 0) { alert('No results'); return; }
    var headers = ['ID','Name','Sequence','Clean_Sequence','Length','MW','Formula','Structure','Disulfide','Source','Modifications','PDB_IDs','Has_PDB'];
    var rows = [];
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        rows.push([p.id, p.peptide_name, p.sequence_one_letter, p.sequence_clean, p.length, p.molecular_weight, p.molecular_formula, p.structure_type, p.disulfide_bridge, p.source_organism, (p.modifications||[]).join('; '), (p.pdb_ids||[]).join('; '), p.has_pdb?'Yes':'No']);
    }
    var csv = headers.join(',') + '\n' + rows.map(function(r) { return r.map(function(c) { return '"' + String(c||'').replace(/"/g,'""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'barrpeps_full.csv'; link.click();
}

function displayBrowseResults() {
    var container = document.getElementById('resultsContainer');
    if (!container) return;
    if (filteredPeptides.length === 0) { container.innerHTML = '<div style="text-align:center;padding:2rem;">No peptides found</div>'; return; }
    if (currentView === 'table') displayTableView(container);
    else displayCardView(container);
}

function displayTableView(container) {
    var html = '<div class="table-wrapper"><table class="data-table" style="width:100%;min-width:1000px;">' +
        '<thead><tr><th onclick="sortBy(\'peptide_name\')">Name</th><th onclick="sortBy(\'sequence_one_letter\')">Sequence</th><th onclick="sortBy(\'length\')">Length</th><th onclick="sortBy(\'molecular_weight\')">MW</th><th>Modifications</th><th onclick="sortBy(\'source_organism\')">Source</th><th onclick="sortBy(\'has_pdb\')">PDB</th><th>Details</th></tr></thead><tbody>';
    
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        var seq = p.sequence_one_letter || '';
        if (seq.length > 35) seq = seq.substring(0,35) + '...';
        var url = getPeptideUrl(p.id, p.peptide_name);
        var pdb = p.has_pdb ? '<span style="background:#48bb78;color:white;padding:2px 6px;border-radius:10px;font-size:0.65rem;">Yes</span>' : '<span style="color:#a0aec0;">No</span>';
        var mods = '';
        if (p.modifications && p.modifications.length > 0) {
            var mf = p.modifications.map(function(m) { return m.replace(/_/g, ' '); });
            mods = '<span style="font-size:0.65rem;color:#d69e2e;" title="' + mf.join(', ') + '">' + mf.slice(0,3).join(', ') + (mf.length>3?' +'+(mf.length-3):'') + '</span>';
        } else { mods = '<span style="color:#a0aec0;font-size:0.65rem;">—</span>'; }
        
        html += '<tr><td><a href="' + url + '" style="color:#2c5282;font-weight:bold;">' + (p.peptide_name||'N/A') + '</a></td><td style="font-family:monospace;font-size:0.7rem;">' + seq + '</td><td>' + (p.length||'N/A') + '</td><td>' + (p.molecular_weight?p.molecular_weight.toFixed(1):'N/A') + '</td><td>' + mods + '</td><td>' + (p.source_organism||'N/A') + '</td><td style="text-align:center;">' + pdb + '</td><td><a href="' + url + '" class="btn-primary" style="padding:4px 10px;font-size:0.7rem;">View</a></td></tr>';
    }
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function displayCardView(container) {
    var html = '<div class="peptide-grid">';
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        var url = getPeptideUrl(p.id, p.peptide_name);
        var pdb = p.has_pdb ? '<span style="background:#48bb78;color:white;padding:2px 6px;border-radius:10px;font-size:0.6rem;margin-left:0.5rem;">PDB</span>' : '';
        var mods = '';
        if (p.modifications && p.modifications.length > 0) {
            var mf = p.modifications.map(function(m) { return m.replace(/_/g, ' '); });
            mods = '<div class="card-row"><div class="card-label">Modifications:</div><div class="card-value" style="color:#d69e2e;" title="' + mf.join(', ') + '">' + mf.slice(0,2).join(', ') + (mf.length>2?' +'+(mf.length-2):'') + '</div></div>';
        }
        html += '<div class="peptide-card" onclick="window.location.href=\'' + url + '\'" style="cursor:pointer;">' +
            '<div class="card-header"><h3>' + (p.peptide_name||'Unnamed') + pdb + '</h3></div>' +
            '<div class="card-content">' +
                '<div class="card-row"><div class="card-label">Source:</div><div class="card-value">' + (p.source_organism||'N/A') + '</div></div>' +
                '<div class="card-row"><div class="card-label">Length:</div><div class="card-value">' + (p.length||'N/A') + ' aa</div></div>' +
                '<div class="card-row"><div class="card-label">MW:</div><div class="card-value">' + (p.molecular_weight?p.molecular_weight.toFixed(1):'N/A') + ' Da</div></div>' + mods +
            '</div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

function setView(view) { currentView = view; document.querySelectorAll('.toggle-btn').forEach(function(b,i) { b.classList.toggle('active', (view==='table'&&i===0)||(view==='card'&&i===1)); }); displayBrowseResults(); }

function sortBy(column) {
    if (sortColumn === column) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    else { sortColumn = column; sortDirection = 'asc'; }
    filteredPeptides.sort(function(a,b) {
        var va = a[column], vb = b[column];
        if (va == null || va === '') va = -Infinity;
        if (vb == null || vb === '') vb = -Infinity;
        if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
        return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDirection === 'asc' ? 1 : -1);
    });
    displayBrowseResults();
}

// ========== REFERENCE FORMATTING ==========
function formatLiteratureLinks(text) {
    if (!text || typeof text !== 'string' || text.trim() === '' || text === '{}' || text === '[]') return '';
    text = text.trim();
    var refs = [];
    
    if (text.startsWith('{') && text.endsWith('}')) {
        try {
            var parsed = JSON.parse(text.replace(/'/g, '"'));
            for (var key in parsed) {
                if (parsed[key] && typeof parsed[key] === 'object') {
                    var r = parsed[key];
                    var s = (r['Author(s)']||'') + (r['Year']?' ('+r['Year']+')':'') + (r['Title']?' '+r['Title']:'') + (r['Journal']?' '+r['Journal']:'');
                    if (s.trim()) refs.push(s);
                }
            }
        } catch(e) { refs.push(text); }
    } else {
        refs.push(text);
    }
    
    var html = '';
    for (var i = 0; i < refs.length; i++) {
        var t = refs[i];
        t = t.replace(/(10\.\d{4,}\/[^\s,;.]+)/g, '<a href="https://doi.org/$1" target="_blank" style="color:#4299e1;">$1</a>');
        t = t.replace(/PMID:?\s*(\d+)/gi, '<a href="https://pubmed.ncbi.nlm.nih.gov/$1" target="_blank" style="color:#4299e1;">$&</a>');
        html += '<div class="detail-row" style="margin-bottom:0.5rem;"><span class="detail-value" style="font-size:0.8rem;line-height:1.5;">' + t + '</span></div>';
    }
    return html;
}

// ========== PEPTIDE DETAIL PAGE ==========
async function initPeptidePage() {
    var params = new URLSearchParams(window.location.search);
    var id = parseInt(params.get('id'));
    var peptide = peptidesData.find(function(p) { return p.id === id; });
    
    if (!peptide) {
        var dc = document.getElementById('peptideDetail');
        if (dc) dc.innerHTML = '<div class="error-message"><p>Peptide not found</p><a href="browse.html" class="btn-primary">Browse Database</a></div>';
        return;
    }
    
    document.title = peptide.peptide_name + ' - BarrPeps';
    
    var pdbContents = [], pdbIds = [];
    if (peptide.pdb_ids) {
        for (var i = 0; i < peptide.pdb_ids.length; i++) {
            var c = await fetchPDBStructure(peptide.pdb_ids[i]);
            if (c) { pdbContents.push(c); pdbIds.push(peptide.pdb_ids[i]); }
        }
    }
    
    displayPeptideDetail(peptide, pdbContents, pdbIds);
}

function displayPeptideDetail(peptide, pdbContents, pdbIds) {
    var validStructures = [];
    for (var i = 0; i < pdbIds.length; i++) {
        if (pdbContents[i]) validStructures.push({ id: pdbIds[i], content: pdbContents[i] });
    }
    var hasPDB = validStructures.length > 0;
    
    window.currentPeptideSequence = peptide.sequence_clean;
    window.currentDisulfideBonds = peptide.disulfide_bonds || [];
    
    // Модификации
    var modsHtml = '';
    if (peptide.modifications && peptide.modifications.length > 0) {
        modsHtml = '<div class="detail-section"><h3>Modifications</h3><div class="detail-row"><span class="detail-value">' + peptide.modifications.map(function(m){return m.replace(/_/g,' ');}).join(', ') + '</span></div></div>';
    } else {
        modsHtml = '<div class="detail-section"><h3>Modifications</h3><div class="detail-row"><span class="detail-value">None reported</span></div></div>';
    }
    
    // PDB
    var pdbHtml = '';
    if (peptide.pdb_ids && peptide.pdb_ids.length > 0) {
        var links = peptide.pdb_ids.map(function(id) { return '<a href="https://www.rcsb.org/structure/' + id + '" target="_blank" style="color:#4299e1;">' + id + '</a>'; });
        pdbHtml = '<div class="detail-section"><h3>PDB Structures</h3><div class="detail-row"><span class="detail-label">Available:</span><span class="detail-value">' + links.join(', ') + '</span></div>';
    }
    if (peptide.related_pdb_ids && peptide.related_pdb_ids.length > 0) {
        var opts = peptide.related_pdb_ids.map(function(id) { return '<option value="' + id + '">' + id + '</option>'; }).join('');
        pdbHtml += '<div class="detail-row" style="margin-top:0.75rem;"><span class="detail-label">Related:</span><span class="detail-value"><select id="relatedPdbSelect" style="padding:0.3rem;border:1px solid #cbd5e0;border-radius:6px;font-size:0.75rem;margin-right:0.5rem;"><option value="">-- Select --</option>' + opts + '</select><button onclick="openRelatedPdb()" style="padding:0.3rem 0.8rem;background:#4299e1;color:white;border:none;border-radius:6px;font-size:0.7rem;cursor:pointer;">Open</button></span></div>';
    }
    if (pdbHtml) pdbHtml += '</div>';
    
    // Эксперименты
    var expHtml = '';
    if (peptide.experiments && peptide.experiments.length > 0) {
        var seen = {};
        var unique = peptide.experiments.filter(function(e) {
            var k = (e.method||'')+'|'+(e.response||'')+'|'+(e.result||'')+'|'+(e.unit||'');
            if (seen[k]) return false; seen[k] = true; return true;
        });
        expHtml = '<div class="detail-section"><h3>Experimental Data</h3><div class="table-wrapper"><table style="width:100%;font-size:0.75rem;"><thead><tr><th>Method</th><th>Type</th><th>Response</th><th>Result</th><th>Transport</th><th>Model</th></tr></thead><tbody>';
        for (var i = 0; i < unique.length; i++) {
            var e = unique[i];
            expHtml += '<tr><td>'+(e.method||'N/A')+'</td><td>'+(e.method_type||'N/A')+'</td><td>'+(e.response||'N/A')+'</td><td>'+(e.result||'')+(e.unit?' '+e.unit:'')+'</td><td>'+(e.transport_type||'N/A')+'</td><td>'+(e.cell_line||e.animal_model||'N/A')+'</td></tr>';
        }
        expHtml += '</tbody></table></div></div>';
    } else {
        expHtml = '<div class="detail-section"><h3>Experimental Data</h3><div class="detail-row"><span class="detail-value">No experimental data available</span></div></div>';
    }
    
    // References
    var refHtml = '';
    var litHtml = formatLiteratureLinks(peptide.notes || '');
    if (litHtml) {
        refHtml = '<div class="detail-section"><h3>References</h3>' + litHtml + '</div>';
    } else {
        refHtml = '<div class="detail-section"><h3>References</h3><div class="detail-row"><span class="detail-value">No references available</span></div></div>';
    }
    
    // Сборка
    var html = '<div class="peptide-detail-container"><div style="margin-bottom:1rem;"><a href="browse.html" class="btn-secondary back-button">← Back to Browse</a><h1 style="color:#2c5282;margin-top:0.5rem;">' + (peptide.peptide_name||'N/A') + '</h1><p style="color:#718096;">ID: ' + peptide.id + '</p></div>';
    
    if (hasPDB) {
        var selHtml = validStructures.length > 1 ? '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;"><h3 style="font-size:0.9rem;margin:0;">3D Structure</h3><select id="pdbSelector" onchange="switchPDB(this.value)">' + validStructures.map(function(s,i){return '<option value="'+i+'"'+(i===0?' selected':'')+'>'+s.id+'</option>';}).join('') + '</select></div>' : '<h3 style="font-size:0.9rem;margin-bottom:0.6rem;">3D Structure - PDB: ' + validStructures[0].id + '</h3>';
        
        html += '<div class="structure-viewer">' + selHtml + '<div id="structure-viewer-pdb" class="structure-container"></div>' +
            '<div class="structure-controls"><button id="btn-cartoon" class="active" onclick="setRepresentation(\'cartoon\')">Cartoon</button><button id="btn-ballstick" onclick="setRepresentation(\'ballAndStick\')">Ball & Stick</button></div>' +
            '<div class="structure-legend"><div class="legend-item"><div class="legend-color carbon"></div><span>Carbon</span></div><div class="legend-item"><div class="legend-color oxygen"></div><span>Oxygen</span></div><div class="legend-item"><div class="legend-color nitrogen"></div><span>Nitrogen</span></div><div class="legend-item"><div class="legend-color sulfur"></div><span>Sulfur</span></div><div class="legend-item"><div class="legend-color disulfide"></div><span>Disulfide</span></div></div>' +
            '<div class="pdb-info"><strong>PDB: <span id="currentPdbId">' + validStructures[0].id + '</span></strong> | <a href="https://www.rcsb.org/structure/' + validStructures[0].id + '" target="_blank" id="rcsbLink">RCSB</a></div></div>';
        window.pdbStructures = validStructures;
    } else {
        html += '<div class="structure-viewer"><h3>3D Structure</h3><div class="no-structure"><p>No PDB structure available.</p></div></div>';
    }
    
    html += '<div class="detail-section"><h3>Basic Information</h3>' +
        '<div class="detail-row"><span class="detail-label">Sequence:</span><span class="detail-value" style="font-family:monospace;word-break:break-all;">' + (peptide.sequence_one_letter||'N/A') + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Clean:</span><span class="detail-value" style="font-family:monospace;">' + (peptide.sequence_clean||'N/A') + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Length:</span><span class="detail-value">' + (peptide.length||'N/A') + ' aa</span></div>' +
        '<div class="detail-row"><span class="detail-label">MW:</span><span class="detail-value">' + (peptide.molecular_weight?peptide.molecular_weight.toFixed(2):'N/A') + ' Da</span></div>' +
        (peptide.molecular_formula?'<div class="detail-row"><span class="detail-label">Formula:</span><span class="detail-value">'+peptide.molecular_formula+'</span></div>':'') +
        '</div>' +
        (peptide.structure_type && peptide.structure_type !== 'N/A' ? '<div class="detail-section"><h3>Structure</h3><div class="detail-row"><span class="detail-label">Type:</span><span class="detail-value">'+peptide.structure_type+'</span></div>'+(peptide.disulfide_bridge?'<div class="detail-row"><span class="detail-label">Disulfide:</span><span class="detail-value">'+peptide.disulfide_bridge+'</span></div>':'')+'</div>' : '') +
        (peptide.source_organism && peptide.source_organism !== 'N/A' ? '<div class="detail-section"><h3>Source</h3><div class="detail-row"><span class="detail-label">Organism:</span><span class="detail-value">'+peptide.source_organism+'</span></div></div>' : '') +
        pdbHtml + modsHtml + expHtml + refHtml + '</div>';
    
    var dc = document.getElementById('peptideDetail');
    if (dc) dc.innerHTML = html;
    
    if (hasPDB && validStructures.length > 0) {
        setTimeout(function() {
            renderPDBStructure(validStructures[0].content, validStructures[0].id, peptide.sequence_clean, peptide.disulfide_bonds);
        }, 100);
    }
}

// ========== EXPORTS ==========
window.searchPeptides = applyFilters;
window.resetFilters = resetFilters;
window.setView = setView;
window.sortBy = sortBy;
window.applyAllFilters = applyFilters;
window.resetAllFilters = resetFilters;
window.downloadFASTA = downloadFASTA;
window.downloadFullCSV = downloadFullCSV;
window.setRepresentation = setRepresentation;
window.switchPDB = switchPDB;
window.openRelatedPdb = openRelatedPdb;
window.toggleModDropdown = toggleModDropdown;
window.updateModSelectionAndFilter = updateModSelectionAndFilter;
window.toggleSourceDropdown = toggleSourceDropdown;
window.updateSourceSelectionAndFilter = updateSourceSelectionAndFilter;
window.showUnderConstruction = showUnderConstruction;
window.closeModal = closeModal;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM ready');
    if (typeof XLSX !== 'undefined') {
        loadExcelFile();
    } else {
        useFallbackData();
    }
});