// BarrPeps Sequence Alignment Tool

let peptidesData = [];
let peptidesLoaded = false;

// BLOSUM62 matrix
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

function loadExcelFile() {
    fetch('database.xlsx')
        .then(function(response) {
            if (!response.ok) throw new Error('HTTP error');
            return response.arrayBuffer();
        })
        .then(function(arrayBuffer) {
            var workbook = XLSX.read(arrayBuffer, { type: 'array' });
            var sheet = workbook.Sheets['peptides'];
            if (sheet) {
                peptidesData = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });
                peptidesLoaded = true;
                console.log('Loaded', peptidesData.length, 'peptides');
                document.getElementById('alignBtn').disabled = false;
            }
        })
        .catch(function(error) {
            console.error('Error:', error);
        });
}

function getBLOSUMScore(aa1, aa2) {
    if (!aa1 || !aa2) return -4;
    aa1 = aa1.toUpperCase();
    aa2 = aa2.toUpperCase();
    if (!BLOSUM62[aa1] || !BLOSUM62[aa1][aa2]) return -4;
    return BLOSUM62[aa1][aa2];
}

function sanitizeSequence(seq) {
    var valid = 'ACDEFGHIKLMNPQRSTVWY';
    return seq.toUpperCase().split('').filter(function(aa) {
        return valid.indexOf(aa) !== -1;
    }).join('');
}

function smithWaterman(query, target, matchScore, gapPenalty) {
    var m = query.length;
    var n = target.length;
    
    var score = [];
    for (var i = 0; i <= m; i++) {
        score[i] = [];
        for (var j = 0; j <= n; j++) {
            score[i][j] = 0;
        }
    }
    
    var maxScore = 0;
    var maxI = 0;
    var maxJ = 0;
    
    for (var i = 1; i <= m; i++) {
        for (var j = 1; j <= n; j++) {
            var blosum = getBLOSUMScore(query[i-1], target[j-1]);
            var match = blosum > 0 ? matchScore : (blosum < 0 ? blosum : 0);
            var diag = score[i-1][j-1] + match;
            var up = score[i-1][j] + gapPenalty;
            var left = score[i][j-1] + gapPenalty;
            
            score[i][j] = Math.max(0, diag, up, left);
            
            if (score[i][j] > maxScore) {
                maxScore = score[i][j];
                maxI = i;
                maxJ = j;
            }
        }
    }
    
    var align1 = '';
    var align2 = '';
    var alignment = '';
    var i = maxI;
    var j = maxJ;
    var identities = 0;
    var positives = 0;
    var gaps = 0;
    
    while (i > 0 && j > 0 && score[i][j] > 0) {
        var blosum = getBLOSUMScore(query[i-1], target[j-1]);
        var match = blosum > 0 ? matchScore : (blosum < 0 ? blosum : 0);
        
        if (score[i][j] === score[i-1][j-1] + match) {
            align1 = query[i-1] + align1;
            align2 = target[j-1] + align2;
            if (query[i-1] === target[j-1]) {
                alignment = '|' + alignment;
                identities++;
                positives++;
            } else if (blosum > 0) {
                alignment = '.' + alignment;
                positives++;
            } else {
                alignment = ' ' + alignment;
            }
            i--; j--;
        } else if (i > 0 && score[i][j] === score[i-1][j] + gapPenalty) {
            align1 = query[i-1] + align1;
            align2 = '-' + align2;
            alignment = ' ' + alignment;
            gaps++;
            i--;
        } else {
            align1 = '-' + align1;
            align2 = target[j-1] + align2;
            alignment = ' ' + alignment;
            gaps++;
            j--;
        }
    }
    
    var alnLen = align1.length;
    
    return {
        queryAligned: align1,
        targetAligned: align2,
        alignment: alifunction smithWaterman(query, target, matchScore, gapPenalty) {
    var m = query.length;
    var n = target.length;
    
    var score = [];
    var traceback = [];
    for (var i = 0; i <= m; i++) {
        score[i] = [];
        traceback[i] = [];
        for (var j = 0; j <= n; j++) {
            score[i][j] = 0;
            traceback[i][j] = 0;
        }
    }
    
    var maxScore = 0;
    var maxI = 0;
    var maxJ = 0;
    
    for (var i = 1; i <= m; i++) {
        for (var j = 1; j <= n; j++) {
            var blosum = getBLOSUMScore(query[i-1], target[j-1]);
            var match = blosum > 0 ? matchScore * (blosum > 2 ? 2 : 1) : blosum;
            var diag = score[i-1][j-1] + match;
            var up = score[i-1][j] + gapPenalty;
            var left = score[i][j-1] + gapPenalty;
            
            score[i][j] = Math.max(0, diag, up, left);
            
            if (score[i][j] > maxScore) {
                maxScore = score[i][j];
                maxI = i;
                maxJ = j;
            }
        }
    }
    
    // Traceback
    var qAln = '';
    var tAln = '';
    var aln = '';
    var i = maxI;
    var j = maxJ;
    var ident = 0;
    var posit = 0;
    var gps = 0;
    
    while (i > 0 && j > 0 && score[i][j] > 0) {
        var blosum = getBLOSUMScore(query[i-1], target[j-1]);
        var match = blosum > 0 ? matchScore * (blosum > 2 ? 2 : 1) : blosum;
        
        if (score[i][j] === score[i-1][j-1] + match) {
            qAln = query[i-1] + qAln;
            tAln = target[j-1] + tAln;
            if (query[i-1] === target[j-1]) { aln = '|' + aln; ident++; posit++; }
            else if (blosum > 0) { aln = '.' + aln; posit++; }
            else { aln = ' ' + aln; }
            i--; j--;
        } else if (score[i][j] === score[i-1][j] + gapPenalty) {
            qAln = query[i-1] + qAln;
            tAln = '-' + tAln;
            aln = ' ' + aln;
            gps++; i--;
        } else {
            qAln = '-' + qAln;
            tAln = target[j-1] + tAln;
            aln = ' ' + aln;
            gps++; j--;
        }
    }
    
    var alnLen = qAln.length;
    var queryCoverage = query.length > 0 ? (alnLen / query.length * 100) : 0;
    
    return {
        queryAligned: qAln,
        targetAligned: tAln,
        alignment: aln,
        score: maxScore,
        identities: ident,
        positives: posit,
        gaps: gps,
        length: alnLen,
        identityPercent: alnLen > 0 ? (ident / alnLen * 100) : 0,
        positivePercent: alnLen > 0 ? (posit / alnLen * 100) : 0,
        queryCoverage: queryCoverage,
        combinedScore: maxScore * (queryCoverage / 100),
        queryStart: i,
        queryEnd: maxI,
        targetStart: j,
        targetEnd: maxJ,
        fullTarget: target
    };
}gnment,
        score: maxScore,
        identities: identities,
        positives: positives,
        gaps: gaps,
        length: alnLen,
        identityPercent: alnLen > 0 ? (identities / alnLen * 100) : 0,
        positivePercent: alnLen > 0 ? (positives / alnLen * 100) : 0,
        queryStart: i,
        queryEnd: maxI,
        targetStart: j,
        targetEnd: maxJ,
        fullTarget: target
    };
}

function formatAlignmentLine(text, label) {
    var chunks = [];
    for (var i = 0; i < text.length; i += 60) {
        var chunk = text.substring(i, i + 60);
        var prefix = (i === 0 ? label : ' '.repeat(label.length));
        chunks.push(prefix + chunk);
    }
    return chunks.join('\n');
}

function highlightAlignment(line, type) {
    var result = '';
    for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (type === 'query') {
            result += '<span class="aa-q">' + c + '</span>';
        } else if (type === 'target') {
            result += '<span class="aa-t">' + c + '</span>';
        } else if (type === 'align') {
            if (c === '|') result += '<span class="match">|</span>';
            else if (c === '.') result += '<span class="similar">.</span>';
            else result += '<span class="gap"> </span>';
        }
    }
    return result;
}

function runAlignment() {
    if (!peptidesLoaded) {
        alert('Database loading, please wait.');
        return;
    }
    
    var rawQuery = document.getElementById('querySequence').value;
    var query = sanitizeSequence(rawQuery);
    var minIdentity = parseFloat(document.getElementById('minIdentity').value) || 30;
    var maxResults = parseInt(document.getElementById('maxResults').value) || 20;
    var gapPenalty = parseInt(document.getElementById('gapPenalty').value) || -2;
    var matchScore = parseInt(document.getElementById('matchScore').value) || 1;
    
    if (!query || query.length < 3) {
        alert('Enter at least 3 amino acids.');
        return;
    }
    
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('alignResults').innerHTML = '<div class="loading-spinner"><div class="spinner"></div>Aligning ' + query.length + ' aa against ' + peptidesData.length + ' peptides...</div>';
    
    setTimeout(function() {
        var results = [];
        
        for (var i = 0; i < peptidesData.length; i++) {
            var p = peptidesData[i];
            var cleanSeq = p['sequence_1_clean'] || p['sequence_1'] || '';
            var target = sanitizeSequence(cleanSeq);
            
            if (!target || target.length < 2) continue;
            
            var aln = smithWaterman(query, target, matchScore, gapPenalty);
            
            // Фильтруем: минимум 30% идентичности И покрытие query > 40% ИЛИ покрытие > 60%
            var minCov = query.length <= 10 ? 40 : 30;
            if (aln.identityPercent >= minIdentity && aln.queryCoverage >= minCov && aln.length >= 3) {
                aln.peptide = p;
                aln.peptideId = p['peptide_id'];
                aln.peptideName = p['trivial_name'] || 'Peptide ' + p['peptide_id'];
                results.push(aln);
            }
        }
        
        // Сортируем по комбинированному score (score * coverage)
        results.sort(function(a, b) {
            var scoreA = a.score * (a.queryCoverage / 100) * (a.identityPercent / 100);
            var scoreB = b.score * (b.queryCoverage / 100) * (b.identityPercent / 100);
            return scoreB - scoreA;
        });
        
        results = results.slice(0, maxResults);
        displayResults(results, query);
    }, 50);
}

function displayResults(results, query) {
    var container = document.getElementById('alignResults');
    
    if (!results.length) {
        container.innerHTML = '<div class="no-results"><p>No significant matches found.</p><p style="font-size:0.8rem;">Try lowering the minimum identity (currently filtering by coverage and identity).</p></div>';
        document.getElementById('resultsCount').textContent = 'No results for ' + query.length + ' aa query';
        return;
    }
    
    document.getElementById('resultsCount').textContent = 'Found ' + results.length + ' match(es) | Query: ' + query.length + ' aa';
    
    var html = '';
    
    for (var i = 0; i < results.length; i++) {
        var aln = results[i];
        var name = aln.peptideName;
        var pid = aln.peptideId;
        
        var sc = aln.identityPercent >= 80 ? 'score-high' : (aln.identityPercent >= 50 ? 'score-medium' : 'score-low');
        var covClass = aln.queryCoverage >= 80 ? 'score-high' : (aln.queryCoverage >= 50 ? 'score-medium' : 'score-low');
        
        html += '<div class="alignment-card">';
        html += '<div class="alignment-header">';
        html += '<h4><a href="peptide.html?id=' + pid + '&name=' + encodeURIComponent(name) + '" target="_blank">' + name + '</a></h4>';
        html += '<div>';
        html += '<span class="score-badge ' + sc + '">' + aln.identityPercent.toFixed(1) + '% identity</span>';
        html += '<span class="score-badge ' + covClass + '" style="margin-left:0.3rem;">' + aln.queryCoverage.toFixed(0) + '% coverage</span>';
        html += '</div></div>';
        
        html += '<div class="stats-row">';
        html += '<span><strong>Score:</strong> ' + aln.score + '</span>';
        html += '<span><strong>Identities:</strong> ' + aln.identities + '/' + aln.length + '</span>';
        html += '<span><strong>Positives:</strong> ' + aln.positives + '/' + aln.length + '</span>';
        html += '<span><strong>Gaps:</strong> ' + aln.gaps + '</span>';
        html += '<span><strong>Query coverage:</strong> ' + aln.queryCoverage.toFixed(0) + '%</span>';
        html += '</div>';
        
        // Full sequence
        html += '<div style="margin-bottom:0.5rem;font-size:0.75rem;color:#718096;">';
        html += '<strong>Target:</strong> <span style="font-family:monospace;word-break:break-all;">' + aln.fullTarget + '</span>';
        html += '</div>';
        
        // Консенсус
        for (var k = 0; k < aln.length; k += 60) {
            var qChunk = aln.queryAligned.substring(k, k + 60);
            var aChunk = aln.alignment.substring(k, k + 60);
            var tChunk = aln.targetAligned.substring(k, k + 60);
            
            html += '<div style="font-family:\'Courier New\',monospace;font-size:0.75rem;line-height:1.3;background:#f7fafc;padding:0.3rem 0.5rem;overflow-x:auto;">';
            html += '<span style="color:#2c5282;">Query</span> ' + qChunk + '\n';
            html += '<span style="color:#718096;">      </span> ' + aChunk.replace(/\|/g, '<span style="color:#276749;">|</span>').replace(/\./g, '<span style="color:#d69e2e;">.</span>') + '\n';
            html += '<span style="color:#c05621;">Sbjct</span> ' + tChunk;
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    container.innerHTML = html;
}


function clearAll() {
    document.getElementById('querySequence').value = '';
    document.getElementById('resultsSection').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('alignBtn').disabled = true;
    if (typeof XLSX !== 'undefined') loadExcelFile();
    
    document.getElementById('querySequence').addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') runAlignment();
    });
});
