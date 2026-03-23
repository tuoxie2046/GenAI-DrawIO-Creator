/**
 * Semantic Verification (Informed Reflection)
 *
 * After the first display_diagram call, programmatically compare generated
 * vertex labels against expected components from the user's request.
 * Uses directional string matching with greedy 1-to-1 claiming.
 *
 * Ported from UIST_2026_Paper/experiments/drawio_xml.py
 */

// ─── String Similarity (LCS-based, mirrors Python's SequenceMatcher.ratio()) ──

function lcsLength(a: string, b: string): number {
    const m = a.length
    const n = b.length
    // Use two rows instead of full matrix for memory efficiency
    let prev = new Array(n + 1).fill(0)
    let curr = new Array(n + 1).fill(0)
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                curr[j] = prev[j - 1] + 1
            } else {
                curr[j] = Math.max(prev[j], curr[j - 1])
            }
        }
        ;[prev, curr] = [curr, prev]
        curr.fill(0)
    }
    return prev[n]
}

function sequenceMatcherRatio(a: string, b: string): number {
    if (a.length === 0 && b.length === 0) return 1.0
    if (a.length === 0 || b.length === 0) return 0.0
    return (2 * lcsLength(a, b)) / (a.length + b.length)
}

// ─── HTML Stripping (mirrors evaluator.py:strip_html_for_matching) ───────────

export function stripHtmlForMatching(label: string): string {
    if (!label) return ""
    // Handle <hr> in ER-style labels: take the title part before <hr>
    if (/<hr/i.test(label)) {
        const parts = label.split(/<hr[^>]*>/i)
        if (parts.length > 0 && parts[0].trim()) {
            label = parts[0]
        }
    }
    // Strip all HTML tags
    label = label.replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    label = label
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
    // Collapse whitespace
    return label.replace(/\s+/g, " ").trim()
}

// ─── Directional Match (mirrors drawio_xml.py:directional_match) ─────────────

export function directionalMatch(expected: string, candidate: string): number {
    const expLower = expected.toLowerCase().trim()
    const candLower = candidate.toLowerCase().trim()

    const expClean = expLower.replace(/[^a-z0-9]/g, "")
    const candClean = candLower.replace(/[^a-z0-9]/g, "")
    if (!expClean || !candClean) return 0.0

    // Base: LCS-based ratio (equivalent to SequenceMatcher)
    let baseScore = sequenceMatcherRatio(expClean, candClean)

    const expWords = new Set(expLower.match(/[a-z0-9]+/g) || [])
    const candWords = new Set(candLower.match(/[a-z0-9]+/g) || [])

    if (expWords.size > 0 && candWords.size > 0) {
        // Check 1: forward containment — all expected words appear in candidate
        const allExpInCand = [...expWords].every((w) => candWords.has(w))
        if (allExpInCand) return Math.max(baseScore, 0.85)

        // Check 2: reverse containment — all candidate words appear in expected (min 2 words)
        const allCandInExp = [...candWords].every((w) => expWords.has(w))
        if (candWords.size >= 2 && allCandInExp) return Math.max(baseScore, 0.8)

        // Check 3: substring containment
        if (expClean.length >= 3 && candClean.includes(expClean))
            return Math.max(baseScore, 0.8)

        // Check 4: significant word overlap (words >= 3 chars)
        const sigExp = new Set([...expWords].filter((w) => w.length >= 3))
        const sigCand = new Set([...candWords].filter((w) => w.length >= 3))
        if (sigExp.size > 0 && sigCand.size > 0) {
            const shared = new Set([...sigExp].filter((w) => sigCand.has(w)))
            const shorterSig = Math.min(sigExp.size, sigCand.size)
            if (
                shared.size > 0 &&
                shorterSig >= 2 &&
                shared.size / shorterSig >= 0.5
            ) {
                const overlapScore =
                    0.65 +
                    0.15 * (shared.size / Math.max(sigExp.size, sigCand.size))
                return Math.max(baseScore, Math.min(overlapScore, 0.85))
            }
        }

        // Check 5: acronym expansion
        const uncoveredExp = [...expWords].filter((w) => !candWords.has(w))
        if (uncoveredExp.length > 0) {
            const candWordList = candLower.match(/[a-z0-9]+/g) || []
            let allResolved = true
            for (const uw of uncoveredExp) {
                if (uw.length <= 4) {
                    let resolved = false
                    for (let i = 0; i < candWordList.length && !resolved; i++) {
                        for (
                            let j = i + 2;
                            j <=
                            Math.min(i + uw.length + 1, candWordList.length);
                            j++
                        ) {
                            const initials = candWordList
                                .slice(i, j)
                                .map((w) => w[0])
                                .join("")
                            if (initials === uw) {
                                resolved = true
                                break
                            }
                        }
                    }
                    if (!resolved) {
                        allResolved = false
                        break
                    }
                } else {
                    allResolved = false
                    break
                }
            }
            if (allResolved) return Math.max(baseScore, 0.8)
        }

        // No structural check passed — apply word coverage penalty
        const covered = [...expWords].filter((w) => candWords.has(w)).length
        const coverage = covered / expWords.size
        if (coverage < 1.0) {
            baseScore *= 0.5 + 0.5 * coverage
        }
    }

    return baseScore
}

// ─── Extract Vertex Labels from draw.io XML ──────────────────────────────────

export function extractVertexLabels(xml: string): string[] {
    if (!xml) return []
    const labels: string[] = []

    // Parse mxCell elements with vertex="1" — use regex for server/client compat
    const cellRegex =
        /<mxCell\s[^>]*?id="([^"]*)"[^>]*?value="([^"]*)"[^>]*?vertex="1"[^>]*?\/?>/gi
    const cellRegex2 =
        /<mxCell\s[^>]*?vertex="1"[^>]*?id="([^"]*)"[^>]*?value="([^"]*)"[^>]*?\/?>/gi
    // Generic approach: find all mxCell with vertex="1" and extract id + value
    const allCells = xml.match(/<mxCell\s[^>]*?vertex="1"[^>]*?\/?>/gi) || []

    for (const cell of allCells) {
        const idMatch = cell.match(/\bid="([^"]*)"/)
        const valueMatch = cell.match(/\bvalue="([^"]*)"/)
        const id = idMatch?.[1] || ""
        const value = valueMatch?.[1] || ""

        // Skip root cells and empty labels
        if (id === "0" || id === "1") continue
        const cleaned = stripHtmlForMatching(value)
        if (cleaned) labels.push(cleaned)
    }

    return labels
}

// ─── Extract Expected Components from User Message ───────────────────────────

export function extractExpectedComponents(userMessage: string): string[] {
    if (!userMessage) return []
    const components: string[] = []

    // Strategy 1: Look for explicit comma/and-separated lists after keywords
    // e.g., "with an API gateway, four services, a database, and a message queue"
    const listPatterns = [
        /(?:with|including|containing|showing|consists?\s+of|has|have)\s+(.+?)(?:\.|$)/gi,
        /(?:components?|elements?|nodes?|services?|parts?)\s*(?::|are)\s*(.+?)(?:\.|$)/gi,
    ]

    for (const pattern of listPatterns) {
        let match
        while ((match = pattern.exec(userMessage)) !== null) {
            const listText = match[1]
            // Split by commas and "and"
            const items = listText
                .split(/,\s*(?:and\s+)?|\s+and\s+/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0 && s.length < 80)

            for (const item of items) {
                // Clean up: remove articles, numbers like "four", "a", "an"
                const cleaned = item
                    .replace(
                        /^(?:a|an|the|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+/i,
                        "",
                    )
                    .trim()
                if (cleaned.length >= 2) components.push(cleaned)
            }
        }
    }

    // Strategy 2: Look for bullet-point or numbered lists
    const bulletItems = userMessage.match(
        /(?:^|\n)\s*(?:[-•*]|\d+[.)]\s)\s*(.+)/gm,
    )
    if (bulletItems) {
        for (const item of bulletItems) {
            const cleaned = item
                .replace(/^\s*(?:[-•*]|\d+[.)]\s)\s*/, "")
                .trim()
            if (cleaned.length >= 2 && cleaned.length < 80) {
                components.push(cleaned)
            }
        }
    }

    // Strategy 3: Look for quoted terms
    const quotedTerms = userMessage.match(/["'`]([^"'`]{2,40})["'`]/g)
    if (quotedTerms) {
        for (const qt of quotedTerms) {
            const inner = qt.slice(1, -1).trim()
            if (inner.length >= 2) components.push(inner)
        }
    }

    // Deduplicate (case-insensitive)
    const seen = new Set<string>()
    return components.filter((c) => {
        const key = c.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

// ─── Find Missing Components (greedy 1-to-1 claiming) ───────────────────────

export function findMissingComponents(
    expectedComponents: string[],
    generatedXml: string,
    threshold = 0.6,
): string[] {
    if (expectedComponents.length === 0) return []
    const generatedLabels = extractVertexLabels(generatedXml)
    if (generatedLabels.length === 0) return expectedComponents

    // Build all (expected, generated) pairs with scores
    const pairs: { expected: string; generated: string; score: number }[] = []
    for (const exp of expectedComponents) {
        for (const gen of generatedLabels) {
            const score = directionalMatch(exp, gen)
            if (score >= threshold) {
                pairs.push({ expected: exp, generated: gen, score })
            }
        }
    }

    // Sort by score descending (greedy claiming)
    pairs.sort((a, b) => b.score - a.score)

    // Greedy 1-to-1 claiming
    const claimedExpected = new Set<string>()
    const claimedGenerated = new Set<string>()

    for (const pair of pairs) {
        if (
            !claimedExpected.has(pair.expected) &&
            !claimedGenerated.has(pair.generated)
        ) {
            claimedExpected.add(pair.expected)
            claimedGenerated.add(pair.generated)
        }
    }

    // Return unclaimed expected components
    return expectedComponents.filter((e) => !claimedExpected.has(e))
}

// ─── Build Verification Feedback ─────────────────────────────────────────────

export function buildVerificationFeedback(
    userMessage: string,
    generatedXml: string,
): string | null {
    const expected = extractExpectedComponents(userMessage)
    // Only run if we found a structured list of components (>= 3 items)
    if (expected.length < 3) return null

    const missing = findMissingComponents(expected, generatedXml)
    if (missing.length === 0) return null

    return `Missing required components: ${missing.join(", ")}. Please add them using edit_diagram.`
}
