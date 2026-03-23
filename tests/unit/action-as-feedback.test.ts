import { describe, expect, it } from "vitest"
import { buildAafContext } from "@/lib/action-as-feedback"

const baseXml = `
<mxCell id="2" value="Service A" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="1">
  <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
</mxCell>
<mxCell id="3" value="Service B" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="1">
  <mxGeometry x="300" y="100" width="120" height="60" as="geometry"/>
</mxCell>
<mxCell id="4" value="Database" style="shape=cylinder;fillColor=#f5f5f5;" vertex="1" parent="1">
  <mxGeometry x="200" y="250" width="120" height="80" as="geometry"/>
</mxCell>
<mxCell id="5" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="2" target="4" parent="1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>`

describe("buildAafContext", () => {
    it("returns null when XMLs are identical", () => {
        expect(buildAafContext(baseXml, baseXml)).toBeNull()
    })

    it("returns null for empty inputs", () => {
        expect(buildAafContext("", "")).toBeNull()
        expect(buildAafContext("", baseXml)).toBeNull()
        expect(buildAafContext(baseXml, "")).toBeNull()
    })

    it("detects style changes (fillColor)", () => {
        const modified = baseXml.replace(
            'id="2" value="Service A" style="rounded=1;fillColor=#dae8fc;"',
            'id="2" value="Service A" style="rounded=1;fillColor=#4A90D9;"',
        )
        const result = buildAafContext(baseXml, modified)
        expect(result).not.toBeNull()
        expect(result).toContain("User's Manual Edits")
        expect(result).toContain("Service A")
        expect(result).toContain("fill color")
        expect(result).toContain("HIGH generalization potential")
    })

    it("detects added cells", () => {
        const withNew =
            baseXml +
            '\n<mxCell id="10" value="Redis Cache" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="500" y="100" width="120" height="60" as="geometry"/></mxCell>'
        const result = buildAafContext(baseXml, withNew)
        expect(result).not.toBeNull()
        expect(result).toContain("Added")
        expect(result).toContain("Redis Cache")
    })

    it("detects removed cells", () => {
        // Remove Service B (id="3")
        const without = baseXml.replace(
            /<mxCell id="3"[^>]*>[\s\S]*?<\/mxCell>/,
            "",
        )
        const result = buildAafContext(baseXml, without)
        expect(result).not.toBeNull()
        expect(result).toContain("Removed")
        expect(result).toContain("Service B")
    })

    it("detects position changes", () => {
        const moved = baseXml.replace(
            'id="2" value="Service A" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="1">\n  <mxGeometry x="100" y="100"',
            'id="2" value="Service A" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="1">\n  <mxGeometry x="500" y="300"',
        )
        const result = buildAafContext(baseXml, moved)
        expect(result).not.toBeNull()
        expect(result).toContain("Repositioned")
        expect(result).toContain("Service A")
    })

    it("detects content (label) changes", () => {
        const renamed = baseXml.replace(
            'value="Service A"',
            'value="Auth Service"',
        )
        const result = buildAafContext(baseXml, renamed)
        expect(result).not.toBeNull()
        expect(result).toContain("Renamed")
        expect(result).toContain("Service A")
        expect(result).toContain("Auth Service")
    })

    it("detects parent changes (grouping)", () => {
        const reparented = baseXml.replace(
            'id="2" value="Service A" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="1"',
            'id="2" value="Service A" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="4"',
        )
        const result = buildAafContext(baseXml, reparented)
        expect(result).not.toBeNull()
        expect(result).toContain("Moved")
        expect(result).toContain("Service A")
        expect(result).toContain("HIGH generalization potential")
    })

    it("ignores tiny position changes (< 5px)", () => {
        const tinyMove = baseXml.replace(
            '<mxGeometry x="100" y="100" width="120" height="60"',
            '<mxGeometry x="102" y="101" width="120" height="60"',
        )
        const result = buildAafContext(baseXml, tinyMove)
        expect(result).toBeNull()
    })

    it("handles multiple simultaneous changes", () => {
        let modified = baseXml.replace(
            'id="2" value="Service A" style="rounded=1;fillColor=#dae8fc;"',
            'id="2" value="Auth Service" style="rounded=1;fillColor=#4A90D9;"',
        )
        modified +=
            '\n<mxCell id="10" value="Cache" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="500" y="100" width="120" height="60" as="geometry"/></mxCell>'

        const result = buildAafContext(baseXml, modified)
        expect(result).not.toBeNull()
        // Should contain both style change and addition
        expect(result).toContain("Auth Service")
        expect(result).toContain("Cache")
    })
})
