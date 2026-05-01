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

let pdbViewer = null;
let pdbContentCache = null;

let lengthChart = null;
let aaChart = null;

var selectedMods = [];
var selectedSources = [];

var lastMouseX = 0;
var lastMouseY = 0;
document.addEventListener('mousemove', function(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

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
        setTimeout(function() {
            if (selectedSources.length > 0) {
                document.querySelectorAll('#sourceDropdown input[type="checkbox"]').forEach(function(cb) { cb.checked = selectedSources.indexOf(cb.value) !== -1; });
                var st = document.getElementById('sourceSelectedText'); if (st) st.textContent = selectedSources.length + ' selected';
            }
            if (selectedMods.length > 0) {
                document.querySelectorAll('#modDropdown input[type="checkbox"]').forEach(function(cb) { cb.checked = selectedMods.indexOf(cb.value) !== -1; });
                var mt = document.getElementById('modSelectedText'); if (mt) mt.textContent = selectedMods.length + ' selected';
            }
        }, 200);
        return true;
    } catch(e) { return false; }
}

// ========== EXCEL LOADER ==========
function loadExcelFile() {
    fetch('database.xlsx')
        .then(function(response) { if (!response.ok) throw new Error('HTTP error'); return response.arrayBuffer(); })
        .then(function(arrayBuffer) {
            var workbook = XLSX.read(arrayBuffer, { type: 'array' });
            var peptidesSheet = workbook.Sheets['peptides'];
            if (peptidesSheet) {
                peptidesData = XLSX.utils.sheet_to_json(peptidesSheet);
                var range = XLSX.utils.decode_range(peptidesSheet['!ref']);
                var literatureCol = -1;
                for (var col = range.s.c; col <= range.e.c; col++) {
                    var ca = XLSX.utils.encode_cell({r:0,c:col});
                    var cell = peptidesSheet[ca];
                    if (cell && cell.v && String(cell.v).toLowerCase() === 'literature') { literatureCol = col; break; }
                }
                if (literatureCol >= 0) {
                    for (var row = 1; row <= range.e.r; row++) {
                        var ca2 = XLSX.utils.encode_cell({r:row,c:literatureCol});
                        var cell2 = peptidesSheet[ca2];
                        if (cell2 && peptidesData[row-1]) peptidesData[row-1].literature = cell2.w || cell2.v || '';
                    }
                }
            }
            var sheetNames = workbook.SheetNames;
            for (var s = 0; s < sheetNames.length; s++) {
                var sn = sheetNames[s];
                if (sn.toLowerCase() === 'peptides') continue;
                var ws = workbook.Sheets[sn];
                var jd = XLSX.utils.sheet_to_json(ws);
                var ln = sn.toLowerCase();
                if (ln === 'experiments') experimentsData = jd;
                else if (ln === 'references') referencesData = jd;
                else if (ln === 'modifications') modificationsData = jd;
                else if (ln === 'pdb') pdbData = jd;
            }
            if (peptidesData.length === 0) useFallbackData(); else processAllData();
        })
        .catch(function(e) { console.error(e); useFallbackData(); });
}

function useFallbackData() { peptidesData = []; processAllData(); }

function parseDisulfideBonds(str) {
    if (!str || str.toLowerCase() === 'no' || str === '') return [];
    var bonds = [];
    var parts = str.split(/[;,\n]+/);
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim();
        if (!p) continue;
        var m = p.match(/Cys\s*(\d+[A-Za-z]?)\s*-\s*Cys\s*(\d+[A-Za-z]?)/i);
        if (m) { bonds.push({cys1:m[1],cys2:m[2],raw:p}); continue; }
        m = p.match(/Cys\s*\(\s*(\d+[A-Za-z]?)\s*\)\s*-\s*Cys\s*\(\s*(\d+[A-Za-z]?)\s*\)/i);
        if (m) bonds.push({cys1:m[1],cys2:m[2],raw:p});
    }
    return bonds;
}

function processAllData() {
    var expMap = {}, refMap = {}, modMap = {}, pdbMap = {};
    for (var i = 0; i < experimentsData.length; i++) { var e = experimentsData[i]; var pid = e['peptide_id']; if (pid) { if (!expMap[pid]) expMap[pid] = []; expMap[pid].push(e); } }
    for (var i = 0; i < referencesData.length; i++) { var r = referencesData[i]; var pid = r['peptide_id']; if (pid) { if (!refMap[pid]) refMap[pid] = []; refMap[pid].push(r); } }
    for (var i = 0; i < modificationsData.length; i++) { var m = modificationsData[i]; var pid = m['peptide_id']; if (pid) { if (!modMap[pid]) modMap[pid] = []; modMap[pid].push(m); } }
    for (var i = 0; i < pdbData.length; i++) { var p = pdbData[i]; var pid = p['peptide_id']; if (pid) { if (!pdbMap[pid]) pdbMap[pid] = []; pdbMap[pid].push(p); } }
    var enhanced = [];
    for (var i = 0; i < peptidesData.length; i++) {
        var pp = peptidesData[i];
        var pid = pp['peptide_id'] || i+1;
        var rawSeq = pp['sequence_1'] || '';
        var threeSeq = pp['sequence_3'] || '';
        var cleanSeq = '';
        var mods = modMap[pid] || [];
        if (mods.length > 0) cleanSeq = mods[0]['sequence_1_clean'] || '';
        if (!cleanSeq && rawSeq) cleanSeq = rawSeq.replace(/\([^)]+\)/g, '').replace(/[^A-Za-z]/g, '');
        var allMods = [];
        for (var m = 0; m < mods.length; m++) {
            var mv = mods[m]['modifications'];
            if (mv && mv !== 'N/A' && mv !== '') {
                var parts = mv.split(',').map(function(x){return x.trim();});
                for (var k = 0; k < parts.length; k++) { if (parts[k] && allMods.indexOf(parts[k]) === -1) allMods.push(parts[k]); }
            }
        }
        var pdbInfo = pdbMap[pid] || [];
        var pdbIds = [], relIds = [];
        for (var j = 0; j < pdbInfo.length; j++) {
            var pi = pdbInfo[j];
            if (pi['PDB_ID'] && pi['PDB_ID'] !== 'Nah' && pi['PDB_ID'] !== '' && pi['PDB_ID'] !== 'N/A') {
                var ids = pi['PDB_ID'].split(',').map(function(x){return x.trim();});
                for (var k = 0; k < ids.length; k++) { if (ids[k] && ids[k] !== 'Nah' && ids[k] !== 'N/A') pdbIds.push(ids[k]); }
            }
            if (pi['Related_PDB'] && pi['Related_PDB'] !== 'Nah' && pi['Related_PDB'] !== '') {
                var rids = pi['Related_PDB'].split(',').map(function(x){return x.trim();});
                for (var k = 0; k < rids.length; k++) { if (rids[k] && rids[k] !== 'Nah' && rids[k] !== 'N/A') relIds.push(rids[k]); }
            }
        }
        var updb = []; for (var j = 0; j < pdbIds.length; j++) { if (updb.indexOf(pdbIds[j]) === -1) updb.push(pdbIds[j]); }
        var urel = []; for (var j = 0; j < relIds.length; j++) { if (urel.indexOf(relIds[j]) === -1) urel.push(relIds[j]); }
        enhanced.push({
            id: pid, peptide_name: pp['trivial_name'] || 'Peptide_'+pid,
            sequence_one_letter: rawSeq, sequence_clean: cleanSeq, sequence_three_letter: threeSeq,
            length: parseInt(pp['length']) || cleanSeq.length, molecular_weight: parseFloat(pp['molecular_weight']) || 0,
            molecular_formula: pp['molecular_formula'] || '', structure_type: pp['conformation'] || 'N/A',
            disulfide_bridge: pp['disulfide_bridge'] || '', disulfide_bonds: parseDisulfideBonds(pp['disulfide_bridge'] || ''),
            nature: pp['nature'] || '', source_organism: pp['origin'] || 'N/A',
            experiments: expMap[pid] || [], references: refMap[pid] || [], modifications: allMods,
            pdb_ids: updb, related_pdb_ids: urel, has_pdb: updb.length > 0, notes: pp['literature'] || ''
        });
    }
    peptidesData = enhanced;
    filteredPeptides = [...peptidesData];
    var cp = window.location.pathname.split('/').pop();
    if (cp === 'index.html' || cp === '') initHomePage();
    else if (cp === 'browse.html') initBrowsePage();
    else if (cp === 'peptide.html') initPeptidePage();
}

// ========== PDB FUNCTIONS ==========
async function fetchPDBStructure(id) { if (!id || id === 'N/A') return null; try { var r = await fetch('https://files.rcsb.org/download/'+id+'.pdb'); return r.ok ? await r.text() : null; } catch(e) { return null; } }

function convertThreeToOne(t) { var m={'ALA':'A','ARG':'R','ASN':'N','ASP':'D','CYS':'C','GLN':'Q','GLU':'E','GLY':'G','HIS':'H','ILE':'I','LEU':'L','LYS':'K','MET':'M','PHE':'F','PRO':'P','SER':'S','THR':'T','TRP':'W','TYR':'Y','VAL':'V'}; return m[t.toUpperCase()]||''; }

function getRainbowColor(idx, total) { if (total <= 1) return 0x00cc88; var r = idx/(total-1); var rr,gg,bb; if(r<0.25){var t=r/0.25; rr=0; gg=Math.floor(100+155*t); bb=255;} else if(r<0.5){var t=(r-0.25)/0.25; rr=0; gg=255; bb=Math.floor(255*(1-t));} else if(r<0.75){var t=(r-0.5)/0.25; rr=Math.floor(255*t); gg=255; bb=0;} else{var t=(r-0.75)/0.25; rr=255; gg=Math.floor(255*(1-t)); bb=0;} return (rr<<16)|(gg<<8)|bb; }

function getFullResidueName(t) { var n={'ALA':'Alanine','ARG':'Arginine','ASN':'Asparagine','ASP':'Aspartic acid','CYS':'Cysteine','GLN':'Glutamine','GLU':'Glutamic acid','GLY':'Glycine','HIS':'Histidine','ILE':'Isoleucine','LEU':'Leucine','LYS':'Lysine','MET':'Methionine','PHE':'Phenylalanine','PRO':'Proline','SER':'Serine','THR':'Threonine','TRP':'Tryptophan','TYR':'Tyrosine','VAL':'Valine'}; return n[t.toUpperCase()]||t; }

function parseSSBOND(content) { var bonds = []; var lines = content.split('\n'); for (var i = 0; i < lines.length; i++) { var l = lines[i]; if (l.startsWith('SSBOND')) { var c1 = l.substring(15,16).trim()||' ', r1 = parseInt(l.substring(17,21)), c2 = l.substring(29,30).trim()||' ', r2 = parseInt(l.substring(31,35)); bonds.push({chain1:c1,res1:r1,chain2:c2,res2:r2}); } } return bonds; }

function findPeptideChain(content, seq) {
    if (!seq) return null;
    var lines = content.split('\n'), chains = {}, cur = null, cseq = '';
    for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        if (l.startsWith('ATOM') && l.substring(13,16).trim() === 'CA') {
            var ch = l.substring(21,22).trim()||' ', rn = l.substring(17,20).trim(), rs = parseInt(l.substring(22,26));
            if (cur !== ch) { if (cur && cseq) { if (!chains[cur]) chains[cur]={seq:'',residues:[]}; chains[cur].seq=cseq; } cur=ch; cseq=''; if (!chains[ch]) chains[ch]={seq:'',residues:[]}; }
            var aa = convertThreeToOne(rn);
            if (aa) { cseq += aa; chains[ch].residues.push({resSeq:rs,aa:aa}); }
        }
    }
    if (cur && cseq) { if (!chains[cur]) chains[cur]={seq:'',residues:[]}; chains[cur].seq=cseq; }
    var tgt = seq.toUpperCase();
    for (var ch in chains) { var idx = chains[ch].seq.indexOf(tgt); if (idx !== -1) { var res = chains[ch].residues.slice(idx,idx+tgt.length); return {chain:ch,residues:res,startRes:res[0].resSeq,endRes:res[res.length-1].resSeq}; } }
    return null;
}

function renderPDBStructure(content, pdbId, peptideSeq, dbBonds) {
    var container = document.getElementById('structure-viewer-pdb');
    if (!container || !content) return;
    
    var peptideInfo = findPeptideChain(content, peptideSeq);
    if (peptideInfo && peptideSeq && peptideInfo.residues.length > peptideSeq.length * 1.5) peptideInfo = null;
    
    var ssbonds = parseSSBOND(content);
    var sgAtoms = {};
    var lines = content.split('\n');
    for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        if (l.startsWith('ATOM') || l.startsWith('HETATM')) {
            var an = l.substring(12,16).trim(), rn = l.substring(17,20).trim(), ch = l.substring(21,22).trim()||' ', rs = parseInt(l.substring(22,26));
            if (rn === 'CYS' && (an === 'SG' || an === 'S')) { var x=parseFloat(l.substring(30,38)),y=parseFloat(l.substring(38,46)),z=parseFloat(l.substring(46,54)); sgAtoms[ch+'_'+rs]={chain:ch,resSeq:rs,x:x,y:y,z:z}; }
        }
    }
    
    var bonds = [], used = {};
    if (peptideInfo && ssbonds.length > 0) {
        var off = peptideInfo.startRes - 1;
        for (var i = 0; i < ssbonds.length; i++) {
            var b = ssbonds[i];
            if (b.chain1 === peptideInfo.chain && b.chain2 === peptideInfo.chain && b.res1 >= peptideInfo.startRes && b.res1 <= peptideInfo.endRes && b.res2 >= peptideInfo.startRes && b.res2 <= peptideInfo.endRes) {
                var pk = Math.min(b.res1,b.res2)+'_'+Math.max(b.res1,b.res2);
                var rr1 = b.res1-off, rr2 = b.res2-off;
                var inDB = false;
                if (dbBonds && dbBonds.length > 0) {
                    for (var d = 0; d < dbBonds.length; d++) { var d1=parseInt(dbBonds[d].cys1)||0, d2=parseInt(dbBonds[d].cys2)||0; if ((rr1===d1&&rr2===d2)||(rr1===d2&&rr2===d1)) { inDB=true; break; } }
                }
                if (!inDB) continue;
                if (!used[pk]) { used[pk]=true; var k1=b.chain1+'_'+b.res1, k2=b.chain2+'_'+b.res2; if (sgAtoms[k1]&&sgAtoms[k2]) bonds.push({atom1:sgAtoms[k1],atom2:sgAtoms[k2]}); }
            }
        }
    }
    
    container.innerHTML = '';
    container.style.width = container.clientWidth + 'px';
container.style.height = container.clientHeight + 'px';

var rect = container.getBoundingClientRect();
if (rect.height < 100) {
    container.style.height = '750px';
    rect = container.getBoundingClientRect();
}

pdbViewer = $3Dmol.createViewer(container, { 
    backgroundColor: 'white',
    width: rect.width || 800,
    height: rect.height || 750
});
pdbViewer.addModel(content, 'pdb');

    
    var peptideColors = [];
    if (peptideInfo && peptideInfo.residues.length > 0) {
        pdbViewer.setStyle({}, { cartoon: { color: 0x445566, opacity: 0.45 } });
        for (var i = 0; i < peptideInfo.residues.length; i++) {
            var clr = getRainbowColor(i, peptideInfo.residues.length);
            peptideColors.push({chain:peptideInfo.chain, resi:peptideInfo.residues[i].resSeq, color:clr});
            pdbViewer.addStyle({ chain:peptideInfo.chain, resi:peptideInfo.residues[i].resSeq }, { cartoon: { color:clr, opacity:0.95 } });
        }
    } else {
        pdbViewer.setStyle({}, { cartoon: { colorscheme:'ss', opacity:0.85 } });
    }
    
    for (var i = 0; i < bonds.length; i++) {
        pdbViewer.addSphere({ center:{x:bonds[i].atom1.x,y:bonds[i].atom1.y,z:bonds[i].atom1.z}, radius:0.4, color:0xffcc00 });
        pdbViewer.addSphere({ center:{x:bonds[i].atom2.x,y:bonds[i].atom2.y,z:bonds[i].atom2.z}, radius:0.4, color:0xffcc00 });
    }
    
    pdbViewer.zoomTo();
    
    setTimeout(function() {
        for (var i = 0; i < bonds.length; i++) {
            pdbViewer.addArrow({ start:{x:bonds[i].atom1.x,y:bonds[i].atom1.y,z:bonds[i].atom1.z}, end:{x:bonds[i].atom2.x,y:bonds[i].atom2.y,z:bonds[i].atom2.z}, radius:0.12, radiusRatio:1.0, color:0xff8800, alpha:0.9 });
        }
        pdbViewer.render();
    }, 100);
    
    // Hover popup
    var oldHover = document.getElementById('atomHoverPopup'); if (oldHover) oldHover.remove();
    var hoverPopup = document.createElement('div');
    hoverPopup.id = 'atomHoverPopup';
    hoverPopup.style.cssText = 'position:fixed; display:none; background:#1a202c; color:white; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:500; z-index:99999; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,0.4); border-left:3px solid #ffcc00;';
    document.body.appendChild(hoverPopup);
    
    var lastKey = null;
    function restoreColor(key) {
        if (!key) return;
        var parts = key.split('_'), chain = parts[0], resi = parseInt(parts[1]);
        for (var i = 0; i < peptideColors.length; i++) {
            if (peptideColors[i].chain === chain && peptideColors[i].resi === resi) {
                pdbViewer.addStyle({chain:chain,resi:resi},{cartoon:{color:peptideColors[i].color,opacity:0.95}});
                return;
            }
        }
        pdbViewer.addStyle({chain:chain,resi:resi},{cartoon:{color:0x445566,opacity:0.45}});
    }
    
    pdbViewer.setHoverable({}, true,
        function(atom) {
            if (atom) {
                hoverPopup.textContent = getFullResidueName(atom.resn) + ' (' + atom.resn + ' ' + atom.resi + ') - Chain ' + atom.chain;
                hoverPopup.style.display = 'block';
                hoverPopup.style.left = (lastMouseX + 18) + 'px';
                hoverPopup.style.top = (lastMouseY + 18) + 'px';
                var ck = atom.chain + '_' + atom.resi;
                if (lastKey !== ck) {
                    if (lastKey) restoreColor(lastKey);
                    pdbViewer.addStyle({chain:atom.chain,resi:atom.resi},{cartoon:{color:0xff4488,opacity:1.0}});
                    lastKey = ck;
                    pdbViewer.render();
                }
            } else {
                hoverPopup.style.display = 'none';
                if (lastKey) { restoreColor(lastKey); lastKey = null; pdbViewer.render(); }
            }
        },
        function() { hoverPopup.style.display = 'none'; if (lastKey) { restoreColor(lastKey); lastKey = null; pdbViewer.render(); } }
    );
    
    window.pdbContentCache = content;
    window.currentPdbInfo = { peptideInfo: peptideInfo, peptideBonds: bonds };
    
    // Кнопки
    setTimeout(function() {
        var parentDiv = container.parentNode;
        var ec = parentDiv.querySelector('.structure-controls'); if (ec) ec.remove();
        var cc = document.createElement('div');
        cc.className = 'structure-controls';
        cc.innerHTML = '<button id="btn-cartoon" class="active" onclick="window.setRepresentation(\'cartoon\')">Cartoon</button><button id="btn-ballstick" onclick="window.setRepresentation(\'ballAndStick\')">Ball & Stick</button>';
        parentDiv.appendChild(cc);
    }, 50);
}

function setRepresentation(type) {
    if (!pdbViewer || !window.pdbContentCache) return;
    pdbViewer.removeAllModels();
    pdbViewer.addModel(window.pdbContentCache, 'pdb');
    var info = window.currentPdbInfo || {}, pi = info.peptideInfo, bonds = info.peptideBonds || [];
    if (type === 'cartoon') {
        if (pi && pi.residues.length > 0) {
            pdbViewer.setStyle({},{cartoon:{color:0x445566,opacity:0.45}});
            for (var i = 0; i < pi.residues.length; i++) { pdbViewer.addStyle({chain:pi.chain,resi:pi.residues[i].resSeq},{cartoon:{color:getRainbowColor(i,pi.residues.length),opacity:0.95}}); }
        } else { pdbViewer.setStyle({},{cartoon:{colorscheme:'ss',opacity:0.85}}); }
        for (var i = 0; i < bonds.length; i++) { pdbViewer.addSphere({center:{x:bonds[i].atom1.x,y:bonds[i].atom1.y,z:bonds[i].atom1.z},radius:0.4,color:0xffcc00}); pdbViewer.addSphere({center:{x:bonds[i].atom2.x,y:bonds[i].atom2.y,z:bonds[i].atom2.z},radius:0.4,color:0xffcc00}); }
    } else {
        if (pi && pi.residues.length > 0) {
            pdbViewer.setStyle({},{stick:{color:0x445566,radius:0.06},sphere:{color:0x445566,scale:0.12}});
            for (var i = 0; i < pi.residues.length; i++) { pdbViewer.addStyle({chain:pi.chain,resi:pi.residues[i].resSeq},{stick:{color:getRainbowColor(i,pi.residues.length),radius:0.12},sphere:{color:getRainbowColor(i,pi.residues.length),scale:0.25}}); }
        } else { pdbViewer.setStyle({},{stick:{colorscheme:'elem',radius:0.12},sphere:{colorscheme:'elem',scale:0.25}}); }
        for (var i = 0; i < bonds.length; i++) { pdbViewer.addSphere({center:{x:bonds[i].atom1.x,y:bonds[i].atom1.y,z:bonds[i].atom1.z},radius:0.5,color:0xffcc00}); pdbViewer.addSphere({center:{x:bonds[i].atom2.x,y:bonds[i].atom2.y,z:bonds[i].atom2.z},radius:0.5,color:0xffcc00}); }
    }
    pdbViewer.zoomTo();
    setTimeout(function() { for (var i = 0; i < bonds.length; i++) { pdbViewer.addArrow({start:{x:bonds[i].atom1.x,y:bonds[i].atom1.y,z:bonds[i].atom1.z},end:{x:bonds[i].atom2.x,y:bonds[i].atom2.y,z:bonds[i].atom2.z},radius:0.15,radiusRatio:1.0,color:0xff8800,alpha:0.9}); } pdbViewer.render(); }, 100);
    var cb = document.getElementById('btn-cartoon'), bb = document.getElementById('btn-ballstick');
    if (cb) { cb.classList.remove('active'); if (type==='cartoon') cb.classList.add('active'); }
    if (bb) { bb.classList.remove('active'); if (type==='ballAndStick') bb.classList.add('active'); }
}

function switchPDB(index) {
    index = parseInt(index);
    if (!window.pdbStructures || !window.pdbStructures[index]) return;
    var s = window.pdbStructures[index];
    var sid = document.getElementById('currentPdbId'), sl = document.getElementById('rcsbLink');
    if (sid) sid.textContent = s.id;
    if (sl) sl.href = 'https://www.rcsb.org/structure/' + s.id;
    renderPDBStructure(s.content, s.id, window.currentPeptideSequence, window.currentDisulfideBonds);
}

function openRelatedPdb() { var s = document.getElementById('relatedPdbSelect'); if (s && s.value) window.open('https://www.rcsb.org/structure/'+s.value, '_blank'); }

// ========== CHARTS ==========
function calculateLengthDistribution() {
    var lengths = peptidesData.map(function(p){return p.length;}).filter(function(l){return l>0;});
    if (!lengths.length) return {};
    var maxL = Math.max.apply(null,lengths), bins = {};
    for (var i = 1; i <= Math.ceil(maxL/5)*5; i+=5) bins[i+'-'+(i+4)] = 0;
    lengths.forEach(function(l){var bi=Math.floor((l-1)/5),bs=bi*5+1; var lb=bs+'-'+(bs+4); if(bins[lb]!==undefined) bins[lb]++;});
    var f={}; for(var k in bins) if(bins[k]>0) f[k]=bins[k];
    return f;
}
function calculateAADistribution() {
    var cnt={'A':0,'R':0,'N':0,'D':0,'C':0,'Q':0,'E':0,'G':0,'H':0,'I':0,'L':0,'K':0,'M':0,'F':0,'P':0,'S':0,'T':0,'W':0,'Y':0,'V':0}, total=0;
    peptidesData.forEach(function(p){(p.sequence_clean||'').split('').forEach(function(a){if(cnt[a]!==undefined){cnt[a]++;total++;}});});
    var r={}; for(var a in cnt) r[a]=total>0?(cnt[a]/total*100).toFixed(1):0;
    return r;
}
function createLengthChart() { var ctx=document.getElementById('lengthChart'); if(!ctx||typeof Chart==='undefined') return; var d=calculateLengthDistribution(); if(lengthChart) lengthChart.destroy(); lengthChart=new Chart(ctx,{type:'bar',data:{labels:Object.keys(d),datasets:[{label:'Peptides',data:Object.values(d),backgroundColor:'rgba(66,153,225,0.7)'}]},options:{responsive:true,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}}); }
function createAAChart() { var ctx=document.getElementById('aaChart'); if(!ctx||typeof Chart==='undefined') return; var d=calculateAADistribution(); if(aaChart) aaChart.destroy(); aaChart=new Chart(ctx,{type:'bar',data:{labels:Object.keys(d),datasets:[{label:'%',data:Object.values(d),backgroundColor:'#4299e1'}]},options:{responsive:true,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true}}}}); }

// ========== HOME ==========
function initHomePage() { updateHomeStats(); displayFeaturedPeptides(); setTimeout(function(){if(peptidesData.length>0&&typeof Chart!=='undefined'){createLengthChart();createAAChart();}},100); }
function updateHomeStats() { var t=peptidesData.length, sum=peptidesData.reduce(function(s,p){return s+p.length;},0); var ae=document.getElementById('totalPeptides'),le=document.getElementById('avgLength'); if(ae) ae.textContent=t; if(le) le.textContent=t>0?(sum/t).toFixed(1):'0'; }
function displayFeaturedPeptides() { var c=document.getElementById('featuredPeptides'); if(!c) return; var fp=peptidesData.slice(0,6),h=''; fp.forEach(function(p){var u=getPeptideUrl(p.id,p.peptide_name); h+='<div class="peptide-card" onclick="location.href=\''+u+'\'" style="cursor:pointer"><div class="card-header"><h3>'+(p.peptide_name||'Unnamed')+'</h3></div><div class="card-content"><div class="card-row"><div class="card-label">Source:</div><div class="card-value">'+(p.source_organism||'N/A')+'</div></div><div class="card-row"><div class="card-label">Length:</div><div class="card-value">'+(p.length||'N/A')+' aa</div></div><div class="card-row"><div class="card-label">MW:</div><div class="card-value">'+(p.molecular_weight?p.molecular_weight.toFixed(1):'N/A')+' Da</div></div></div></div>';}); c.innerHTML=h||'<div class="loading">No peptides found</div>'; }

// ========== BROWSE ==========
function initBrowsePage() { var restored=restoreFilters(); if(!restored){filteredPeptides=[...peptidesData];updateBrowseStats();displayBrowseResults();}else{applyFilters();setTimeout(function(){document.querySelectorAll('.toggle-btn').forEach(function(b,i){b.classList.toggle('active',(currentView==='table'&&i===0)||(currentView==='card'&&i===1));});},100);return;} setupBrowseEventListeners();initModificationSelector();initSourceSelector(); }
function setupBrowseEventListeners() { ['searchInput','lengthMin','lengthMax','disulfideFilter','pdbFilter'].forEach(function(id){var el=document.getElementById(id);if(el){el.addEventListener('change',function(){saveFilters();applyFilters();});if(id==='searchInput') el.addEventListener('keypress',function(e){if(e.key==='Enter'){saveFilters();applyFilters();}});}}); }
function initModificationSelector() { var dd=document.getElementById('modDropdown');if(!dd) return;var mt={};peptidesData.forEach(function(p){(p.modifications||[]).forEach(function(m){if(m&&m!=='N/A'&&m!=='') mt[m.replace(/_/g,' ')]=m;});});var sk=Object.keys(mt).sort();dd.innerHTML=sk.map(function(k){return'<div class="multiselect-option"><input type="checkbox" value="'+mt[k]+'" onchange="updateModSelectionAndFilter()"><label>'+k+'</label></div>';}).join('');}
function toggleModDropdown(){var d=document.getElementById('modDropdown');if(d)d.classList.toggle('show');}
function updateModSelectionAndFilter(){selectedMods=[];document.querySelectorAll('#modDropdown input:checked').forEach(function(cb){selectedMods.push(cb.value);});var s=document.getElementById('modSelectedText');if(s)s.textContent=selectedMods.length===0?'All':(selectedMods.length===1?selectedMods[0].replace(/_/g,' '):selectedMods.length+' selected');saveFilters();applyFilters();}
function initSourceSelector(){var dd=document.getElementById('sourceDropdown');if(!dd)return;var src={};peptidesData.forEach(function(p){if(p.source_organism&&p.source_organism!=='N/A'){p.source_organism.split(',').forEach(function(s){s=s.trim().toLowerCase();if(s)src[s.charAt(0).toUpperCase()+s.slice(1)]=s;});}});var sk=Object.keys(src).sort();dd.innerHTML=sk.map(function(k){return'<div class="multiselect-option"><input type="checkbox" value="'+src[k]+'" onchange="updateSourceSelectionAndFilter()"><label>'+k+'</label></div>';}).join('');}
function toggleSourceDropdown(){var d=document.getElementById('sourceDropdown');if(d)d.classList.toggle('show');}
function updateSourceSelectionAndFilter(){selectedSources=[];document.querySelectorAll('#sourceDropdown input:checked').forEach(function(cb){selectedSources.push(cb.value);});var s=document.getElementById('sourceSelectedText');if(s)s.textContent=selectedSources.length===0?'All':(selectedSources.length===1?selectedSources[0].charAt(0).toUpperCase()+selectedSources[0].slice(1):selectedSources.length+' selected');saveFilters();applyFilters();}
function updateBrowseStats(){var el=document.getElementById('resultsCount');if(el)el.textContent='Found peptides: '+filteredPeptides.length;}
function applyFilters(){var st=(document.getElementById('searchInput')?.value||'').toLowerCase(),dv=document.getElementById('disulfideFilter')?.value||'all',pv=document.getElementById('pdbFilter')?.value||'all',mn=parseInt(document.getElementById('lengthMin')?.value)||0,mx=parseInt(document.getElementById('lengthMax')?.value)||1000;var result=[];for(var i=0;i<peptidesData.length;i++){var p=peptidesData[i];if(st&&!(p.peptide_name||'').toLowerCase().includes(st)&&!(p.sequence_one_letter||'').toLowerCase().includes(st)&&!(p.source_organism||'').toLowerCase().includes(st))continue;if(p.length<mn||p.length>mx)continue;if(selectedSources.length>0){var ps=(p.source_organism||'').toLowerCase().split(',').map(function(s){return s.trim();});if(!selectedSources.every(function(s){return ps.indexOf(s)!==-1;}))continue;}if(dv==='yes'&&(!p.disulfide_bridge||p.disulfide_bridge.toLowerCase()==='no'))continue;if(dv==='no'&&p.disulfide_bridge&&p.disulfide_bridge.toLowerCase()!=='no')continue;if(pv==='yes'&&!p.has_pdb)continue;if(pv==='no'&&p.has_pdb)continue;if(selectedMods.length>0){var pm=p.modifications||[];if(!selectedMods.every(function(m){return pm.indexOf(m)!==-1;}))continue;}result.push(p);}filteredPeptides=result;updateBrowseStats();displayBrowseResults();}
function resetFilters(){['searchInput'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});['disulfideFilter','pdbFilter'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='all';});var lmin=document.getElementById('lengthMin');if(lmin)lmin.value=0;var lmax=document.getElementById('lengthMax');if(lmax)lmax.value=100;document.querySelectorAll('#sourceDropdown input,#modDropdown input').forEach(function(cb){cb.checked=false;});selectedSources=[];selectedMods=[];var st=document.getElementById('sourceSelectedText');if(st)st.textContent='All';var mt=document.getElementById('modSelectedText');if(mt)mt.textContent='All';sortColumn='peptide_name';sortDirection='asc';filteredPeptides=[...peptidesData];saveFilters();updateBrowseStats();displayBrowseResults();}
function downloadFASTA(){if(!filteredPeptides.length)return alert('No results');var fa='';filteredPeptides.forEach(function(p){fa+='>'+(p.peptide_name||'peptide_'+p.id)+'\n';var seq=p.sequence_clean||'';for(var i=0;i<seq.length;i+=60)fa+=seq.substring(i,i+60)+'\n';});var b=new Blob([fa],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='barrpeps.fasta';a.click();}
function downloadFullCSV(){if(!filteredPeptides.length)return alert('No results');var h=['ID','Name','Sequence','Clean','Length','MW','Formula','Structure','Disulfide','Source','Modifications','PDB_IDs','Has_PDB'];var rows=filteredPeptides.map(function(p){return[p.id,p.peptide_name,p.sequence_one_letter,p.sequence_clean,p.length,p.molecular_weight,p.molecular_formula,p.structure_type,p.disulfide_bridge,p.source_organism,(p.modifications||[]).join('; '),(p.pdb_ids||[]).join('; '),p.has_pdb?'Yes':'No'];});var csv=h.join(',')+'\n'+rows.map(function(r){return r.map(function(c){return'"'+String(c||'').replace(/"/g,'""')+'"';}).join(',');}).join('\n');var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='barrpeps_full.csv';a.click();}
function displayBrowseResults(){var c=document.getElementById('resultsContainer');if(!c)return;if(!filteredPeptides.length){c.innerHTML='<div style="text-align:center;padding:2rem;">No peptides found</div>';return;}if(currentView==='table')displayTableView(c);else displayCardView(c);}
function displayTableView(container){var h='<div class="table-wrapper"><table class="data-table" style="width:100%;min-width:1000px;"><thead><tr><th onclick="sortBy(\'peptide_name\')">Name</th><th onclick="sortBy(\'sequence_one_letter\')">Sequence</th><th onclick="sortBy(\'length\')">Len</th><th onclick="sortBy(\'molecular_weight\')">MW</th><th>Mods</th><th onclick="sortBy(\'source_organism\')">Source</th><th onclick="sortBy(\'has_pdb\')">PDB</th><th>Details</th></tr></thead><tbody>';filteredPeptides.forEach(function(p){var seq=(p.sequence_one_letter||'');if(seq.length>35)seq=seq.substring(0,35)+'...';var u=getPeptideUrl(p.id,p.peptide_name);var pdb=p.has_pdb?'<span style="background:#48bb78;color:white;padding:2px 6px;border-radius:10px;font-size:0.65rem;">Yes</span>':'<span style="color:#a0aec0;">No</span>';var mods='';if(p.modifications&&p.modifications.length){var mf=p.modifications.map(function(m){return m.replace(/_/g,' ');});mods='<span style="font-size:0.65rem;color:#d69e2e;" title="'+mf.join(', ')+'">'+mf.slice(0,3).join(', ')+(mf.length>3?' +'+(mf.length-3):'')+'</span>';}else{mods='<span style="color:#a0aec0;font-size:0.65rem;">—</span>';}h+='<tr><td><a href="'+u+'" style="color:#2c5282;font-weight:bold;">'+(p.peptide_name||'N/A')+'</a></td><td style="font-family:monospace;font-size:0.7rem;">'+seq+'</td><td>'+(p.length||'N/A')+'</td><td>'+(p.molecular_weight?p.molecular_weight.toFixed(1):'N/A')+'</td><td>'+mods+'</td><td>'+(p.source_organism||'N/A')+'</td><td style="text-align:center;">'+pdb+'</td><td><a href="'+u+'" class="btn-primary" style="padding:4px 10px;font-size:0.7rem;">View</a></td></tr>';});h+='</tbody></table></div>';container.innerHTML=h;}
function displayCardView(container){var h='<div class="peptide-grid">';filteredPeptides.forEach(function(p){var u=getPeptideUrl(p.id,p.peptide_name);var pdb=p.has_pdb?'<span style="background:#48bb78;color:white;padding:2px 6px;border-radius:10px;font-size:0.6rem;margin-left:0.5rem;">PDB</span>':'';var mods='';if(p.modifications&&p.modifications.length){var mf=p.modifications.map(function(m){return m.replace(/_/g,' ');});mods='<div class="card-row"><div class="card-label">Mods:</div><div class="card-value" style="color:#d69e2e;" title="'+mf.join(', ')+'">'+mf.slice(0,2).join(', ')+(mf.length>2?' +'+(mf.length-2):'')+'</div></div>';}h+='<div class="peptide-card" onclick="location.href=\''+u+'\'" style="cursor:pointer;"><div class="card-header"><h3>'+(p.peptide_name||'Unnamed')+pdb+'</h3></div><div class="card-content"><div class="card-row"><div class="card-label">Source:</div><div class="card-value">'+(p.source_organism||'N/A')+'</div></div><div class="card-row"><div class="card-label">Length:</div><div class="card-value">'+(p.length||'N/A')+' aa</div></div><div class="card-row"><div class="card-label">MW:</div><div class="card-value">'+(p.molecular_weight?p.molecular_weight.toFixed(1):'N/A')+' Da</div></div>'+mods+'</div></div>';});h+='</div>';container.innerHTML=h;}
function setView(view){currentView=view;document.querySelectorAll('.toggle-btn').forEach(function(b,i){b.classList.toggle('active',(view==='table'&&i===0)||(view==='card'&&i===1));});saveFilters();displayBrowseResults();}
function sortBy(column){if(sortColumn===column)sortDirection=sortDirection==='asc'?'desc':'asc';else{sortColumn=column;sortDirection='asc';}filteredPeptides.sort(function(a,b){var va=a[column],vb=b[column];if(va==null||va==='')va=-Infinity;if(vb==null||vb==='')vb=-Infinity;if(typeof va==='string'){va=va.toLowerCase();vb=vb.toLowerCase();}return(va<vb?-1:va>vb?1:0)*(sortDirection==='asc'?1:-1);});saveFilters();displayBrowseResults();}

// ========== REFERENCES ==========
function formatLiteratureLinks(text){if(!text||typeof text!=='string'||text.trim()===''||text==='{}'||text==='[]')return'';text=text.trim();var refs=[];if(text.startsWith('{')&&text.endsWith('}')){try{var p=JSON.parse(text.replace(/'/g,'"'));for(var k in p){if(p[k]&&typeof p[k]==='object'){var r=p[k],s=(r['Author(s)']||'')+(r['Year']?' ('+r['Year']+')':'')+(r['Title']?' '+r['Title']:'')+(r['Journal']?' '+r['Journal']:'');if(s.trim())refs.push(s);}} }catch(e){refs.push(text);}}else{refs.push(text);}var h='';refs.forEach(function(t){t=t.replace(/(10\.\d{4,}\/[^\s,;.]+)/g,'<a href="https://doi.org/$1" target="_blank" style="color:#4299e1;">$1</a>');t=t.replace(/PMID:?\s*(\d+)/gi,'<a href="https://pubmed.ncbi.nlm.nih.gov/$1" target="_blank" style="color:#4299e1;">$&</a>');h+='<div class="detail-row" style="margin-bottom:0.5rem;"><span class="detail-value" style="font-size:0.8rem;line-height:1.5;">'+t+'</span></div>';});return h;}

// ========== PEPTIDE DETAIL ==========
async function initPeptidePage(){var params=new URLSearchParams(window.location.search);var id=parseInt(params.get('id'));var peptide=peptidesData.find(function(p){return p.id===id;});if(!peptide){var dc=document.getElementById('peptideDetail');if(dc)dc.innerHTML='<div class="error-message"><p>Peptide not found</p><a href="browse.html" class="btn-primary">Browse Database</a></div>';return;}document.title=peptide.peptide_name+' - BarrPeps';var pdbContents=[],pdbIds=[];if(peptide.pdb_ids){for(var i=0;i<peptide.pdb_ids.length;i++){var c=await fetchPDBStructure(peptide.pdb_ids[i]);if(c){pdbContents.push(c);pdbIds.push(peptide.pdb_ids[i]);}}}displayPeptideDetail(peptide,pdbContents,pdbIds);}

function displayPeptideDetail(peptide,pdbContents,pdbIds){
    var validStructures=[];for(var i=0;i<pdbIds.length;i++){if(pdbContents[i])validStructures.push({id:pdbIds[i],content:pdbContents[i]});}
    var hasPDB=validStructures.length>0;
    window.currentPeptideSequence=peptide.sequence_clean;
    window.currentDisulfideBonds=peptide.disulfide_bonds||[];
    
    var modsH='';if(peptide.modifications&&peptide.modifications.length){modsH='<div class="detail-section"><h3>Modifications</h3><div class="detail-row"><span class="detail-value">'+peptide.modifications.map(function(m){return m.replace(/_/g,' ');}).join(', ')+'</span></div></div>';}else{modsH='<div class="detail-section"><h3>Modifications</h3><div class="detail-row"><span class="detail-value">None reported</span></div></div>';}
    
    var pdbH='';if(peptide.pdb_ids&&peptide.pdb_ids.length){pdbH='<div class="detail-section"><h3>PDB Structures</h3><div class="detail-row"><span class="detail-label">Available:</span><span class="detail-value">'+peptide.pdb_ids.map(function(id){return'<a href="https://www.rcsb.org/structure/'+id+'" target="_blank" style="color:#4299e1;">'+id+'</a>';}).join(', ')+'</span></div>';}if(peptide.related_pdb_ids&&peptide.related_pdb_ids.length){pdbH+='<div class="detail-row" style="margin-top:0.75rem;"><span class="detail-label">Related:</span><span class="detail-value"><select id="relatedPdbSelect" style="padding:0.3rem;border:1px solid #cbd5e0;border-radius:6px;font-size:0.75rem;margin-right:0.5rem;"><option value="">-- Select --</option>'+peptide.related_pdb_ids.map(function(id){return'<option value="'+id+'">'+id+'</option>';}).join('')+'</select><button onclick="openRelatedPdb()" style="padding:0.3rem 0.8rem;background:#4299e1;color:white;border:none;border-radius:6px;font-size:0.7rem;cursor:pointer;">Open</button></span></div>';}if(pdbH)pdbH+='</div>';
    
    var expH='';if(peptide.experiments&&peptide.experiments.length){var seen={},unique=peptide.experiments.filter(function(e){var k=(e.method||'')+'|'+(e.response||'')+'|'+(e.result||'')+'|'+(e.unit||'');if(seen[k])return false;seen[k]=true;return true;});expH='<div class="detail-section"><h3>Experimental Data</h3><div class="table-wrapper"><table style="width:100%;font-size:0.75rem;"><thead><tr><th>Method</th><th>Type</th><th>Response</th><th>Result</th><th>Transport</th><th>Model</th></tr></thead><tbody>';unique.forEach(function(e){expH+='<tr><td>'+(e.method||'N/A')+'</td><td>'+(e.method_type||'N/A')+'</td><td>'+(e.response||'N/A')+'</td><td>'+(e.result||'')+(e.unit?' '+e.unit:'')+'</td><td>'+(e.transport_type||'N/A')+'</td><td>'+(e.cell_line||e.animal_model||'N/A')+'</td></tr>';});expH+='</tbody></table></div></div>';}else{expH='<div class="detail-section"><h3>Experimental Data</h3><div class="detail-row"><span class="detail-value">No experimental data available</span></div></div>';}
    
    var refH='',litH=formatLiteratureLinks(peptide.notes||'');refH=litH?'<div class="detail-section"><h3>References</h3>'+litH+'</div>':'<div class="detail-section"><h3>References</h3><div class="detail-row"><span class="detail-value">No references available</span></div></div>';
    
    var disulfideH='';if(peptide.disulfide_bridge&&peptide.disulfide_bridge.toLowerCase()!=='no'&&peptide.disulfide_bridge!==''){disulfideH='<div class="detail-section"><h3>Disulfide Bonds</h3><div class="detail-row"><span class="detail-value" style="color:#d69e2e;font-weight:600;">'+peptide.disulfide_bridge+'</span></div></div>';}
    
    var html='<div class="peptide-detail-container"><div style="margin-bottom:1rem;"><a href="browse.html" class="btn-secondary back-button">← Back to Browse</a><h1 style="color:#2c5282;margin-top:0.5rem;">'+(peptide.peptide_name||'N/A')+'</h1><p style="color:#718096;">ID: '+peptide.id+'</p></div>';
    
    if(hasPDB){var selH=validStructures.length>1?'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;"><h3 style="font-size:0.9rem;margin:0;">3D Structure</h3><select id="pdbSelector" onchange="switchPDB(this.value)">'+validStructures.map(function(s,i){return'<option value="'+i+'"'+(i===0?' selected':'')+'>'+s.id+'</option>';}).join('')+'</select></div>':'<h3 style="font-size:0.9rem;margin-bottom:0.6rem;">3D Structure - PDB: '+validStructures[0].id+'</h3>';
        html+='<div class="structure-viewer">'+selH+'<div id="structure-viewer-pdb" class="structure-container"></div><div class="structure-legend"><div class="legend-item"><div class="legend-color carbon"></div><span>Carbon</span></div><div class="legend-item"><div class="legend-color oxygen"></div><span>Oxygen</span></div><div class="legend-item"><div class="legend-color nitrogen"></div><span>Nitrogen</span></div><div class="legend-item"><div class="legend-color sulfur"></div><span>Sulfur</span></div><div class="legend-item"><div class="legend-color disulfide"></div><span>Disulfide</span></div></div><div class="pdb-info"><strong>PDB: <span id="currentPdbId">'+validStructures[0].id+'</span></strong> | <a href="https://www.rcsb.org/structure/'+validStructures[0].id+'" target="_blank" id="rcsbLink">RCSB</a></div></div>';
        window.pdbStructures=validStructures;}else{html+='<div class="structure-viewer"><h3>3D Structure</h3><div class="no-structure"><p>No PDB structure available.</p></div></div>';}
    
    html+='<div class="detail-section"><h3>Basic Information</h3>'+
        '<div class="detail-row"><span class="detail-label">Sequence (1-letter):</span><span class="detail-value" style="font-family:monospace;word-break:break-all;">'+(peptide.sequence_one_letter||'N/A')+'</span></div>'+
        '<div class="detail-row"><span class="detail-label">Sequence (3-letter):</span><span class="detail-value" style="word-break:break-all;">'+(peptide.sequence_three_letter||'N/A')+'</span></div>'+
        '<div class="detail-row"><span class="detail-label">Clean sequence:</span><span class="detail-value" style="font-family:monospace;">'+(peptide.sequence_clean||'N/A')+'</span></div>'+
        '<div class="detail-row"><span class="detail-label">Length:</span><span class="detail-value">'+(peptide.length||'N/A')+' aa</span></div>'+
        '<div class="detail-row"><span class="detail-label">MW:</span><span class="detail-value">'+(peptide.molecular_weight?peptide.molecular_weight.toFixed(2):'N/A')+' Da</span></div>'+
        (peptide.molecular_formula?'<div class="detail-row"><span class="detail-label">Formula:</span><span class="detail-value">'+peptide.molecular_formula+'</span></div>':'')+
        '</div>'+
        (peptide.structure_type&&peptide.structure_type!=='N/A'?'<div class="detail-section"><h3>Structural Properties</h3><div class="detail-row"><span class="detail-label">Conformation:</span><span class="detail-value">'+peptide.structure_type+'</span></div></div>':'')+
        disulfideH+
        (peptide.source_organism&&peptide.source_organism!=='N/A'?'<div class="detail-section"><h3>Source</h3><div class="detail-row"><span class="detail-label">Organism:</span><span class="detail-value">'+peptide.source_organism+'</span></div></div>':'')+
        pdbH+modsH+expH+refH+'</div>';
    
    var dc=document.getElementById('peptideDetail');if(dc)dc.innerHTML=html;
    if(hasPDB&&validStructures.length>0){setTimeout(function(){renderPDBStructure(validStructures[0].content,validStructures[0].id,peptide.sequence_clean,peptide.disulfide_bonds);},100);}
}

// ========== EXPORTS ==========
window.searchPeptides=applyFilters; window.resetFilters=resetFilters; window.setView=setView; window.sortBy=sortBy;
window.applyAllFilters=applyFilters; window.resetAllFilters=resetFilters;
window.downloadFASTA=downloadFASTA; window.downloadFullCSV=downloadFullCSV;
window.setRepresentation=setRepresentation; window.switchPDB=switchPDB; window.openRelatedPdb=openRelatedPdb;
window.toggleModDropdown=toggleModDropdown; window.updateModSelectionAndFilter=updateModSelectionAndFilter;
window.toggleSourceDropdown=toggleSourceDropdown; window.updateSourceSelectionAndFilter=updateSourceSelectionAndFilter;
window.showUnderConstruction=showUnderConstruction; window.closeModal=closeModal;

document.addEventListener('DOMContentLoaded',function(){if(typeof XLSX!=='undefined')loadExcelFile();else useFallbackData();});
