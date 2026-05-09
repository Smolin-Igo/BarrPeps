// BarrPeps Sequence Alignment Tool

let peptidesData = [];
let peptidesLoaded = false;

// BLOSUM62 substitution matrix
const BLOSUM62 = {
    'A': {'A':4,'R':-1,'N':-2,'D':-2,'C':0,'Q':-1,'E':-1,'G':0,'H':-2,'I':-1,'L':-1,'K':-1,'M':-1,'F':-2,'P':-1,'S':1,'T':0,'W':-3,'Y':-2,'V':0},
    'R': {'A':-1,'R':5,'N':0,'D':-2,'C':-3,'Q':1,'E':0,'G':-2,'H':0,'I':-3,'L':-2,'K':2,'M':-1,'F':-3,'P':-2,'S':-1,'T':-1,'W':-3,'Y':-2,'V':-3},
    'N': {'A':-2,'R':0,'N':6,'D':1,'C':-3,'Q':0,'E':0,'G':0,'H':1,'I':-3,'L':-3,'K':0,'M':-2,'F':-3,'P':-2,'S':1,'T':0,'W':-4,'Y':-2,'V':-3},
    'D': {'A':-2,'R':-2,'N':1,'D':6,'C':-3,'Q':0,'E':2,'G':-1,'H':-1,'I':-3,'L':-4,'K':-1,'M':-3,'F':-3,'P':-1,'S':0,'T':-1,'W':-4,'Y':-3,'V':-3},
    'C': {'A':0,'R':-3,'N':-3,'D':-3,'C':9,'Q':-3,'E':-4,'G':-3,'H':-3,'I':-1,'L':-1,'K':-3,'M':-1,'F':-2,'P':-3,'S':-1,'T':-1,'W':-2,'Y':-2,'V':-1},
    'Q': {'A':-1,'R':1,'N':0,'D':0,'C':-3,'Q':5,'E':2,'G':-2,'H':0,'I':-3,'L':-2,'K':1,'M':0,'F':-3,'P':-1,'S':0,'T':-1,'W':-2,'Y':-1,'V':-2},
    'E': {'A':-1,'R':0,'N':0,'D':2,'C':-4,'Q':2,'E':5,'G':-2,'H':0,'I':-3,'L':-3,'K':1,'M':-2,'F':-3,'P':-1,'S':0,'T':-1,'W':-3,'Y':-2,'V':-2},
    'G': {'A':0,'R':-2,'N':0,'D':-1,'C':-3,'Q':-2,'E':-2,'G':6,'H':-2,'I':-4,'L':-4,'K':-2,'M':-3,'F':-3,'P':-2,'S':0,'T':-2,'W':-2,'Y':-3,'V':-3},
    'H': {'A':-2,'R':0,'N':1,'D':-1,'C':-3,'Q':0,'E':0,'G':-2,'H':8,'I':-3,'L':-3,'K':-1,'M':-2,'F':-1,'P':-2,'S':-1,'T':-2,'W':-2,'Y':2,'V':-3},
    'I': {'A':-1,'R':-3,'N':-3,'D':-3,'C':-1,'Q':-3,'E':-3,'G':-4,'H':-3,'I':4,'L':2,'K':-3,'M':1,'F':0,'P':-3,'S':-2,'T':-1,'W':-3,'Y':-1,'V':3},
    'L': {'A':-1,'R':-2,'N':-3,'D':-4,'C':-1,'Q':-2,'E':-3,'G':-4,'H':-3,'I':2,'L':4,'K':-2,'M':2,'F':0,'P':-3,'S':-2,'T':-1,'W':-2,'Y':-1,'V':1},
    'K': {'A':-1,'R':2,'N':0,'D':-1,'C':-3,'Q':1,'E':1,'G':-2,'H':-1,'I':-3,'L':-2,'K':5,'M':-1,'F':-3,'P':-1,'S':0,'T':-1,'W':-3,'Y':-2,'V':-2},
    'M': {'A':-1,'R':-1,'N':-2,'D':-3,'C':-1,'Q':0,'E':-2,'G':-3,'H':-2,'I':1,'L':2,'K':-1,'M':5,'F':0,'P':-2,'S':-1,'T':-1,'W':-1,'Y':-1,'V':1},
    'F': {'A':-2,'R':-3,'N':-3,'D':-3,'C':-2,'Q':-3,'E':-3,'G':-3,'H':-1,'I':0,'L':0,'K':-3,'M':0,'F':6,'P':-4,'S':-2,'T':-2,'W':1,'Y':3,'V':-1},
    'P': {'A':-1,'R':-2,'N':-2,'D':-1,'C':-3,'Q':-1,'E':-1,'G':-2,'H':-2,'I':-3,'L':-3,'K':-1,'M':-2,'F':-4,'P':7,'S':-1,'T':-1,'W':-4,'Y':-3,'V':-2},
    'S': {'A':1,'R':-1,'N':1,'D':0,'C':-1,'Q':0,'E':0,'G':0,'H':-1,'I':-2,'L':-2,'K':0,'M':-1,'F':-2,'P':-1,'S':4,'T':1,'W':-3,'Y':-2,'V':-2},
    'T': {'A':0,'R':-1,'N':0,'D':-1,'C':-1,'Q':-1,'E':-1,'G':-2,'H':-2,'I':-1,'L':-1,'K':-1,'M':-1,'F':-2,'P':-1,'S':1,'T':5,'W':-2,'Y':-2,'V':0},
    'W': {'A':-3,'R':-3,'N':-4,'D':-4,'C':-2,'Q':-2,'E':-3,'G':-2,'H':-2,'I':-3,'L':-2,'K':-3,'M':-1,'F':1,'P':-4,'S':-3,'T':-2,'W':11,'Y':2,'V':-3},
    'Y': {'A':-2,'R':-2,'N':-2,'D':-3,'C':-2,'Q':-1,'E':-2,'G':-3,'H':2,'I':-1,'L':-1,'K':-2,'M':-1,'F':3,'P':-3,'S':-2,'T':-2,'W':2,'Y':7,'V':-1},
    'V': {'A':0,'R':-3,'N':-3,'D':-3,'C':-1,'Q':-2,'E':-2,'G':-3,'H':-3,'I':3,'L':1,'K':-2,'M':1,'F':-1,'P':-2,'S':-2,'T':0,'W':-3,'Y':-1,'V':4}
};

// ========== DATA LOADING ==========
function loadExcelFile() {
    fetch('database.xlsx')
        .then(function(response) {
            if (!response.ok) throw new Error('HTTP error');
            return response.arrayBuffer();
        })
        .then(function(arrayBuffer) {
            var workbook = XLSX.read(arrayBuffer, { type: 'array' });
            var sheetNames = workbook.SheetNames;
            
            for (var s = 0; s < sheetNames.length; s++) {
                var sheetName = sheetNames[s];
                if (sheetName.toLowerCase() === 'peptides') {
                    var worksheet = workbook.Sheets[sheetName];
                    peptidesData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
                    peptidesLoaded = true;
                    console.log('Loaded', peptidesData.length, 'peptides for alignment');
                    var btn = document.getElementById('alignBtn');
                    if (btn) btn.disabled = false;
                    break;
                }
            }
        })
        .catch(function(error) {
            console.error('Error loading data:', error);
        });
}

// ========== UTILITY FUNCTIONS ==========
function getBLOSUMScore(aa1, aa2) {
    if (!aa1 || !aa2) return -4;
    aa1 = aa1.toUpperCase();
    aa2 = aa2.toUpperCase();
    if (!BLOSUM62[aa1] || !BLOSUM62[aa1][aa2]) return -4;
    return BLOSUM62[aa1][aa2];
}

function sanitizeSequence(seq) {
    if (!seq) return '';
    var valid = 'ACDEFGHIKLMNPQRSTVWY';
    return seq.toUpperCase().split('').filter(function(aa) {
        return valid.indexOf(aa) !== -1;
    }).join('');
}

// ========== SMITH-WATERMAN LOCAL ALIGNMENT ==========
function smithWaterman(query, target, matchScore, gapPenalty) {
    var m = query.length;
    var n = target.length;
    
    // Score and traceback matrices
    var score = [];
    for (var i = 0; i <= m; i++) {
        score[i] = new Array(n + 1).fill(0);
    }
    
    var maxScore = 0;
    var maxI = 0;
    var maxJ = 0;
    
    // Fill matrix
    for (var i = 1; i <= m; i++) {
        for (var j = 1; j <= n; j++) {
            var blosum = getBLOSUMScore(query[i - 1], target[j - 1]);
            var match = blosum > 0 ? matchScore * (blosum > 2 ? 2 : 1) : blosum;
            var diag = score[i - 1][j - 1] + match;
            var up = score[i - 1][j] + gapPenalty;
            var left = score[i][j - 1] + gapPenalty;
            
            score[i][j] = Math.max(0, diag, up, left);
            
            if (score[i][j] > maxScore) {
                maxScore = score[i][j];
                maxI = i;
                maxJ = j;
            }
        }
    }
    
    // Traceback
    var queryAligned = '';
    var targetAligned = '';
    var alignment = '';
    var i = maxI;
    var j = maxJ;
    var identities = 0;
    var positives = 0;
    var gaps = 0;
    
    while (i > 0 && j > 0 && score[i][j] > 0) {
        var blosum = getBLOSUMScore(query[i - 1], target[j - 1]);
        var match = blosum > 0 ? matchScore * (blosum > 2 ? 2 : 1) : blosum;
        
        if (score[i][j] === score[i - 1][j - 1] + match) {
            queryAligned = query[i - 1] + queryAligned;
            targetAligned = target[j - 1] + targetAligned;
            if (query[i - 1] === target[j - 1]) {
                alignment = '|' + alignment;
                identities++;
                positives++;
            } else if (blosum > 0) {
                alignment = '.' + alignment;
                positives++;
            } else {
                alignment = ' ' + alignment;
            }
            i--;
            j--;
        } else if (score[i][j] === score[i - 1][j] + gapPenalty) {
            queryAligned = query[i - 1] + queryAligned;
            targetAligned = '-' + targetAligned;
            alignment = ' ' + alignment;
            gaps++;
            i--;
        } else {
            queryAligned = '-' + queryAligned;
            targetAligned = target[j - 1] + targetAligned;
            alignment = ' ' + alignment;
            gaps++;
            j--;
        }
    }
    
    var alnLen = queryAligned.length;
    var queryCoverage = query.length > 0 ? (alnLen / query.length * 100) : 0;
    var combinedScore = maxScore * (queryCoverage / 100) * (alnLen > 0 ? (identities / alnLen) : 0);
    
    return {
        queryAligned: queryAligned,
        targetAligned: targetAligned,
        alignment: alignment,
        score: maxScore,
        identities: identities,
        positives: positives,
        gaps: gaps,
        length: alnLen,
        identityPercent: alnLen > 0 ? (identities / alnLen * 100) : 0,
        positivePercent: alnLen > 0 ? (positives / alnLen * 100) : 0,
        queryCoverage: queryCoverage,
        combinedScore: combinedScore,
        queryStart: i,
        queryEnd: maxI,
        targetStart: j,
        targetEnd: maxJ,
        fullTarget: target
    };
}

// ========== MAIN ALIGNMENT FUNCTION ==========
function runAlignment() {
    if (!peptidesLoaded) {
        alert('Database is still loading. Please wait a moment and try again.');
        return;
    }
    
    var rawQuery = document.getElementById('querySequence').value;
    var query = sanitizeSequence(rawQuery);
    var minIdentity = parseFloat(document.getElementById('minIdentity').value) || 30;
    var maxResults = parseInt(document.getElementById('maxResults').value) || 20;
    var gapPenalty = parseInt(document.getElementById('gapPenalty').value) || -2;
    var matchScore = parseInt(document.getElementById('matchScore').value) || 1;
    
    if (!query || query.length < 3) {
        alert('Please enter a sequence of at least 3 amino acids.');
        return;
    }
    
    var resultsSection = document.getElementById('resultsSection');
    var alignResults = document.getElementById('alignResults');
    
    if (resultsSection) resultsSection.style.display = 'block';
    if (alignResults) alignResults.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Aligning ' + query.length + ' aa query against ' + peptidesData.length + ' peptides...</p></div>';
    
    setTimeout(function() {
        var results = [];
        
        for (var i = 0; i < peptidesData.length; i++) {
            var p = peptidesData[i];
            var cleanSeq = p['sequence_1_clean'] || p['sequence_1'] || '';
            var target = sanitizeSequence(cleanSeq);
            
            if (!target || target.length < 2) continue;
            
            var aln = smithWaterman(query, target, matchScore, gapPenalty);
            
            // Filtering criteria
            var minCoverage = query.length <= 10 ? 40 : 30;
            if (aln.identityPercent >= minIdentity && aln.queryCoverage >= minCoverage && aln.length >= 3) {
                aln.peptideName = p['trivial_name'] || 'Peptide ' + p['peptide_id'];
                aln.peptideId = p['peptide_id'];
                aln.peptideLength = p['length'] || target.length;
                results.push(aln);
            }
        }
        
        // Sort by combined score (score * coverage * identity)
        results.sort(function(a, b) {
            return b.combinedScore - a.combinedScore;
        });
        
        results = results.slice(0, maxResults);
        displayResults(results, query);
    }, 100);
}

// ========== DISPLAY RESULTS ==========
function displayResults(results, query) {
    var container = document.getElementById('alignResults');
    var countEl = document.getElementById('resultsCount');
    
    if (!results || results.length === 0) {
        if (container) {
            container.innerHTML = '<div class="no-results">' +
                '<p><strong>No significant matches found.</strong></p>' +
                '<p style="font-size:0.85rem;">Try lowering the minimum identity threshold or using a shorter query sequence.</p>' +
                '<p style="font-size:0.75rem;color:#a0aec0;">Query: ' + query + ' (' + query.length + ' aa)</p>' +
            '</div>';
        }
        if (countEl) countEl.textContent = 'No results for ' + query.length + ' aa query';
        return;
    }
    
    if (countEl) countEl.textContent = 'Found ' + results.length + ' match(es) | Query: ' + query.length + ' aa';
    
    var html = '';
    
    for (var i = 0; i < results.length; i++) {
        var aln = results[i];
        var name = aln.peptideName || 'Unknown';
        var pid = aln.peptideId;
        var peptideUrl = 'peptide.html?id=' + pid + '&name=' + encodeURIComponent(name);
        
        var identityClass = aln.identityPercent >= 80 ? 'score-high' : (aln.identityPercent >= 50 ? 'score-medium' : 'score-low');
        var coverageClass = aln.queryCoverage >= 80 ? 'score-high' : (aln.queryCoverage >= 50 ? 'score-medium' : 'score-low');
        
        html += '<div class="alignment-card">';
        
        // Header
        html += '<div class="alignment-header">';
        html += '<h4><a href="' + peptideUrl + '" target="_blank">#' + (i + 1) + ' ' + name + '</a></h4>';
        html += '<div style="display:flex;gap:0.4rem;">';
        html += '<span class="score-badge ' + identityClass + '">' + aln.identityPercent.toFixed(1) + '% id</span>';
        html += '<span class="score-badge ' + coverageClass + '">' + aln.queryCoverage.toFixed(0) + '% cov</span>';
        html += '</div></div>';
        
        // Stats
        html += '<div class="stats-row">';
        html += '<span><strong>Score:</strong> ' + aln.score + '</span>';
        html += '<span><strong>Identities:</strong> ' + aln.identities + '/' + aln.length + '</span>';
        html += '<span><strong>Positives:</strong> ' + aln.positives + '/' + aln.length + '</span>';
        html += '<span><strong>Gaps:</strong> ' + aln.gaps + '</span>';
        html += '</div>';
        
        // Полная последовательность с выравниванием
        var fullSeq = aln.fullTarget;
        var beforeTarget = fullSeq.substring(0, aln.targetStart);
        var afterTarget = fullSeq.substring(aln.targetEnd);
        
        // Выровненный таргет с цветами
        var targetHtml = '';
        for (var c = 0; c < aln.targetAligned.length; c++) {
            var tAA = aln.targetAligned[c];
            var qAA = aln.queryAligned[c];
            var mark = aln.alignment[c];
            
            if (tAA === '-' || qAA === '-') {
                targetHtml += '<span class="gap-aa">·</span>';
            } else if (mark === '|') {
                targetHtml += '<span class="match-aa">' + tAA + '</span>';
            } else if (mark === '.') {
                targetHtml += '<span class="similar-aa">' + tAA + '</span>';
            } else {
                targetHtml += '<span class="mismatch-aa">' + tAA + '</span>';
            }
        }
        
        // Query с цветами
        var queryHtml = '';
        for (var c = 0; c < aln.queryAligned.length; c++) {
            var qAA = aln.queryAligned[c];
            var tAA = aln.targetAligned[c];
            var mark = aln.alignment[c];
            
            if (qAA === '-' || tAA === '-') {
                queryHtml += '<span class="gap-aa">·</span>';
            } else if (mark === '|') {
                queryHtml += '<span class="match-aa">' + qAA + '</span>';
            } else if (mark === '.') {
                queryHtml += '<span class="similar-aa">' + qAA + '</span>';
            } else {
                queryHtml += '<span class="mismatch-aa">' + qAA + '</span>';
            }
        }
        
        // Палочки выравнивания
        var alignHtml = '';
        for (var c = 0; c < aln.alignment.length; c++) {
            var mark = aln.alignment[c];
            if (mark === '|') {
                alignHtml += '<span style="color:#276749;font-weight:bold;">|</span>';
            } else if (mark === '.') {
                alignHtml += '<span style="color:#d69e2e;font-weight:bold;">.</span>';
            } else {
                alignHtml += ' ';
            }
        }
        
        html += '<div style="background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.8rem;overflow-x:auto;">';
        
        // Query строка
        html += '<div style="font-family:\'Courier New\',monospace;font-size:0.8rem;line-height:1.4;white-space:nowrap;">';
        html += '<span style="color:#2c5282;">Query </span>';
        html += '<span style="color:#a0aec0;">' + '·'.repeat(aln.targetStart) + '</span>';
        html += queryHtml;
        html += '<span style="color:#a0aec0;">' + '·'.repeat(fullSeq.length - aln.targetEnd) + '</span>';
        html += '</div>';
        
        // Alignment строка (палочки)
        html += '<div style="font-family:\'Courier New\',monospace;font-size:0.8rem;line-height:1.4;white-space:nowrap;">';
        html += '<span style="color:#718096;">      </span>';
        html += '<span style="color:#a0aec0;">' + '·'.repeat(aln.targetStart) + '</span>';
        html += alignHtml;
        html += '<span style="color:#a0aec0;">' + '·'.repeat(fullSeq.length - aln.targetEnd) + '</span>';
        html += '</div>';
        
        // Target строка
        html += '<div style="font-family:\'Courier New\',monospace;font-size:0.8rem;line-height:1.4;white-space:nowrap;">';
        html += '<span style="color:#c05621;">Sbjct </span>';
        html += '<span style="color:#a0aec0;">' + beforeTarget + '</span>';
        html += targetHtml;
        html += '<span style="color:#a0aec0;">' + afterTarget + '</span>';
        html += '</div>';
        
        html += '</div>';
        html += '</div>';
    }
    
    if (container) container.innerHTML = html;
}

// ========== CLEAR ==========
function clearAll() {
    var queryEl = document.getElementById('querySequence');
    var resultsSection = document.getElementById('resultsSection');
    var alignResults = document.getElementById('alignResults');
    
    if (queryEl) queryEl.value = '';
    if (resultsSection) resultsSection.style.display = 'none';
    if (alignResults) alignResults.innerHTML = '';
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    var alignBtn = document.getElementById('alignBtn');
    if (alignBtn) alignBtn.disabled = true;
    
    if (typeof XLSX !== 'undefined') {
        loadExcelFile();
    } else {
        console.warn('XLSX library not loaded');
    }
    
    // Ctrl+Enter shortcut
    var queryEl = document.getElementById('querySequence');
    if (queryEl) {
        queryEl.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                runAlignment();
            }
        });
    }
});

// ========== EXPORTS ==========
window.runAlignment = runAlignment;
window.clearAll = clearAll;
