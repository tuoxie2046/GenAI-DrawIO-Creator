import sharp from "sharp"

export async function POST(req: Request) {
    try {
        const { svgString, scale = 2 } = await req.json()

        if (!svgString || typeof svgString !== "string") {
            return Response.json(
                { error: "Missing svgString" },
                { status: 400 },
            )
        }

        const svgBuffer = Buffer.from(svgString, "utf-8")

        // Use sharp (librsvg) to render SVG to PNG at the requested scale
        const pngBuffer = await sharp(svgBuffer, { density: 96 * scale })
            .png()
            .toBuffer()

        const base64 = pngBuffer.toString("base64")
        return Response.json({ png: `data:image/png;base64,${base64}` })
    } catch (err: any) {
        console.error("SVG render failed:", err)
        return Response.json(
            { error: err?.message ?? "Render failed" },
            { status: 500 },
        )
    }
}
