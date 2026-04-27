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
let disulfideBonds = [];

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
                } else if (lowerName === 'pdb') {
                    pdbData = jsonData;
                    console.log('PDB:', pdbData.length);
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
        { peptide_id: 2, trivial_name: "Insulin", sequence_1: "GIVEQCCTSICSLYQLENYCN", length: 21, molecular_weight: 5807.57, origin: "human", conformation: "Linear" }
    ];
    pdbData = [];
    processAllData();
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
    
    console.log('PDB Map keys:', Object.keys(pdbMap).length);
    
    var enhanced = [];
    for (var i = 0; i < peptidesData.length; i++) {
        var p = peptidesData[i];
        var pid = p['peptide_id'] || i + 1;
        var rawSeq = p['sequence_1'] || p['sequence_one_letter'] || '';
        var threeSeq = p['sequence_3'] || p['sequence_three_letter'] || '';
        
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
                    if (ids[k] && ids[k] !== 'Nah' && ids[k] !== 'N/A') {
                        pdbIds.push(ids[k]);
                    }
                }
            }
            
            if (relatedPdb && relatedPdb !== 'Nah' && relatedPdb !== '') {
                var relIds = relatedPdb.split(',').map(function(id) { return id.trim(); });
                for (var k = 0; k < relIds.length; k++) {
                    if (relIds[k] && relIds[k] !== 'Nah' && relIds[k] !== 'N/A') {
                        relatedPdbIds.push(relIds[k]);
                    }
                }
            }
        }
        
        var uniquePdbIds = [];
        for (var j = 0; j < pdbIds.length; j++) {
            if (uniquePdbIds.indexOf(pdbIds[j]) === -1) {
                uniquePdbIds.push(pdbIds[j]);
            }
        }
        
        var uniqueRelatedPdbIds = [];
        for (var j = 0; j < relatedPdbIds.length; j++) {
            if (uniqueRelatedPdbIds.indexOf(relatedPdbIds[j]) === -1) {
                uniqueRelatedPdbIds.push(relatedPdbIds[j]);
            }
        }
        
        var hasPDB = uniquePdbIds.length > 0;
        
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
            modifications: allMods,
            pdb_ids: uniquePdbIds,
            related_pdb_ids: uniqueRelatedPdbIds,
            has_pdb: hasPDB,
            notes: p['literature'] || p['Literature'] || p['LITERATURE'] || ''
        });
    }
    
    peptidesData = enhanced;
    filteredPeptides = [...peptidesData];
    
    var pdbCount = 0;
    for (var i = 0; i < peptidesData.length; i++) {
        if (peptidesData[i].has_pdb) pdbCount++;
    }
    console.log('Processed', peptidesData.length, 'peptides,', pdbCount, 'have PDB structures');
    
    var currentPage = window.location.pathname.split('/').pop();
    if (currentPage === 'index.html' || currentPage === '') {
        initHomePage();
    } else if (currentPage === 'browse.html') {
        initBrowsePage();
    } else if (currentPage === 'peptide.html') {
        initPeptidePage();
    }
}

// ========== PDB STRUCTURE FUNCTIONS ==========

async function fetchPDBStructure(pdbId) {
    if (!pdbId || pdbId === '' || pdbId === 'N/A') {
        return null;
    }
    
    try {
        var response = await fetch('https://files.rcsb.org/download/' + pdbId + '.pdb');
        if (!response.ok) {
            return null;
        }
        return await response.text();
    } catch (error) {
        console.error('Error fetching PDB:', error);
        return null;
    }
}

function convertThreeToOne(threeLetter) {
    var aaMap = {
        'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
        'GLN': 'Q', 'GLU': 'E', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
        'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
        'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V',
        'SEC': 'U', 'PYL': 'O', 'ASX': 'B', 'GLX': 'Z', 'XLE': 'J',
        'UNK': 'X'
    };
    return aaMap[threeLetter.toUpperCase()] || '';
}

function findLongestMatch(seq1, seq2) {
    var maxLength = 0;
    for (var i = 0; i < seq1.length; i++) {
        for (var j = 0; j < seq2.length; j++) {
            var k = 0;
            while (i + k < seq1.length && j + k < seq2.length && seq1[i + k] === seq2[j + k]) {
                k++;
            }
            if (k > maxLength) maxLength = k;
        }
    }
    return maxLength;
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
                    chains[currentChain] = {
                        sequence: chainSequence,
                        residues: chains[currentChain] ? chains[currentChain].residues : []
                    };
                }
                currentChain = chainId;
                chainSequence = '';
                chains[chainId] = { sequence: '', residues: [] };
            }
            
            var aa1 = convertThreeToOne(resName);
            if (aa1) {
                chainSequence += aa1;
                chains[chainId].residues.push({ resSeq: resSeq, aa: aa1, iCode: '' });
            }
        }
    }
    
    if (currentChain && chainSequence) {
        chains[currentChain] = {
            sequence: chainSequence,
            residues: chains[currentChain] ? chains[currentChain].residues : []
        };
    }
    
    targetSequence = targetSequence.toUpperCase();
    var bestMatch = { chain: null, residues: null, score: 0, startIndex: 0 };
    
    for (var chain in chains) {
        var seq = chains[chain].sequence;
        var startIdx = seq.indexOf(targetSequence);
        
        if (startIdx !== -1) {
            var matchedResidues = chains[chain].residues.slice(startIdx, startIdx + targetSequence.length);
            return { 
                chain: chain, 
                residues: matchedResidues, 
                match: 'full',
                startIndex: startIdx
            };
        }
        
        var matchScore = findLongestMatch(seq, targetSequence);
        if (matchScore > bestMatch.score) {
            bestMatch = { 
                chain: chain, 
                score: matchScore,
                residues: chains[chain].residues
            };
        }
    }
    
    if (bestMatch.score > targetSequence.length * 0.5) {
        return { 
            chain: bestMatch.chain, 
            residues: bestMatch.residues, 
            match: 'partial',
            startIndex: 0
        };
    }
    
    return null;
}

function getRainbowColor(index, total) {
    if (total <= 1) return 0x00cc88;
    
    var ratio = index / (total - 1);
    
    var r, g, b;
    
    if (ratio < 0.33) {
        var localRatio = ratio / 0.33;
        r = Math.floor(0 * (1 - localRatio) + 0 * localRatio);
        g = Math.floor(100 * (1 - localRatio) + 255 * localRatio);
        b = Math.floor(255 * (1 - localRatio) + 0 * localRatio);
    } else if (ratio < 0.66) {
        var localRatio = (ratio - 0.33) / 0.33;
        r = Math.floor(0 * (1 - localRatio) + 255 * localRatio);
        g = Math.floor(255 * (1 - localRatio) + 255 * localRatio);
        b = Math.floor(0 * (1 - localRatio) + 0 * localRatio);
    } else {
        var localRatio = (ratio - 0.66) / 0.34;
        r = Math.floor(255 * (1 - localRatio) + 255 * localRatio);
        g = Math.floor(255 * (1 - localRatio) + 0 * localRatio);
        b = Math.floor(0 * (1 - localRatio) + 0 * localRatio);
    }
    
    return (r << 16) | (g << 8) | b;
}

function findDisulfideBonds(pdbContent) {
    var lines = pdbContent.split('\n');
    var sulfurAtoms = [];
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.startsWith('ATOM')) {
            var atomName = line.substring(12, 16).trim();
            var resName = line.substring(17, 20).trim();
            var resSeq = parseInt(line.substring(22, 26).trim());
            
            if ((atomName === 'SG' || atomName === 'S') && resName === 'CYS') {
                var x = parseFloat(line.substring(30, 38));
                var y = parseFloat(line.substring(38, 46));
                var z = parseFloat(line.substring(46, 54));
                
                sulfurAtoms.push({
                    resSeq: resSeq,
                    x: x, y: y, z: z,
                    atomName: atomName,
                    resName: resName
                });
            }
        }
    }
    
    var bondsMap = new Map();
    var sulfurInBonds = new Set();
    
    for (var i = 0; i < sulfurAtoms.length; i++) {
        for (var j = i + 1; j < sulfurAtoms.length; j++) {
            if (sulfurAtoms[i].resSeq === sulfurAtoms[j].resSeq) continue;
            
            var dx = sulfurAtoms[i].x - sulfurAtoms[j].x;
            var dy = sulfurAtoms[i].y - sulfurAtoms[j].y;
            var dz = sulfurAtoms[i].z - sulfurAtoms[j].z;
            var distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (distance >= 1.8 && distance <= 2.5) {
                var cys1 = sulfurAtoms[i].resSeq;
                var cys2 = sulfurAtoms[j].resSeq;
                var pairKey = Math.min(cys1, cys2) + '-' + Math.max(cys1, cys2);
                
                if (!bondsMap.has(pairKey)) {
                    bondsMap.set(pairKey, {
                        cys1: cys1,
                        cys2: cys2,
                        distance: distance,
                        x1: sulfurAtoms[i].x,
                        y1: sulfurAtoms[i].y,
                        z1: sulfurAtoms[i].z,
                        x2: sulfurAtoms[j].x,
                        y2: sulfurAtoms[j].y,
                        z2: sulfurAtoms[j].z
                    });
                    sulfurInBonds.add(cys1);
                    sulfurInBonds.add(cys2);
                }
            }
        }
    }
    
    var bonds = [];
    var values = bondsMap.values();
    var next = values.next();
    while (!next.done) {
        bonds.push(next.value);
        next = values.next();
    }
    
    return { bonds: bonds, sulfurInBonds: sulfurInBonds };
}

function renderPDBStructure(pdbContent, pdbId, peptideSequence) {
    var container = document.getElementById('structure-viewer-pdb');
    if (!container) return;
    
    if (!pdbContent) {
        container.innerHTML = '<div class="no-structure"><p>No PDB structure available for this peptide.</p><p style="font-size: 0.7rem; margin-top: 0.5rem;">PDB ID: ' + (pdbId || 'N/A') + '</p></div>';
        return;
    }
    
    var peptideResidueInfo = null;
    if (peptideSequence) {
        peptideResidueInfo = findPeptideResidues(pdbContent, peptideSequence);
        if (peptideResidueInfo) {
            console.log('Found peptide in chain:', peptideResidueInfo.chain, 'Match:', peptideResidueInfo.match, 'Residues:', peptideResidueInfo.residues.length);
            window.peptideChain = peptideResidueInfo.chain;
        }
    }
    
    var result = findDisulfideBonds(pdbContent);
    disulfideBonds = result.bonds;
    var sulfurInBonds = result.sulfurInBonds;
    
    container.innerHTML = '';
    
    pdbViewer = $3Dmol.createViewer(container, { backgroundColor: 'white' });
    pdbViewer.addModel(pdbContent, 'pdb');
    pdbViewer.zoomTo();
    
    window.pdbContentCache = pdbContent;
    window.sulfurInBonds = sulfurInBonds;
    window.highlightPeptide = !!peptideResidueInfo;
    
    setRepresentationWithHighlight('cartoon', peptideResidueInfo);
}

function setRepresentationWithHighlight(type, peptideChainInfo) {
    if (!pdbViewer) return;
    
    pdbViewer.removeAllModels();
    pdbViewer.addModel(window.pdbContentCache, 'pdb');
    
    var peptideChain = peptideChainInfo ? peptideChainInfo.chain : null;
    var peptideResidues = peptideChainInfo ? peptideChainInfo.residues : null;
    
    if (type === 'cartoon') {
        if (peptideChain && peptideResidues && window.highlightPeptide) {
            pdbViewer.setStyle({}, { cartoon: { color: 0xcccccc, opacity: 0.4 } });
            
            var totalResidues = peptideResidues.length;
            
            for (var i = 0; i < peptideResidues.length; i++) {
                var residue = peptideResidues[i];
                var color = getRainbowColor(i, totalResidues);
                
                pdbViewer.addStyle(
                    { chain: peptideChain, resi: residue.resSeq },
                    { cartoon: { color: color, opacity: 0.95 } }
                );
            }
            
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
                    '</div>' +
                    '<span style="margin-left: 0.5rem; font-size: 0.65rem;">Peptide (Chain ' + peptideChain + ')</span>';
                legendContainer.appendChild(newItem);
            }
        } else {
            pdbViewer.setStyle({}, { 
                cartoon: { 
                    colorscheme: 'ss',
                    opacity: 0.85
                } 
            });
        }
        
        if (window.sulfurInBonds && disulfideBonds.length > 0) {
            for (var i = 0; i < disulfideBonds.length; i++) {
                var bond = disulfideBonds[i];
                pdbViewer.addStyle({resn: "CYS", resi: bond.cys1, atom: "SG"}, { 
                    sphere: { color: 0xffaa00, scale: 0.2, opacity: 0.9 }
                });
                pdbViewer.addStyle({resn: "CYS", resi: bond.cys2, atom: "SG"}, { 
                    sphere: { color: 0xffaa00, scale: 0.2, opacity: 0.9 }
                });
            }
        }
        
        pdbViewer.removeAllShapes();
        
        if (disulfideBonds && disulfideBonds.length > 0) {
            for (var i = 0; i < disulfideBonds.length; i++) {
                var bond = disulfideBonds[i];
                if (bond.x1 && bond.x2) {
                    try {
                        pdbViewer.addCylinder({
                            start: {x: bond.x1, y: bond.y1, z: bond.z1},
                            end: {x: bond.x2, y: bond.y2, z: bond.z2},
                            radius: 0.15,
                            color: 0xffaa00,
                            fromCap: 1,
                            toCap: 1
                        });
                    } catch(e) {
                        console.error('Error adding cylinder:', e);
                    }
                }
            }
        }
    } 
    else if (type === 'ballAndStick') {
        if (peptideChain && peptideResidues && window.highlightPeptide) {
            pdbViewer.setStyle({}, { 
                stick: { color: 0xcccccc, radius: 0.1 },
                sphere: { color: 0xcccccc, scale: 0.2 }
            });
            
            var totalResidues = peptideResidues.length;
            
            for (var i = 0; i < peptideResidues.length; i++) {
                var residue = peptideResidues[i];
                var color = getRainbowColor(i, totalResidues);
                
                pdbViewer.addStyle(
                    { chain: peptideChain, resi: residue.resSeq },
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
        
        if (window.sulfurInBonds && disulfideBonds.length > 0) {
            for (var i = 0; i < disulfideBonds.length; i++) {
                var bond = disulfideBonds[i];
                pdbViewer.addStyle({resn: "CYS", resi: bond.cys1, atom: "SG"}, { 
                    sphere: { color: 0xffaa00, scale: 0.25, opacity: 0.9 }
                });
                pdbViewer.addStyle({resn: "CYS", resi: bond.cys2, atom: "SG"}, { 
                    sphere: { color: 0xffaa00, scale: 0.25, opacity: 0.9 }
                });
            }
        }
        
        pdbViewer.removeAllShapes();
        
        if (disulfideBonds && disulfideBonds.length > 0) {
            for (var i = 0; i < disulfideBonds.length; i++) {
                var bond = disulfideBonds[i];
                if (bond.x1 && bond.x2) {
                    try {
                        pdbViewer.addCylinder({
                            start: {x: bond.x1, y: bond.y1, z: bond.z1},
                            end: {x: bond.x2, y: bond.y2, z: bond.z2},
                            radius: 0.18,
                            color: 0xffaa00,
                            fromCap: 1,
                            toCap: 1
                        });
                    } catch(e) {
                        console.error('Error adding cylinder:', e);
                    }
                }
            }
        }
    }
    
    pdbViewer.zoomTo();
    pdbViewer.render();
    
    var cartoonBtn = document.getElementById('btn-cartoon');
    var ballBtn = document.getElementById('btn-ballstick');
    
    if (cartoonBtn) cartoonBtn.classList.remove('active');
    if (ballBtn) ballBtn.classList.remove('active');
    
    if (type === 'cartoon' && cartoonBtn) cartoonBtn.classList.add('active');
    else if (type === 'ballAndStick' && ballBtn) ballBtn.classList.add('active');
}

function setRepresentation(type) {
    setRepresentationWithHighlight(type, window.peptideChain ? { chain: window.peptideChain, residues: [] } : null);
}

function switchPDB(index) {
    index = parseInt(index);
    if (!window.pdbStructures || !window.pdbStructures[index]) return;
    
    var structure = window.pdbStructures[index];
    window.currentPdbIndex = index;
    window.pdbContentCache = structure.content;
    
    var pdbIdSpan = document.getElementById('currentPdbId');
    var rcsbLink = document.getElementById('rcsbLink');
    if (pdbIdSpan) pdbIdSpan.textContent = structure.id;
    if (rcsbLink) rcsbLink.href = 'https://www.rcsb.org/structure/' + structure.id;
    
    var peptideSequence = window.currentPeptideSequence || '';
    
    renderPDBStructure(structure.content, structure.id, peptideSequence);
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
    
    var startBin = 1;
    var endBin = Math.ceil(maxLength / binSize) * binSize;
    
    for (var i = startBin; i <= endBin; i += binSize) {
        var binEnd = i + binSize - 1;
        var binLabel = i + '-' + binEnd;
        bins[binLabel] = 0;
    }
    
    for (var i = 0; i < lengths.length; i++) {
        var len = lengths[i];
        var binIndex = Math.floor((len - 1) / binSize);
        var binStart = binIndex * binSize + 1;
        var binEnd = binStart + binSize - 1;
        var binLabel = binStart + '-' + binEnd;
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
            plugins: { legend: { position: 'top' } },
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
            plugins: { legend: { position: 'top' } },
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
            var mod = mods[j];
            if (mod && mod !== 'N/A' && mod !== '') {
                var displayMod = mod.replace(/_/g, ' ');
                modTypes[displayMod] = mod;
            }
        }
    }
    
    var sortedMods = Object.keys(modTypes).sort();
    var html = '';
    for (var k = 0; k < sortedMods.length; k++) {
        var displayMod = sortedMods[k];
        html += '<div class="multiselect-option">' +
            '<input type="checkbox" value="' + modTypes[displayMod] + '" onchange="updateModSelectionAndFilter()">' +
            '<label>' + displayMod + '</label>' +
        '</div>';
    }
    
    dropdown.innerHTML = html;
}

function toggleModDropdown() {
    var dropdown = document.getElementById('modDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

function updateModSelectionAndFilter() {
    selectedMods = [];
    var selectedNames = [];
    
    var checkboxes = document.querySelectorAll('#modDropdown input[type="checkbox"]');
    for (var i = 0; i < checkboxes.length; i++) {
        if (checkboxes[i].checked) {
            selectedMods.push(checkboxes[i].value);
            selectedNames.push(checkboxes[i].value.replace(/_/g, ' '));
        }
    }
    
    var textSpan = document.getElementById('modSelectedText');
    if (textSpan) {
        if (selectedNames.length === 0) {
            textSpan.textContent = 'All';
        } else if (selectedNames.length === 1) {
            textSpan.textContent = selectedNames[0];
        } else {
            textSpan.textContent = selectedNames.length + ' selected';
        }
    }
    
    applyFilters();
}

function formatModification(mod) {
    if (!mod) return '';
    return mod.replace(/_/g, ' ');
}

function initSourceSelector() {
    var dropdown = document.getElementById('sourceDropdown');
    if (!dropdown) return;
    
    var sources = {};
    for (var i = 0; i < peptidesData.length; i++) {
        var source = peptidesData[i].source_organism;
        if (source && source !== 'N/A' && source !== '') {
            var parts = source.split(',').map(function(item) { 
                return item.trim(); 
            });
            for (var j = 0; j < parts.length; j++) {
                if (parts[j]) {
                    var displaySource = parts[j].charAt(0).toUpperCase() + parts[j].slice(1).toLowerCase();
                    sources[displaySource] = parts[j].toLowerCase();
                }
            }
        }
    }
    
    var sortedSources = Object.keys(sources).sort();
    var html = '';
    for (var k = 0; k < sortedSources.length; k++) {
        var displaySource = sortedSources[k];
        html += '<div class="multiselect-option">' +
            '<input type="checkbox" value="' + sources[displaySource] + '" onchange="updateSourceSelectionAndFilter()">' +
            '<label>' + displaySource + '</label>' +
        '</div>';
    }
    
    dropdown.innerHTML = html;
}

function toggleSourceDropdown() {
    var dropdown = document.getElementById('sourceDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

function updateSourceSelectionAndFilter() {
    selectedSources = [];
    var selectedNames = [];
    
    var checkboxes = document.querySelectorAll('#sourceDropdown input[type="checkbox"]');
    for (var i = 0; i < checkboxes.length; i++) {
        if (checkboxes[i].checked) {
            selectedSources.push(checkboxes[i].value);
            selectedNames.push(checkboxes[i].value.charAt(0).toUpperCase() + checkboxes[i].value.slice(1));
        }
    }
    
    var textSpan = document.getElementById('sourceSelectedText');
    if (textSpan) {
        if (selectedNames.length === 0) {
            textSpan.textContent = 'All';
        } else if (selectedNames.length === 1) {
            textSpan.textContent = selectedNames[0];
        } else {
            textSpan.textContent = selectedNames.length + ' selected';
        }
    }
    
    applyFilters();
}

function updateBrowseStats() {
    var el = document.getElementById('resultsCount');
    if (el) el.textContent = 'Found peptides: ' + filteredPeptides.length;
}

function applyFilters() {
    var searchTerm = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';
    var disulfideVal = document.getElementById('disulfideFilter') ? document.getElementById('disulfideFilter').value : 'all';
    var pdbVal = document.getElementById('pdbFilter') ? document.getElementById('pdbFilter').value : 'all';
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
        
        // Source filter - AND logic
        if (selectedSources.length > 0) {
            var peptideSources = (p.source_organism || '').toLowerCase().split(',').map(function(s) { 
                return s.trim(); 
            });
            var hasAll = true;
            for (var s = 0; s < selectedSources.length; s++) {
                if (peptideSources.indexOf(selectedSources[s]) === -1) {
                    hasAll = false;
                    break;
                }
            }
            if (!hasAll) continue;
        }
        
        // Disulfide filter
        if (disulfideVal === 'yes' && (!p.disulfide_bridge || p.disulfide_bridge.toLowerCase() === 'no' || p.disulfide_bridge === '')) continue;
        if (disulfideVal === 'no' && (p.disulfide_bridge && p.disulfide_bridge.toLowerCase() !== 'no')) continue;
        
        // PDB filter
        if (pdbVal === 'yes' && !p.has_pdb) continue;
        if (pdbVal === 'no' && p.has_pdb) continue;
        
        // Modifications filter - AND logic
        if (selectedMods.length > 0) {
            var peptideMods = p.modifications || [];
            var hasAllMods = true;
            for (var m = 0; m < selectedMods.length; m++) {
                if (peptideMods.indexOf(selectedMods[m]) === -1) {
                    hasAllMods = false;
                    break;
                }
            }
            if (!hasAllMods) continue;
        }
        
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
    var disulfideFilter = document.getElementById('disulfideFilter');
    var pdbFilter = document.getElementById('pdbFilter');
    
    if (searchInput) searchInput.value = '';
    if (lengthMin) lengthMin.value = 0;
    if (lengthMax) lengthMax.value = 100;
    if (disulfideFilter) disulfideFilter.value = 'all';
    if (pdbFilter) pdbFilter.value = 'all';
    
    // Reset sources
    var sourceCheckboxes = document.querySelectorAll('#sourceDropdown input[type="checkbox"]');
    for (var i = 0; i < sourceCheckboxes.length; i++) {
        sourceCheckboxes[i].checked = false;
    }
    selectedSources = [];
    var sourceText = document.getElementById('sourceSelectedText');
    if (sourceText) sourceText.textContent = 'All';
    
    // Reset mods
    var modCheckboxes = document.querySelectorAll('#modDropdown input[type="checkbox"]');
    for (var i = 0; i < modCheckboxes.length; i++) {
        modCheckboxes[i].checked = false;
    }
    selectedMods = [];
    var modText = document.getElementById('modSelectedText');
    if (modText) modText.textContent = 'All';
    
    filteredPeptides = [...peptidesData];
    updateBrowseStats();
    displayBrowseResults();
}

function downloadFASTA() {
    if (filteredPeptides.length === 0) {
        alert('No results to download');
        return;
    }
    
    var fasta = '';
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        var header = '>' + (p.peptide_name || 'peptide_' + p.id);
        fasta += header + '\n';
        
        var seq = p.sequence_clean || '';
        for (var j = 0; j < seq.length; j += 60) {
            fasta += seq.substring(j, j + 60) + '\n';
        }
    }
    
    var blob = new Blob([fasta], { type: 'text/plain' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'barrpeps_sequences.fasta';
    link.click();
    URL.revokeObjectURL(link.href);
}

function downloadFullCSV() {
    if (filteredPeptides.length === 0) {
        alert('No results to download');
        return;
    }
    
    var headers = [
        'ID', 'Name', 'Sequence_1letter', 'Sequence_3letter', 'Clean_Sequence',
        'Length', 'Molecular_Weight', 'Molecular_Formula', 'Structure_Type',
        'Disulfide_Bridges', 'Nature', 'Source_Organism', 'Modifications',
        'PDB_IDs', 'Has_PDB', 'Experimental_Data', 'References'
    ];
    
    var rows = [];
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        
        var expStrings = [];
        var exps = p.experiments || [];
        
        var expByMethod = {};
        for (var j = 0; j < exps.length; j++) {
            var exp = exps[j];
            var method = exp['method'] || '';
            if (!method) continue;
            
            if (!expByMethod[method]) {
                expByMethod[method] = [];
            }
            expByMethod[method].push(exp);
        }
        
        for (var method in expByMethod) {
            var methodExps = expByMethod[method];
            for (var k = 0; k < methodExps.length; k++) {
                var exp = methodExps[k];
                var parts = [];
                
                parts.push('Method: ' + method);
                if (exp['method_type']) parts.push('Type: ' + exp['method_type']);
                if (exp['response']) parts.push('Response: ' + exp['response']);
                
                var resultStr = '';
                if (exp['result'] !== undefined && exp['result'] !== null && exp['result'] !== '') {
                    resultStr = 'Result: ' + exp['result'];
                    if (exp['unit']) resultStr += ' ' + exp['unit'];
                    parts.push(resultStr);
                }
                
                if (exp['transport_type']) parts.push('Transport: ' + exp['transport_type']);
                if (exp['cell_line']) parts.push('Cell: ' + exp['cell_line']);
                if (exp['animal_model']) parts.push('Model: ' + exp['animal_model']);
                
                expStrings.push(parts.join('; '));
            }
        }
        
        var experimentalData = expStrings.join(' | ');
        
        var refs = p.references || [];
        var refStrings = [];
        for (var r = 0; r < refs.length; r++) {
            var ref = refs[r];
            var authors = ref['authors'] || '';
            var year = ref['year'] || '';
            var title = ref['title'] || '';
            var journal = ref['journal'] || '';
            
            if (authors && year) {
                var refStr = authors + ' (' + year + ')';
                if (title) refStr += ' ' + title;
                if (journal) refStr += ' ' + journal;
                refStrings.push(refStr);
            } else if (title) {
                refStrings.push(title);
            }
        }
        var references = refStrings.join(' | ');
        
        var row = [
            p.id,
            p.peptide_name || '',
            p.sequence_one_letter || '',
            p.sequence_three_letter || '',
            p.sequence_clean || '',
            p.length || '',
            p.molecular_weight || '',
            p.molecular_formula || '',
            p.structure_type || '',
            p.disulfide_bridge || '',
            p.nature || '',
            p.source_organism || '',
            (p.modifications || []).join('; '),
            (p.pdb_ids || []).join('; '),
            p.has_pdb ? 'Yes' : 'No',
            experimentalData,
            references
        ];
        
        rows.push(row);
    }
    
    var csv = headers.map(function(h) { 
        return '"' + String(h).replace(/"/g, '""') + '"'; 
    }).join(',') + '\n';
    
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var csvRow = [];
        for (var j = 0; j < row.length; j++) {
            var val = row[j];
            if (val === null || val === undefined) val = '';
            val = String(val).replace(/"/g, '""');
            csvRow.push('"' + val + '"');
        }
        csv += csvRow.join(',') + '\n';
    }
    
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'barrpeps_full_export.csv';
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
    var html = '<div class="table-wrapper" style="overflow-x: auto;">' +
        '<table class="data-table" style="width:100%; border-collapse: collapse; min-width: 1000px;">' +
            '<thead>' +
                '<tr style="background: #f7fafc; border-bottom: 2px solid #e2e8f0;">' +
                    '<th style="padding: 12px 8px; text-align: left; width: 12%; cursor: pointer;" onclick="sortBy(\'peptide_name\')">Name</th>' +
                    '<th style="padding: 12px 8px; text-align: left; width: 30%; cursor: pointer;" onclick="sortBy(\'sequence_one_letter\')">Sequence</th>' +
                    '<th style="padding: 12px 8px; text-align: left; width: 6%; cursor: pointer;" onclick="sortBy(\'length\')">Length</th>' +
                    '<th style="padding: 12px 8px; text-align: left; width: 10%; cursor: pointer;" onclick="sortBy(\'molecular_weight\')">MW (Da)</th>' +
                    '<th style="padding: 12px 8px; text-align: left; width: 12%; cursor: pointer;">Modifications</th>' +
                    '<th style="padding: 12px 8px; text-align: left; width: 10%; cursor: pointer;" onclick="sortBy(\'source_organism\')">Source</th>' +
                    '<th style="padding: 12px 8px; text-align: center; width: 5%; cursor: pointer;" onclick="sortBy(\'has_pdb\')">PDB</th>' +
                    '<th style="padding: 12px 8px; text-align: left; width: 6%;">Details</th>' +
                '</tr>' +
            '</thead>' +
            '<tbody>';
    
    for (var i = 0; i < filteredPeptides.length; i++) {
        var p = filteredPeptides[i];
        var seqShort = p.sequence_one_letter ? 
            (p.sequence_one_letter.length > 35 ? p.sequence_one_letter.substring(0,35) + '...' : p.sequence_one_letter) : 'N/A';
        var url = getPeptideUrl(p.id, p.peptide_name);
        var pdbBadge = p.has_pdb ? '<span style="background: #48bb78; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.65rem; font-weight: 600;">Yes</span>' : '<span style="color: #a0aec0;">No</span>';
        
        var modsDisplay = '';
        if (p.modifications && p.modifications.length > 0) {
            var modShort = p.modifications.slice(0, 3).map(function(m) { return formatModification(m); }).join(', ');
            if (p.modifications.length > 3) {
                modShort += ' +' + (p.modifications.length - 3);
            }
            modsDisplay = '<span style="font-size: 0.65rem; color: #d69e2e;" title="' + p.modifications.map(function(m) { return formatModification(m); }).join(', ') + '">' + modShort + '</span>';
        } else {
            modsDisplay = '<span style="color: #a0aec0; font-size: 0.65rem;">—</span>';
        }
        
        html += '<tr style="border-bottom: 1px solid #e2e8f0;">' +
            '<td style="padding: 10px 8px; word-break: break-word;"><a href="' + url + '" style="color:#2c5282; font-weight:bold; text-decoration:none;">' + (p.peptide_name || 'N/A') + '</a></td>' +
            '<td style="padding: 10px 8px; font-family: monospace; font-size: 0.7rem; word-break: break-all;">' + seqShort + '</td>' +
            '<td style="padding: 10px 8px;">' + (p.length || 'N/A') + '</td>' +
            '<td style="padding: 10px 8px;">' + (p.molecular_weight ? p.molecular_weight.toFixed(1) : 'N/A') + '</td>' +
            '<td style="padding: 10px 8px;">' + modsDisplay + '</td>' +
            '<td style="padding: 10px 8px;">' + (p.source_organism || 'N/A') + '</td>' +
            '<td style="padding: 10px 8px; text-align: center;">' + pdbBadge + '</td>' +
            '<td style="padding: 10px 8px;"><a href="' + url + '" class="btn-primary" style="display: inline-block; padding: 4px 10px; background: #4299e1; color: white; border-radius: 4px; text-decoration: none; font-size: 0.7rem;">View</a></td>' +
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
        var pdbBadge = p.has_pdb ? '<span style="background: #48bb78; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.6rem; margin-left: 0.5rem;">PDB</span>' : '';
        
        var modsDisplay = '';
        if (p.modifications && p.modifications.length > 0) {
            var modShort = p.modifications.slice(0, 2).map(function(m) { return formatModification(m); }).join(', ');
            if (p.modifications.length > 2) {
                modShort += ' +' + (p.modifications.length - 2);
            }
            modsDisplay = '<div class="card-row"><div class="card-label">Modifications:</div><div class="card-value" style="color: #d69e2e;" title="' + p.modifications.map(function(m) { return formatModification(m); }).join(', ') + '">' + modShort + '</div></div>';
        }
        
        html += '<div class="peptide-card" onclick="window.location.href=\'' + url + '\'" style="cursor:pointer;">' +
            '<div class="card-header"><h3>' + (p.peptide_name || 'Unnamed') + pdbBadge + '</h3></div>' +
            '<div class="card-content">' +
                '<div class="card-row"><div class="card-label">Source:</div><div class="card-value">' + (p.source_organism || 'N/A') + '</div></div>' +
                '<div class="card-row"><div class="card-label">Length:</div><div class="card-value">' + (p.length || 'N/A') + ' aa</div></div>' +
                '<div class="card-row"><div class="card-label">MW:</div><div class="card-value">' + (p.molecular_weight ? p.molecular_weight.toFixed(1) : 'N/A') + ' Da</div></div>' +
                modsDisplay +
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

// ========== REFERENCE FORMATTING FUNCTIONS ==========

function formatLiteratureLinks(literatureStr) {
    console.log('formatLiteratureLinks input:', literatureStr);
    console.log('formatLiteratureLinks input length:', literatureStr ? literatureStr.length : 0);
    console.log('formatLiteratureLinks input type:', typeof literatureStr);
    
    if (!literatureStr || literatureStr === '{}' || literatureStr === '[]' || literatureStr.trim() === '') {
        console.log('formatLiteratureLinks: empty or invalid input, returning empty');
        return '';
    }
    
    var html = '';
    var references = [];
    
    // Проверяем, является ли это JSON-строкой со словарем (старый формат)
    if (literatureStr.trim().startsWith('{') && literatureStr.trim().endsWith('}')) {
        try {
            var jsonStr = literatureStr.replace(/'/g, '"');
            var parsed = JSON.parse(jsonStr);
            
            for (var key in parsed) {
                if (parsed.hasOwnProperty(key) && typeof parsed[key] === 'object') {
                    var ref = parsed[key];
                    var refText = '';
                    
                    if (ref['Author(s)']) {
                        refText += ref['Author(s)'];
                    }
                    if (ref['Year']) {
                        refText += ' (' + ref['Year'] + ')';
                    }
                    if (ref['Title']) {
                        refText += ' ' + ref['Title'];
                    }
                    if (ref['Journal']) {
                        refText += ' ' + ref['Journal'];
                    }
                    
                    if (refText) {
                        references.push(refText);
                    }
                }
            }
        } catch(e) {
            console.log('Error parsing literature JSON, treating as plain text');
            references.push(literatureStr);
        }
    } else {
        // Новый формат - просто текст (одна или несколько ссылок)
        // Может быть одна длинная строка или несколько, разделенных точкой с запятой
        var text = literatureStr.trim();
        if (text) {
            references.push(text);
        }
    }
    
    // Форматируем ссылки
    for (var i = 0; i < references.length; i++) {
        var refText = references[i];
        
        // Делаем DOI кликабельным
        refText = makeDoiClickable(refText);
        // Делаем PMID кликабельным
        refText = makePmidClickable(refText);
        
        html += '<div class="detail-row" style="margin-bottom: 0.5rem;">' +
            '<span class="detail-value" style="font-size: 0.8rem;">' + refText + '</span>' +
        '</div>';
    }
    
    return html;
}

function makeDoiClickable(text) {
    if (!text) return '';
    
    var doiRegex = /(10\.\d{4,}\/[^\s,;.]+)/g;
    return text.replace(doiRegex, function(match) {
        return '<a href="https://doi.org/' + match + '" target="_blank" style="color: #4299e1; text-decoration: none;">' + match + '</a>';
    });
}

function makePmidClickable(text) {
    if (!text) return '';
    
    var pmidRegex = /PMID:?\s*(\d+)/gi;
    return text.replace(pmidRegex, function(match, pmid) {
        return '<a href="https://pubmed.ncbi.nlm.nih.gov/' + pmid + '" target="_blank" style="color: #4299e1; text-decoration: none;">' + match + '</a>';
    });
}

// ========== PEPTIDE DETAIL PAGE ==========
async function initPeptidePage() {
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
            detailContainer.innerHTML = '<div class="error-message"><p>Peptide not found</p><a href="browse.html" class="btn-primary">Browse Database</a></div>';
        }
        return;
    }
    
    document.title = peptide.peptide_name + ' - BarrPeps';
    
    var pdbContents = [];
    var pdbIds = [];
    
    if (peptide.pdb_ids && peptide.pdb_ids.length > 0) {
        for (var i = 0; i < peptide.pdb_ids.length; i++) {
            var pdbId = peptide.pdb_ids[i];
            var content = await fetchPDBStructure(pdbId);
            if (content) {
                pdbContents.push(content);
                pdbIds.push(pdbId);
            }
        }
        console.log('Loaded ' + pdbContents.length + ' PDB structures');
    }
    
    displayPeptideDetail(peptide, pdbContents, pdbIds);
}

function displayPeptideDetail(peptide, pdbContents, pdbIds) {
    var pdbContentsArray = Array.isArray(pdbContents) ? pdbContents : (pdbContents ? [pdbContents] : []);
    var pdbIdsArray = Array.isArray(pdbIds) ? pdbIds : (pdbIds ? [pdbIds] : []);
    
    var validStructures = [];
    for (var i = 0; i < pdbIdsArray.length; i++) {
        if (pdbContentsArray[i] && pdbIdsArray[i]) {
            validStructures.push({
                id: pdbIdsArray[i],
                content: pdbContentsArray[i]
            });
        }
    }
    
    var hasPDB = validStructures.length > 0;
    window.currentPeptideSequence = peptide.sequence_clean;
    console.log('Peptide notes (literature):', peptide.notes);
console.log('Peptide notes length:', peptide.notes ? peptide.notes.length : 0);
console.log('Peptide notes type:', typeof peptide.notes);
    
    var modsHtml = '';
    if (peptide.modifications && peptide.modifications.length > 0) {
        var modList = peptide.modifications.map(function(m) { return formatModification(m); }).join(', ');
        modsHtml = '<div class="detail-section"><h3>Modifications</h3>' +
            '<div class="detail-row"><span class="detail-value">' + modList + '</span></div></div>';
    } else {
        modsHtml = '<div class="detail-section"><h3>Modifications</h3>' +
            '<div class="detail-row"><span class="detail-value">None reported</span></div></div>';
    }
    
    var pdbHtml = '';
    if (peptide.pdb_ids && peptide.pdb_ids.length > 0) {
        var pdbLinks = [];
        for (var i = 0; i < peptide.pdb_ids.length; i++) {
            var id = peptide.pdb_ids[i];
            pdbLinks.push('<a href="https://www.rcsb.org/structure/' + id + '" target="_blank" style="color: #4299e1; text-decoration: none;">' + id + '</a>');
        }
        pdbHtml = '<div class="detail-section"><h3>PDB Structures</h3>' +
            '<div class="detail-row"><span class="detail-label">Available structures:</span><span class="detail-value">' + pdbLinks.join(', ') + '</span></div>';
    }
    
    if (peptide.related_pdb_ids && peptide.related_pdb_ids.length > 0) {
        var relatedOptions = '';
        for (var i = 0; i < peptide.related_pdb_ids.length; i++) {
            var id = peptide.related_pdb_ids[i];
            relatedOptions += '<option value="' + id + '">' + id + '</option>';
        }
        
        pdbHtml += '<div class="detail-row" style="margin-top: 0.75rem;">' +
            '<span class="detail-label">Related PDB:</span>' +
            '<span class="detail-value">' +
                '<select id="relatedPdbSelect" style="padding: 0.3rem 0.5rem; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 0.75rem; background: white; margin-right: 0.5rem;">' +
                    '<option value="">-- Select related structure --</option>' +
                    relatedOptions +
                '</select>' +
                '<button onclick="openRelatedPdb()" style="padding: 0.3rem 0.8rem; background: #4299e1; color: white; border: none; border-radius: 6px; font-size: 0.7rem; cursor: pointer;">Open</button>' +
            '</span>' +
        '</div>';
    }
    
    if (pdbHtml) {
        pdbHtml += '</div>';
    }
    
    var experimentsHtml = '';
    if (peptide.experiments && peptide.experiments.length > 0) {
        var uniqueExperiments = [];
        var seenKeys = {};
        
        for (var i = 0; i < peptide.experiments.length; i++) {
            var exp = peptide.experiments[i];
            var method = exp['method'] || '';
            var response = exp['response'] || '';
            var result = exp['result'] !== undefined && exp['result'] !== null ? exp['result'] : '';
            var unit = exp['unit'] || '';
            var key = method + '|' + response + '|' + result + '|' + unit;
            
            if (!seenKeys[key]) {
                seenKeys[key] = true;
                uniqueExperiments.push(exp);
            }
        }
        
        experimentsHtml = '<div class="detail-section"><h3>Experimental Data</h3>' +
            '<div class="table-wrapper" style="overflow-x: auto;">' +
            '<table style="width:100%; border-collapse: collapse; font-size: 0.75rem;">' +
            '<thead><tr style="background: #e2e8f0;">' +
            '<th style="padding: 8px; text-align: left;">Method</th>' +
            '<th style="padding: 8px; text-align: left;">Type</th>' +
            '<th style="padding: 8px; text-align: left;">Response</th>' +
            '<th style="padding: 8px; text-align: left;">Result</th>' +
            '<th style="padding: 8px; text-align: left;">Transport</th>' +
            '<th style="padding: 8px; text-align: left;">Model/Cell Line</th>' +
            '</tr></thead><tbody>';
        
        for (var i = 0; i < uniqueExperiments.length; i++) {
            var exp = uniqueExperiments[i];
            var resultVal = exp['result'] !== undefined && exp['result'] !== null ? exp['result'] : '';
            var unit = exp['unit'] || '';
            var resultDisplay = (resultVal !== '' && resultVal !== null) ? resultVal + (unit ? ' ' + unit : '') : 'N/A';
            var modelDisplay = exp['cell_line'] || exp['animal_model'] || 'N/A';
            var methodDisplay = exp['method'] || 'N/A';
            var typeDisplay = exp['method_type'] || 'N/A';
            var responseDisplay = exp['response'] || 'N/A';
            var transportDisplay = exp['transport_type'] || 'N/A';
            
            if (methodDisplay === 'N/A' && typeDisplay === 'N/A' && responseDisplay === 'N/A' && 
                resultDisplay === 'N/A' && transportDisplay === 'N/A' && modelDisplay === 'N/A') {
                continue;
            }
            
            experimentsHtml += '<tr style="border-bottom: 1px solid #e2e8f0;">' +
                '<td style="padding: 8px;">' + methodDisplay + '</td>' +
                '<td style="padding: 8px;">' + typeDisplay + '</td>' +
                '<td style="padding: 8px;">' + responseDisplay + '</td>' +
                '<td style="padding: 8px;">' + resultDisplay + '</td>' +
                '<td style="padding: 8px;">' + transportDisplay + '</td>' +
                '<td style="padding: 8px;">' + modelDisplay + '</td>' +
            '</tr>';
        }
        
        experimentsHtml += '</tbody></table></div></div>';
        
        if (experimentsHtml.indexOf('<tr') === -1) {
            experimentsHtml = '<div class="detail-section"><h3>Experimental Data</h3>' +
                '<div class="detail-row"><span class="detail-value">No experimental data available</span></div></div>';
        }
    } else {
        experimentsHtml = '<div class="detail-section"><h3>Experimental Data</h3>' +
            '<div class="detail-row"><span class="detail-value">No experimental data available</span></div></div>';
    }
    
    // References section - показываем ТОЛЬКО из literature (peptide.notes)
var referencesHtml = '';

// Получаем ссылки из колонки literature
var literatureHtml = formatLiteratureLinks(peptide.notes || '');

// Если есть ссылки в literature, показываем только их
if (literatureHtml) {
    referencesHtml = '<div class="detail-section"><h3>References</h3>' + literatureHtml + '</div>';
} else {
    // Если в literature пусто, тогда пробуем references из листа
    if (peptide.references && peptide.references.length > 0) {
        var shownRefs = {};
        var refsHtml = '';
        
        for (var i = 0; i < peptide.references.length; i++) {
            var ref = peptide.references[i];
            var authors = ref['authors'] || '';
            var year = ref['year'] || '';
            var title = ref['title'] || '';
            var journal = ref['journal'] || '';
            
            var refText = '';
            if (authors && year && title && journal) {
                refText = authors + ' (' + year + '). ' + title + '. ' + journal + '.';
            } else if (authors && year) {
                refText = authors + ' (' + year + ').';
            } else if (title) {
                refText = title;
            }
            
            if (refText && !shownRefs[refText]) {
                shownRefs[refText] = true;
                refText = makeDoiClickable(refText);
                refText = makePmidClickable(refText);
                
                refsHtml += '<div class="detail-row" style="margin-bottom: 0.5rem;">' +
                    '<span class="detail-value" style="font-size: 0.8rem;">' + refText + '</span></div>';
            }
        }
        
        if (refsHtml) {
            referencesHtml = '<div class="detail-section"><h3>References</h3>' + refsHtml + '</div>';
        } else {
            referencesHtml = '<div class="detail-section"><h3>References</h3>' +
                '<div class="detail-row"><span class="detail-value">No references available</span></div></div>';
        }
    } else {
        referencesHtml = '<div class="detail-section"><h3>References</h3>' +
            '<div class="detail-row"><span class="detail-value">No references available</span></div></div>';
    }
}
    
    var html = '<div class="peptide-detail-container">' +
        '<div style="margin-bottom:1rem;">' +
            '<a href="browse.html" class="btn-secondary back-button">← Back to Browse</a>' +
            '<h1 style="color:#2c5282; margin-top:0.5rem;">' + (peptide.peptide_name || 'N/A') + '</h1>' +
            '<p style="color:#718096;">ID: ' + peptide.id + '</p>' +
        '</div>';
    
    if (hasPDB) {
        var pdbSelectorHtml = '';
        if (validStructures.length > 1) {
            pdbSelectorHtml = '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">' +
                '<h3 style="font-size: 0.9rem; margin: 0;">3D Structure Visualization</h3>' +
                '<select id="pdbSelector" style="padding: 0.3rem 0.5rem; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 0.75rem; background: white; cursor: pointer;" onchange="switchPDB(this.value)">';
            
            for (var i = 0; i < validStructures.length; i++) {
                var selected = i === 0 ? ' selected' : '';
                pdbSelectorHtml += '<option value="' + i + '"' + selected + '>' + validStructures[i].id + '</option>';
            }
            pdbSelectorHtml += '</select></div>';
        } else {
            pdbSelectorHtml = '<h3 style="font-size: 0.9rem; margin-bottom: 0.6rem;">3D Structure Visualization - PDB: ' + validStructures[0].id + '</h3>';
        }
        
        html += '<div class="structure-viewer">' +
            pdbSelectorHtml +
            '<div id="structure-viewer-pdb" class="structure-container"></div>' +
            '<div class="structure-controls">' +
                '<button id="btn-cartoon" class="active" onclick="setRepresentation(\'cartoon\')">Cartoon</button>' +
                '<button id="btn-ballstick" onclick="setRepresentation(\'ballAndStick\')">Ball & Stick</button>' +
            '</div>' +
            '<div class="structure-legend">' +
                '<div class="legend-item"><div class="legend-color carbon"></div><span>Carbon</span></div>' +
                '<div class="legend-item"><div class="legend-color oxygen"></div><span>Oxygen</span></div>' +
                '<div class="legend-item"><div class="legend-color nitrogen"></div><span>Nitrogen</span></div>' +
                '<div class="legend-item"><div class="legend-color sulfur"></div><span>Sulfur</span></div>' +
                '<div class="legend-item"><div class="legend-color disulfide"></div><span>Disulfide</span></div>' +
            '</div>' +
            '<div class="pdb-info">' +
                '<strong>Current PDB: <span id="currentPdbId">' + validStructures[0].id + '</span></strong> | ' +
                '<a href="https://www.rcsb.org/structure/' + validStructures[0].id + '" target="_blank" id="rcsbLink">View on RCSB.org</a>' +
            '</div>' +
        '</div>';
        
        window.pdbStructures = validStructures;
        window.currentPdbIndex = 0;
    } else {
        html += '<div class="structure-viewer">' +
            '<h3 style="font-size: 0.9rem; margin-bottom: 0.6rem;">3D Structure Visualization</h3>' +
            '<div class="no-structure"><p>No PDB structure available for this peptide.</p></div>' +
        '</div>';
    }
    
    html += '<div class="detail-section"><h3>Basic Information</h3>' +
            '<div class="detail-row"><span class="detail-label">Sequence (with modifications):</span><span class="detail-value" style="font-family:monospace;word-break:break-all;">' + (peptide.sequence_one_letter || 'N/A') + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Clean sequence:</span><span class="detail-value" style="font-family:monospace;">' + (peptide.sequence_clean || 'N/A') + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">3-letter sequence:</span><span class="detail-value" style="word-break:break-all;">' + (peptide.sequence_three_letter || 'N/A') + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Length:</span><span class="detail-value">' + (peptide.length || 'N/A') + ' aa</span></div>' +
            '<div class="detail-row"><span class="detail-label">Molecular Weight:</span><span class="detail-value">' + (peptide.molecular_weight ? peptide.molecular_weight.toFixed(2) : 'N/A') + ' Da</span></div>' +
            (peptide.molecular_formula ? '<div class="detail-row"><span class="detail-label">Formula:</span><span class="detail-value">' + peptide.molecular_formula + '</span></div>' : '') +
        '</div>' +
        
        (peptide.structure_type && peptide.structure_type !== 'N/A' ? 
            '<div class="detail-section"><h3>Structural Properties</h3>' +
                '<div class="detail-row"><span class="detail-label">Structure:</span><span class="detail-value">' + peptide.structure_type + '</span></div>' +
                (peptide.disulfide_bridge ? '<div class="detail-row"><span class="detail-label">Disulfide bridges:</span><span class="detail-value">' + peptide.disulfide_bridge + '</span></div>' : '') +
            '</div>' : '') +
        
        (peptide.source_organism && peptide.source_organism !== 'N/A' ? 
            '<div class="detail-section"><h3>Source</h3>' +
                '<div class="detail-row"><span class="detail-label">Organism:</span><span class="detail-value">' + peptide.source_organism + '</span></div>' +
            '</div>' : '') +
        
        pdbHtml +
        modsHtml +
        experimentsHtml +
        referencesHtml +
    '</div>';
    
    var detailContainer = document.getElementById('peptideDetail');
    if (detailContainer) {
        detailContainer.innerHTML = html;
    }
    
    if (hasPDB && validStructures.length > 0) {
        setTimeout(function() {
            renderPDBStructure(validStructures[0].content, validStructures[0].id, peptide.sequence_clean);
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
window.formatModification = formatModification;
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
