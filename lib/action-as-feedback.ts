/**
 * Action-as-Feedback (AaF) Pipeline
 *
 * Detects user's manual edits on the draw.io canvas, classifies them,
 * translates to natural language, and builds context for the agent.
 *
 * 4-stage pipeline:
 *   Stage 1: Cell-level XML diff detection
 *   Stage 2: Change classification + generalization potential scoring
 *   Stage 3: Deterministic NL translation (zero LLM calls)
 *   Stage 4: Context assembly for agent injection
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChangeCategory =
    | "style"
    | "grouping"
    | "structural"
    | "position"
    | "content"

export type GeneralizationPotential = "HIGH" | "MEDIUM" | "LOW"

interface CellInfo {
    id: string
    value: string
    style: string
    parent: string
    vertex: boolean
    edge: boolean
    source: string
    target: string
    x: number
    y: number
    width: number
    height: number
}

interface CellDiff {
    cellId: string
    cellLabel: string
    diffType: "added" | "removed" | "modified"
    changes: FieldChange[]
}

interface FieldChange {
    field: string
    oldValue: string
    newValue: string
}

interface ClassifiedChange {
    cellId: string
    cellLabel: string
    diffType: "added" | "removed" | "modified"
    category: ChangeCategory
    potential: GeneralizationPotential
    changes: FieldChange[]
}

// ─── Stage 1: Cell-Level XML Diff Detection ──────────────────────────────────

function parseCells(xml: string): Map<string, CellInfo> {
    const cells = new Map<string, CellInfo>()
    if (!xml) return cells

    // Match all mxCell elements (self-closing or with children)
    const cellBlocks =
        xml.match(/<mxCell\s[^>]*?(?:\/>|>[\s\S]*?<\/mxCell>)/gi) || []

    for (const block of cellBlocks) {
        const attr = (name: string) => {
            const m = block.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))
            return m ? m[1] : ""
        }
        const id = attr("id")
        if (!id || id === "0" || id === "1") continue

        // Extract geometry
        const geoMatch = block.match(
            /<mxGeometry[^>]*?\bx="([^"]*)"[^>]*?\by="([^"]*)"[^>]*?\bwidth="([^"]*)"[^>]*?\bheight="([^"]*)"[^>]*?\/?>/i,
        )
        // More flexible geometry parsing
        const gx = block.match(/<mxGeometry[^>]*?\bx="([^"]*)"/)
        const gy = block.match(/<mxGeometry[^>]*?\by="([^"]*)"/)
        const gw = block.match(/<mxGeometry[^>]*?\bwidth="([^"]*)"/)
        const gh = block.match(/<mxGeometry[^>]*?\bheight="([^"]*)"/)

        cells.set(id, {
            id,
            value: attr("value"),
            style: attr("style"),
            parent: attr("parent") || "1",
            vertex: attr("vertex") === "1",
            edge: attr("edge") === "1",
            source: attr("source"),
            target: attr("target"),
            x: parseFloat(gx?.[1] || "0"),
            y: parseFloat(gy?.[1] || "0"),
            width: parseFloat(gw?.[1] || "0"),
            height: parseFloat(gh?.[1] || "0"),
        })
    }

    return cells
}

function diffCells(previousXml: string, currentXml: string): CellDiff[] {
    const prevCells = parseCells(previousXml)
    const currCells = parseCells(currentXml)
    const diffs: CellDiff[] = []

    // Check for added cells (in current but not previous)
    for (const [id, curr] of currCells) {
        if (!prevCells.has(id)) {
            diffs.push({
                cellId: id,
                cellLabel: curr.value || `[${id}]`,
                diffType: "added",
                changes: [],
            })
        }
    }

    // Check for removed cells (in previous but not current)
    for (const [id, prev] of prevCells) {
        if (!currCells.has(id)) {
            diffs.push({
                cellId: id,
                cellLabel: prev.value || `[${id}]`,
                diffType: "removed",
                changes: [],
            })
        }
    }

    // Check for modified cells
    for (const [id, curr] of currCells) {
        const prev = prevCells.get(id)
        if (!prev) continue

        const changes: FieldChange[] = []
        if (prev.value !== curr.value) {
            changes.push({
                field: "value",
                oldValue: prev.value,
                newValue: curr.value,
            })
        }
        if (prev.style !== curr.style) {
            changes.push({
                field: "style",
                oldValue: prev.style,
                newValue: curr.style,
            })
        }
        if (prev.parent !== curr.parent) {
            changes.push({
                field: "parent",
                oldValue: prev.parent,
                newValue: curr.parent,
            })
        }
        if (prev.source !== curr.source) {
            changes.push({
                field: "source",
                oldValue: prev.source,
                newValue: curr.source,
            })
        }
        if (prev.target !== curr.target) {
            changes.push({
                field: "target",
                oldValue: prev.target,
                newValue: curr.target,
            })
        }
        const posThreshold = 2 // ignore sub-pixel movements
        if (
            Math.abs(prev.x - curr.x) > posThreshold ||
            Math.abs(prev.y - curr.y) > posThreshold ||
            Math.abs(prev.width - curr.width) > posThreshold ||
            Math.abs(prev.height - curr.height) > posThreshold
        ) {
            changes.push({
                field: "geometry",
                oldValue: `(${prev.x},${prev.y}) ${prev.width}×${prev.height}`,
                newValue: `(${curr.x},${curr.y}) ${curr.width}×${curr.height}`,
            })
        }

        if (changes.length > 0) {
            diffs.push({
                cellId: id,
                cellLabel: curr.value || prev.value || `[${id}]`,
                diffType: "modified",
                changes,
            })
        }
    }

    return diffs
}

// ─── Stage 2: Change Classification ──────────────────────────────────────────

// Style properties that indicate a style change
const STYLE_PROPS = new Set([
    "fillColor",
    "strokeColor",
    "fontColor",
    "fontSize",
    "fontStyle",
    "fontFamily",
    "rounded",
    "shadow",
    "opacity",
    "gradientColor",
    "strokeWidth",
    "dashed",
    "dashPattern",
])

function parseStyleMap(style: string): Map<string, string> {
    const map = new Map<string, string>()
    if (!style) return map
    for (const pair of style.split(";")) {
        const eq = pair.indexOf("=")
        if (eq > 0) {
            map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
        } else if (pair.trim()) {
            map.set(pair.trim(), "1") // flags like "rounded" or "ellipse"
        }
    }
    return map
}

function getStyleDiffs(
    oldStyle: string,
    newStyle: string,
): { property: string; oldVal: string; newVal: string }[] {
    const oldMap = parseStyleMap(oldStyle)
    const newMap = parseStyleMap(newStyle)
    const diffs: { property: string; oldVal: string; newVal: string }[] = []

    // Check changed and added props
    for (const [key, val] of newMap) {
        const oldVal = oldMap.get(key) || ""
        if (oldVal !== val) {
            diffs.push({ property: key, oldVal, newVal: val })
        }
    }
    // Check removed props
    for (const [key, val] of oldMap) {
        if (!newMap.has(key)) {
            diffs.push({ property: key, oldVal: val, newVal: "" })
        }
    }
    return diffs
}

function classifyDiff(diff: CellDiff): ClassifiedChange {
    // Added/removed cells are structural
    if (diff.diffType === "added" || diff.diffType === "removed") {
        return {
            ...diff,
            category: "structural",
            potential: "MEDIUM",
        }
    }

    // Modified cell — classify by what changed
    const changedFields = new Set(diff.changes.map((c) => c.field))

    // Parent change → grouping
    if (changedFields.has("parent")) {
        return { ...diff, category: "grouping", potential: "HIGH" }
    }

    // Style change → check if visual style properties changed
    if (changedFields.has("style")) {
        const styleChange = diff.changes.find((c) => c.field === "style")!
        const styleDiffs = getStyleDiffs(
            styleChange.oldValue,
            styleChange.newValue,
        )
        const hasStyleProp = styleDiffs.some((d) => STYLE_PROPS.has(d.property))
        if (hasStyleProp) {
            return { ...diff, category: "style", potential: "HIGH" }
        }
    }

    // Source/target change → structural
    if (changedFields.has("source") || changedFields.has("target")) {
        return { ...diff, category: "structural", potential: "MEDIUM" }
    }

    // Geometry change → position
    if (changedFields.has("geometry")) {
        return { ...diff, category: "position", potential: "MEDIUM" }
    }

    // Value change → content
    if (changedFields.has("value")) {
        return { ...diff, category: "content", potential: "LOW" }
    }

    // Fallback
    return { ...diff, category: "content", potential: "LOW" }
}

// ─── Stage 3: NL Template Translation ────────────────────────────────────────

function describeStyleDiff(
    diffs: { property: string; oldVal: string; newVal: string }[],
): string {
    const descriptions: string[] = []
    for (const d of diffs) {
        if (!STYLE_PROPS.has(d.property)) continue
        if (d.property === "fillColor") {
            descriptions.push(`fill color ${d.oldVal || "none"} → ${d.newVal}`)
        } else if (d.property === "strokeColor") {
            descriptions.push(
                `stroke color ${d.oldVal || "none"} → ${d.newVal}`,
            )
        } else if (d.property === "fontColor") {
            descriptions.push(
                `font color ${d.oldVal || "default"} → ${d.newVal}`,
            )
        } else if (d.property === "fontSize") {
            descriptions.push(`font size ${d.oldVal} → ${d.newVal}`)
        } else if (d.property === "rounded") {
            descriptions.push(
                d.newVal === "1" ? "corners → rounded" : "corners → sharp",
            )
        } else if (d.property === "shadow") {
            descriptions.push(
                d.newVal === "1" ? "added shadow" : "removed shadow",
            )
        } else {
            descriptions.push(
                `${d.property}: ${d.oldVal || "none"} → ${d.newVal || "removed"}`,
            )
        }
    }
    return descriptions.join(", ")
}

function describeChange(change: ClassifiedChange): string {
    const label = change.cellLabel
        .replace(/<[^>]+>/g, "")
        .replace(/&[^;]+;/g, "")
        .trim()
    const name = label || `cell ${change.cellId}`

    if (change.diffType === "added") {
        return `Added new element "${name}".`
    }
    if (change.diffType === "removed") {
        return `Removed element "${name}".`
    }

    // Modified
    switch (change.category) {
        case "style": {
            const styleChange = change.changes.find((c) => c.field === "style")
            if (styleChange) {
                const details = describeStyleDiff(
                    getStyleDiffs(styleChange.oldValue, styleChange.newValue),
                )
                return `Changed style of "${name}": ${details}.`
            }
            return `Changed style of "${name}".`
        }
        case "grouping": {
            const parentChange = change.changes.find(
                (c) => c.field === "parent",
            )
            return `Moved "${name}" ${parentChange ? `from container ${parentChange.oldValue} to ${parentChange.newValue}` : "to a different container"}.`
        }
        case "structural": {
            const srcChange = change.changes.find((c) => c.field === "source")
            const tgtChange = change.changes.find((c) => c.field === "target")
            if (srcChange || tgtChange) {
                return `Changed connection of "${name}".`
            }
            return `Modified structure of "${name}".`
        }
        case "position": {
            const geoChange = change.changes.find((c) => c.field === "geometry")
            return `Repositioned "${name}" ${geoChange ? `to ${geoChange.newValue}` : ""}.`
        }
        case "content": {
            const valChange = change.changes.find((c) => c.field === "value")
            if (valChange) {
                const oldLabel =
                    valChange.oldValue.replace(/<[^>]+>/g, "").trim() ||
                    "(empty)"
                const newLabel =
                    valChange.newValue.replace(/<[^>]+>/g, "").trim() ||
                    "(empty)"
                return `Renamed "${oldLabel}" to "${newLabel}".`
            }
            return `Changed content of "${name}".`
        }
    }
}

// ─── Stage 4: Build AaF Context for Agent Injection ──────────────────────────

export function buildAafContext(
    previousXml: string,
    currentXml: string,
): string | null {
    // Quick check: if XMLs are identical, no user edits
    if (!previousXml || !currentXml) return null
    if (previousXml === currentXml) return null

    // Stage 1: Diff
    const diffs = diffCells(previousXml, currentXml)
    if (diffs.length === 0) return null

    // Filter out trivial diffs (position-only changes of < 5px are likely auto-layout)
    const meaningfulDiffs = diffs.filter((d) => {
        if (d.diffType !== "modified") return true
        if (d.changes.length === 1 && d.changes[0].field === "geometry") {
            // Parse positions and check if movement is significant
            const oldGeo = d.changes[0].oldValue.match(/\(([^,]+),([^)]+)\)/)
            const newGeo = d.changes[0].newValue.match(/\(([^,]+),([^)]+)\)/)
            if (oldGeo && newGeo) {
                const dx = Math.abs(
                    parseFloat(newGeo[1]) - parseFloat(oldGeo[1]),
                )
                const dy = Math.abs(
                    parseFloat(newGeo[2]) - parseFloat(oldGeo[2]),
                )
                return dx > 5 || dy > 5 // ignore tiny movements
            }
        }
        return true
    })

    if (meaningfulDiffs.length === 0) return null

    // Stage 2: Classify
    const classified = meaningfulDiffs.map(classifyDiff)

    // Stage 3: Translate to NL
    const descriptions = classified.map(describeChange)

    // Stage 4: Build context with potential-based grouping
    const highPotential = classified.filter((c) => c.potential === "HIGH")
    const hasHighPotential = highPotential.length > 0

    let context = "## User's Manual Edits\n"
    context += "The user made the following manual changes to the diagram:\n"
    for (const desc of descriptions) {
        context += `- ${desc}\n`
    }

    if (hasHighPotential) {
        const styleChanges = highPotential.filter((c) => c.category === "style")
        const groupChanges = highPotential.filter(
            (c) => c.category === "grouping",
        )

        context += "\n"
        if (styleChanges.length > 0) {
            context +=
                "The style changes above have HIGH generalization potential. Consider offering to apply the same styling to similar elements in the diagram.\n"
        }
        if (groupChanges.length > 0) {
            context +=
                "The grouping changes above have HIGH generalization potential. Consider offering to reorganize similar elements.\n"
        }
    }

    return context
}
