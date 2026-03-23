import { describe, expect, it } from "vitest"
import {
    buildVerificationFeedback,
    directionalMatch,
    extractExpectedComponents,
    extractVertexLabels,
    findMissingComponents,
    stripHtmlForMatching,
} from "@/lib/semantic-verification"

describe("stripHtmlForMatching", () => {
    it("strips simple HTML tags", () => {
        expect(stripHtmlForMatching("<b>Database</b>")).toBe("Database")
    })

    it("handles ER-style labels with <hr>", () => {
        expect(stripHtmlForMatching("Users<hr>id: int<br>name: string")).toBe(
            "Users",
        )
    })

    it("handles empty and null input", () => {
        expect(stripHtmlForMatching("")).toBe("")
        expect(stripHtmlForMatching("  ")).toBe("")
    })

    it("decodes HTML entities", () => {
        expect(stripHtmlForMatching("A &amp; B")).toBe("A & B")
        expect(stripHtmlForMatching("&lt;value&gt;")).toBe("<value>")
    })

    it("collapses whitespace", () => {
        expect(stripHtmlForMatching("  Hello   World  ")).toBe("Hello World")
    })
})

describe("directionalMatch", () => {
    it("returns high score for exact match", () => {
        expect(directionalMatch("Database", "Database")).toBeGreaterThan(0.9)
    })

    it("handles case-insensitive matching", () => {
        expect(directionalMatch("database", "Database")).toBeGreaterThan(0.9)
    })

    it("returns high score for word containment", () => {
        // forward: all expected words in candidate
        expect(
            directionalMatch("API Gateway", "API Gateway Service"),
        ).toBeGreaterThanOrEqual(0.85)
    })

    it("handles substring containment", () => {
        // "Route53" contained in "Route53 DNS Resolver"
        expect(
            directionalMatch("Route53", "Route53 DNS Resolver"),
        ).toBeGreaterThanOrEqual(0.8)
    })

    it("returns low score for unrelated strings", () => {
        expect(directionalMatch("Database", "Frontend UI")).toBeLessThan(0.4)
    })

    it("returns 0 for empty input", () => {
        expect(directionalMatch("", "Database")).toBe(0)
        expect(directionalMatch("Database", "")).toBe(0)
    })

    it("handles RabbitMQ vs Message Queue (partial match)", () => {
        // This should be a low match — they're semantically related but lexically different
        const score = directionalMatch("RabbitMQ", "Message Queue")
        expect(score).toBeLessThan(0.6)
    })

    it("handles acronym expansion", () => {
        // "TG" = initials of "Target Group"
        const score = directionalMatch("Web TG", "Web Target Group")
        expect(score).toBeGreaterThanOrEqual(0.8)
    })

    it("applies coverage penalty for missing words", () => {
        // "Web TG" vs "Web" — TG is not covered, should be penalized
        const score = directionalMatch("Web TG", "Web")
        expect(score).toBeLessThan(0.7)
    })
})

describe("extractVertexLabels", () => {
    it("extracts vertex labels from mxCell XML", () => {
        const xml = `
<mxCell id="2" value="API Gateway" style="rounded=1;" vertex="1" parent="1">
  <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
</mxCell>
<mxCell id="3" value="Database" style="shape=cylinder;" vertex="1" parent="1">
  <mxGeometry x="300" y="100" width="120" height="80" as="geometry"/>
</mxCell>
<mxCell id="4" style="edgeStyle=orthogonal;" edge="1" source="2" target="3" parent="1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>`
        const labels = extractVertexLabels(xml)
        expect(labels).toContain("API Gateway")
        expect(labels).toContain("Database")
        expect(labels).toHaveLength(2) // edge should be excluded
    })

    it("skips root cells", () => {
        const xml = `
<mxCell id="0"/>
<mxCell id="1" parent="0"/>
<mxCell id="2" value="Box" vertex="1" parent="1"/>`
        const labels = extractVertexLabels(xml)
        expect(labels).toEqual(["Box"])
    })

    it("handles empty value attributes", () => {
        const xml = `<mxCell id="2" value="" style="swimlane;" vertex="1" parent="1"/>`
        const labels = extractVertexLabels(xml)
        expect(labels).toHaveLength(0) // empty label should be filtered
    })

    it("returns empty array for empty input", () => {
        expect(extractVertexLabels("")).toEqual([])
        expect(extractVertexLabels("not xml")).toEqual([])
    })
})

describe("extractExpectedComponents", () => {
    it("extracts from 'with' clause", () => {
        const msg =
            "Draw a microservices architecture with an API gateway, four services, a database, and a message queue."
        const components = extractExpectedComponents(msg)
        expect(components).toContain("API gateway")
        expect(components).toContain("services")
        expect(components).toContain("database")
        expect(components).toContain("message queue")
    })

    it("extracts from 'including' clause", () => {
        const msg =
            "Create an architecture diagram including a load balancer, web server, and database."
        const components = extractExpectedComponents(msg)
        expect(components.length).toBeGreaterThanOrEqual(2)
    })

    it("extracts from bullet points", () => {
        const msg = `Create a diagram with:
- API Gateway
- User Service
- Database`
        const components = extractExpectedComponents(msg)
        expect(components).toContain("API Gateway")
        expect(components).toContain("User Service")
        expect(components).toContain("Database")
    })

    it("extracts quoted terms", () => {
        const msg = 'Add boxes labeled "Frontend", "Backend", and "Database"'
        const components = extractExpectedComponents(msg)
        expect(components).toContain("Frontend")
        expect(components).toContain("Backend")
        expect(components).toContain("Database")
    })

    it("deduplicates case-insensitively", () => {
        const msg =
            "Draw a diagram with a Database, including a database connection."
        const components = extractExpectedComponents(msg)
        const dbCount = components.filter(
            (c) => c.toLowerCase() === "database",
        ).length
        expect(dbCount).toBeLessThanOrEqual(1)
    })

    it("returns empty for short messages", () => {
        const components = extractExpectedComponents("Hello")
        expect(components).toEqual([])
    })
})

describe("findMissingComponents", () => {
    const sampleXml = `
<mxCell id="2" value="API Gateway" style="rounded=1;" vertex="1" parent="1"/>
<mxCell id="3" value="User Service" style="rounded=1;" vertex="1" parent="1"/>
<mxCell id="4" value="Database" style="shape=cylinder;" vertex="1" parent="1"/>`

    it("returns empty when all components are present", () => {
        const missing = findMissingComponents(
            ["API Gateway", "User Service", "Database"],
            sampleXml,
        )
        expect(missing).toEqual([])
    })

    it("identifies missing components", () => {
        const missing = findMissingComponents(
            ["API Gateway", "User Service", "Database", "Redis Cache"],
            sampleXml,
        )
        expect(missing).toContain("Redis Cache")
        expect(missing).toHaveLength(1)
    })

    it("handles fuzzy matching above threshold", () => {
        const missing = findMissingComponents(
            ["API GW", "User Svc", "DB"],
            sampleXml,
            0.4, // lower threshold for abbreviations
        )
        // These should match fuzzy
        expect(missing.length).toBeLessThanOrEqual(1)
    })

    it("uses 1-to-1 claiming (no double matching)", () => {
        const xml = `
<mxCell id="2" value="Service A" vertex="1" parent="1"/>
<mxCell id="3" value="Service B" vertex="1" parent="1"/>`
        // Both expected components should try to match different generated labels
        const missing = findMissingComponents(
            ["Service A", "Service B", "Service C"],
            xml,
        )
        expect(missing).toEqual(["Service C"])
    })

    it("returns all expected when XML is empty", () => {
        const missing = findMissingComponents(["A", "B", "C"], "")
        expect(missing).toEqual(["A", "B", "C"])
    })
})

describe("buildVerificationFeedback", () => {
    it("returns null for short component lists (< 3)", () => {
        const result = buildVerificationFeedback(
            "Draw a box",
            '<mxCell id="2" value="Box" vertex="1" parent="1"/>',
        )
        expect(result).toBeNull()
    })

    it("returns feedback when components are missing", () => {
        const msg =
            "Draw a diagram with an API Gateway, User Service, Payment Service, Database, and Redis Cache."
        const xml = `
<mxCell id="2" value="API Gateway" vertex="1" parent="1"/>
<mxCell id="3" value="User Service" vertex="1" parent="1"/>
<mxCell id="4" value="Database" vertex="1" parent="1"/>`
        const result = buildVerificationFeedback(msg, xml)
        expect(result).not.toBeNull()
        expect(result).toContain("Missing required components")
        // Payment Service and Redis Cache should be in the feedback
        expect(result).toContain("Payment Service")
        expect(result).toContain("Redis Cache")
    })

    it("returns null when all components are present", () => {
        const msg =
            "Create a diagram with API Gateway, User Service, and Database."
        const xml = `
<mxCell id="2" value="API Gateway" vertex="1" parent="1"/>
<mxCell id="3" value="User Service" vertex="1" parent="1"/>
<mxCell id="4" value="Database" vertex="1" parent="1"/>`
        const result = buildVerificationFeedback(msg, xml)
        expect(result).toBeNull()
    })
})
