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
                peptidesData = XLSX.utils.sheet_to_json(sheet);
                peptidesLoaded = true;
                console.log('Loaded', peptidesData.length, 'peptides for alignment');
                document.getElementById('alignBtn').disabled = false;
            }
        })
        .catch(function(error) {
            console.error('Error loading data:', error);
        });
}

// Smith-Waterman local alignment
function smithWaterman(query, target, matchScore, gapPenalty) {
    var m = query.length;
    var n = target.length;
    
    // Score matrix
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
    
    // Fill matrix
    for (var i = 1; i <= m; i++) {
        for (var j = 1; j <= n; j++) {
            var match = getBLOSUMScore(query[i-1], target[j-1]);
            var diag = score[i-1][j-1] + (match > 0 ? matchScore : (match < 0 ? gapPenalty : 0));
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
    var align1 = '';
    var align2 = '';
    var alignment = '';
    var i = maxI;
    var j = maxJ;
    var identities = 0;
    var positives = 0;
    var alignmentLength = 0;
    
    while (i > 0 && j > 0 && score[i][j] > 0) {
        var match = getBLOSUMScore(query[i-1], target[j-1]);
        var diag = score[i-1][j-1] + (match > 0 ? matchScore : (match < 0 ? gapPenalty : 0));
        
        if (score[i][j] === diag) {
            align1 = query[i-1] + align1;
            align2 = target[j-1] + align2;
            
            if (query[i-1] === target[j-1]) {
                alignment = '|' + alignment;
                identities++;
                positives++;
            } else if (match > 0) {
                alignment = '+' + alignment;
                positives++;
            } else {
                alignment = ' ' + alignment;
            }
            
            i--; j--;
            alignmentLength++;
        } else if (score[i][j] === score[i-1][j] + gapPenalty) {
            align1 = query[i-1] + align1;
            align2 = '-' + align2;
            alignment = ' ' + alignment;
            i--;
            alignmentLength++;
        } else {
            align1 = '-' + align1;
            align2 = target[j-1] + align2;
            alignment = ' ' + alignment;
            j--;
            alignmentLength++;
        }
    }
    
    return {
        align1: align1,
        align2: align2,
        alignment: alignment,
        score: maxScore,
        identities: identities,
        positives: positives,
        length: alignmentLength,
        identityPercent: alignmentLength > 0 ? (identities / alignmentLength * 100) : 0,
        queryStart: i,
        targetStart: j
    };
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

function runAlignment() {
    if (!peptidesLoaded) {
        alert('Database is still loading. Please wait.');
        return;
    }
    
    var query = sanitizeSequence(document.getElementById('querySequence').value);
    var minIdentity = parseInt(document.getElementById('minIdentity').value) || 30;
    var maxResults = parseInt(document.getElementById('maxResults').value) || 20;
    var gapPenalty = parseInt(document.getElementById('gapPenalty').value) || -2;
    var matchScore = parseInt(document.getElementById('matchScore').value) || 2;
    
    if (!query || query.length < 3) {
        alert('Please enter a sequence of at least 3 amino acids.');
        return;
    }
    
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('alignResults').innerHTML = '<div class="loading-spinner"><div class="spinner"></div>Running alignment...</div>';
    
    // Run alignment in setTimeout to avoid blocking UI
    setTimeout(function() {
        var results = [];
        
        for (var i = 0; i < peptidesData.length; i++) {
            var p = peptidesData[i];
            var target = p['sequence_1_clean'] || p['sequence_1'] || '';
            target = sanitizeSequence(target);
            
            if (!target || target.length < 3) continue;
            
            var alignment = smithWaterman(query, target, matchScore, gapPenalty);
            
            if (alignment.identityPercent >= minIdentity && alignment.length >= 3) {
                results.push({
                    peptide: p,
                    alignment: alignment
                });
            }
        }
        
        // Sort by identity percent (desc)
        results.sort(function(a, b) {
            return b.alignment.identityPercent - a.alignment.identityPercent;
        });
        
        // Limit results
        results = results.slice(0, maxResults);
        
        displayResults(results, query);
    }, 100);
}

function displayResults(results, query) {
    var container = document.getElementById('alignResults');
    
    if (results.length === 0) {
        container.innerHTML = '<div class="no-results"><p>No matching sequences found with the specified criteria.</p><p style="font-size:0.8rem;">Try lowering the minimum identity threshold.</p></div>';
        document.getElementById('resultsCount').textContent = 'No results';
        return;
    }
    
    document.getElementById('resultsCount').textContent = 'Found ' + results.length + ' matching peptide(s)';
    
    var html = '';
    
    for (var i = 0; i < results.length; i++) {
        var r = results[i];
        var p = r.peptide;
        var aln = r.alignment;
        var name = p['trivial_name'] || 'Peptide ' + p['peptide_id'];
        var peptideId = p['peptide_id'];
        
        var scoreClass = aln.identityPercent >= 80 ? 'score-high' : (aln.identityPercent >= 50 ? 'score-medium' : 'score-low');
        
        html += '<div class="alignment-card">';
        html += '<div class="alignment-header">';
        html += '<h4><a href="peptide.html?id=' + peptideId + '&name=' + encodeURIComponent(name) + '">' + name + '</a></h4>';
        html += '<div>';
        html += '<span class="score-badge ' + scoreClass + '">' + aln.identityPercent.toFixed(1) + '% identity</span>';
        html += '</div></div>';
        
        html += '<div class="stats-row">';
        html += '<span><strong>Score:</strong> ' + aln.score + '</span>';
        html += '<span><strong>Identities:</strong> ' + aln.identities + '/' + aln.length + '</span>';
        html += '<span><strong>Positives:</strong> ' + aln.positives + '/' + aln.length + '</span>';
        html += '<span><strong>Gaps:</strong> ' + (aln.length - aln.identities - (aln.length - aln.positives)) + '</span>';
        html += '<span><strong>Length:</strong> ' + (p['length'] || 'N/A') + ' aa</span>';
        html += '</div>';
        
        // Format alignment
        html += '<div class="alignment-view">';
        html += 'Query  ' + formatAlignmentLine(aln.align1) + '\n';
        html += '      ' + formatAlignmentLine(aln.alignment) + '\n';
        html += 'Sbjct  ' + formatAlignmentLine(aln.align2);
        html += '</div>';
        
        html += '</div>';
    }
    
    container.innerHTML = html;
}

function formatAlignmentLine(line) {
    var result = '';
    for (var i = 0; i < line.length; i++) {
        result += line[i];
        if ((i + 1) % 60 === 0 && i < line.length - 1) {
            result += '\n       ';
        }
    }
    return result;
}

function clearAll() {
    document.getElementById('querySequence').value = '';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('alignResults').innerHTML = '';
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('alignBtn').disabled = true;
    if (typeof XLSX !== 'undefined') {
        loadExcelFile();
    }
    
    // Enter key triggers alignment
    document.getElementById('querySequence').addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            runAlignment();
        }
    });
});