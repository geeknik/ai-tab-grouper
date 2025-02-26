/**
 * Mathematical utilities for document analysis algorithms
 */

/**
 * Calculates cosine similarity between two vectors
 * @param {Object.<string, number>} vector1 - First vector
 * @param {Object.<string, number>} vector2 - Second vector
 * @returns {number} Cosine similarity score between 0 and 1
 */
export function cosineSimilarity(vector1, vector2) {
    const terms = new Set([...Object.keys(vector1), ...Object.keys(vector2)]);
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const term of terms) {
        const val1 = vector1[term] || 0;
        const val2 = vector2[term] || 0;
        dotProduct += val1 * val2;
        magnitude1 += val1 * val1;
        magnitude2 += val2 * val2;
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
        return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculates Jaccard similarity between two sets
 * @param {Set<any>} set1 - First set
 * @param {Set<any>} set2 - Second set
 * @returns {number} Jaccard similarity score between 0 and 1
 */
export function jaccardSimilarity(set1, set2) {
    if (!(set1 instanceof Set) || !(set2 instanceof Set)) {
        throw new Error('Inputs must be Set objects');
    }

    if (set1.size === 0 && set2.size === 0) {
        return 1;
    }

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
}

/**
 * Performs Singular Value Decomposition (SVD) on a matrix
 * Enhanced version with better numerical stability and memory optimization
 * @param {number[][]} matrix - Input matrix
 * @param {number} k - Number of dimensions to keep (optional)
 * @returns {Object} Object containing U, S, and V matrices
 */
export function svd(matrix, k = undefined) {
    if (!matrix || matrix.length === 0 || matrix[0].length === 0) {
        throw new Error('Invalid matrix dimensions');
    }

    const m = matrix.length;
    const n = matrix[0].length;
    
    // If k is not provided, use the minimum dimension
    if (k === undefined) {
        k = Math.min(m, n);
    } else {
        k = Math.min(k, Math.min(m, n));
    }

    if (k === 0) {
        return {
            u: Array(m).fill().map(() => []),
            s: [],
            v: Array(n).fill().map(() => [])
        };
    }

    // Initialize matrices
    const u = Array(m).fill().map(() => Array(k).fill(0));
    const s = Array(k).fill(0);
    const v = Array(n).fill().map(() => Array(k).fill(0));

    // Copy matrix to avoid modifying input
    let workingMatrix = matrix.map(row => [...row]);

    // Constants for numerical stability
    const eps = 2.220446049250313e-16;  // Machine epsilon for double precision
    const tol = eps * Math.max(m, n) * Math.max(...matrix.flat().map(Math.abs));
    const maxIterations = 1000;  // Increased from 100

    for (let i = 0; i < k; i++) {
        // Initialize random vector with better numerical properties
        let q = Array(n).fill().map(() => Math.random() * 2 - 1);
        
        // Normalize with stable computation
        let norm = Math.sqrt(q.reduce((sum, val) => sum + val * val, 0));
        q = q.map(val => val / norm);

        let prevAngle = Infinity;
        let converged = false;
        let iterCount = 0;

        while (!converged && iterCount < maxIterations) {
            iterCount++;
            const prevQ = [...q];
            
            // Power iteration with numerical stability checks
            // Multiply matrix * q
            let temp = Array(m).fill(0);
            for (let row = 0; row < m; row++) {
                for (let col = 0; col < n; col++) {
                    const val = workingMatrix[row][col] * q[col];
                    if (Math.abs(val) > tol) {
                        temp[row] += val;
                    }
                }
            }

            // Multiply matrix^T * (matrix * q)
            q = Array(n).fill(0);
            for (let col = 0; col < n; col++) {
                for (let row = 0; row < m; row++) {
                    const val = workingMatrix[row][col] * temp[row];
                    if (Math.abs(val) > tol) {
                        q[col] += val;
                    }
                }
            }

            // Stable normalization
            norm = Math.sqrt(q.reduce((sum, val) => sum + val * val, 0));
            
            if (norm < tol) {
                // Try a different random vector
                q = Array(n).fill().map(() => Math.random() * 2 - 1);
                norm = Math.sqrt(q.reduce((sum, val) => sum + val * val, 0));
            }
            
            q = q.map(val => val / norm);

            // Check convergence with improved criteria
            const dotProduct = q.reduce((sum, val, idx) => sum + val * prevQ[idx], 0);
            const angle = Math.acos(Math.min(1, Math.abs(dotProduct)));
            
            // Check if angle is decreasing and small enough
            if (angle < tol || (angle < prevAngle && angle < 1e-10)) {
                converged = true;
            }
            prevAngle = angle;
        }

        // Store right singular vector
        for (let j = 0; j < n; j++) {
            v[j][i] = q[j];
        }

        // Calculate singular value and left singular vector
        let uCol = Array(m).fill(0);
        for (let row = 0; row < m; row++) {
            for (let col = 0; col < n; col++) {
                const val = workingMatrix[row][col] * q[col];
                if (Math.abs(val) > tol) {
                    uCol[row] += val;
                }
            }
        }

        // Compute singular value with stable norm calculation
        const singularValue = Math.sqrt(uCol.reduce((sum, val) => sum + val * val, 0));
        s[i] = singularValue;

        if (singularValue > tol) {
            // Store left singular vector
            for (let row = 0; row < m; row++) {
                u[row][i] = uCol[row] / singularValue;
            }

            // Deflate matrix
            for (let row = 0; row < m; row++) {
                for (let col = 0; col < n; col++) {
                    const deflation = singularValue * u[row][i] * v[col][i];
                    if (Math.abs(deflation) > tol) {
                        workingMatrix[row][col] -= deflation;
                    }
                }
            }
        } else {
            // Handle numerically zero singular value
            for (let row = 0; row < m; row++) {
                u[row][i] = row === i ? 1 : 0;
            }
        }
    }

    // Clean up very small values that might be numerical noise
    for (let i = 0; i < k; i++) {
        if (s[i] < tol) {
            s[i] = 0;
            for (let row = 0; row < m; row++) u[row][i] = 0;
            for (let col = 0; col < n; col++) v[col][i] = 0;
        }
    }

    return { u, s, v };
}

/**
 * Calculates Euclidean distance between two vectors
 * @param {Object.<string, number>} vector1 - First vector
 * @param {Object.<string, number>} vector2 - Second vector
 * @returns {number} Euclidean distance
 */
export function euclideanDistance(vector1, vector2) {
    const terms = new Set([...Object.keys(vector1), ...Object.keys(vector2)]);
    let sumSquares = 0;

    for (const term of terms) {
        const val1 = vector1[term] || 0;
        const val2 = vector2[term] || 0;
        const diff = val1 - val2;
        sumSquares += diff * diff;
    }

    return Math.sqrt(sumSquares);
}

/**
 * Performs matrix multiplication
 * @param {number[][]} matrix1 - First matrix
 * @param {number[][]} matrix2 - Second matrix
 * @returns {number[][]} Result matrix
 */
export function matrixMultiply(matrix1, matrix2) {
    if (!matrix1 || !matrix2 || matrix1[0].length !== matrix2.length) {
        throw new Error('Invalid matrix dimensions for multiplication');
    }

    const m = matrix1.length;
    const n = matrix2[0].length;
    const p = matrix2.length;

    const result = Array(m).fill().map(() => Array(n).fill(0));

    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            for (let k = 0; k < p; k++) {
                result[i][j] += matrix1[i][k] * matrix2[k][j];
            }
        }
    }

    return result;
} 