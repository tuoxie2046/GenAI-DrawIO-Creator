"use client"

import type React from "react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { DrawIoEmbedRef } from "react-drawio"
import { toast } from "sonner"
import type { ExportFormat } from "@/components/save-dialog"
import { getApiEndpoint } from "@/lib/base-path"
import {
    extractDiagramXML,
    isRealDiagram,
    validateAndFixXml,
} from "../lib/utils"

interface DiagramContextType {
    chartXML: string
    latestSvg: string
    diagramHistory: { svg: string; xml: string }[]
    setDiagramHistory: (history: { svg: string; xml: string }[]) => void
    loadDiagram: (chart: string, skipValidation?: boolean) => string | null
    handleExport: () => void
    handleExportWithoutHistory: () => void
    resolverRef: React.Ref<((value: string) => void) | null>
    drawioRef: React.Ref<DrawIoEmbedRef | null>
    handleDiagramExport: (data: any) => void
    clearDiagram: () => void
    saveDiagramToFile: (
        filename: string,
        format: ExportFormat,
        sessionId?: string,
        successMessage?: string,
    ) => void
    getThumbnailSvg: () => Promise<string | null>
    captureValidationPng: () => Promise<string | null>
    isDrawioReady: boolean
    onDrawioLoad: () => void
    resetDrawioReady: () => void
    showSaveDialog: boolean
    setShowSaveDialog: (show: boolean) => void
}

const DiagramContext = createContext<DiagramContextType | undefined>(undefined)

export function DiagramProvider({ children }: { children: React.ReactNode }) {
    const [chartXML, setChartXML] = useState<string>("")
    const [latestSvg, setLatestSvg] = useState<string>("")
    const [diagramHistory, setDiagramHistory] = useState<
        { svg: string; xml: string }[]
    >([])
    const [isDrawioReady, setIsDrawioReady] = useState(false)
    const [showSaveDialog, setShowSaveDialog] = useState(false)
    const hasCalledOnLoadRef = useRef(false)
    const drawioRef = useRef<DrawIoEmbedRef | null>(null)
    const resolverRef = useRef<((value: string) => void) | null>(null)
    // Resolver for PNG export (used for VLM validation)
    const pngResolverRef = useRef<((value: string) => void) | null>(null)
    // Track if we're expecting an export for history (user-initiated)
    const expectHistoryExportRef = useRef<boolean>(false)
    // Track if diagram has been restored after DrawIO remount (e.g., theme change)
    const hasDiagramRestoredRef = useRef<boolean>(false)
    // Track latest chartXML for restoration after remount
    const chartXMLRef = useRef<string>("")

    const onDrawioLoad = () => {
        // Only set ready state once to prevent infinite loops
        if (hasCalledOnLoadRef.current) return
        hasCalledOnLoadRef.current = true
        setIsDrawioReady(true)
    }

    const resetDrawioReady = () => {
        hasCalledOnLoadRef.current = false
        setIsDrawioReady(false)
    }

    // Keep chartXMLRef in sync with state for restoration after remount
    useEffect(() => {
        chartXMLRef.current = chartXML
    }, [chartXML])

    // Restore diagram when DrawIO becomes ready after remount (e.g., theme/UI change)
    useEffect(() => {
        // Reset restore flag when DrawIO is not ready (preparing for next restore cycle)
        if (!isDrawioReady) {
            hasDiagramRestoredRef.current = false
            return
        }
        // Only restore once per ready cycle
        if (hasDiagramRestoredRef.current) return
        hasDiagramRestoredRef.current = true

        // Restore diagram from ref if we have one
        const xmlToRestore = chartXMLRef.current
        if (isRealDiagram(xmlToRestore) && drawioRef.current) {
            drawioRef.current.load({ xml: xmlToRestore })
        }
    }, [isDrawioReady])

    // Track if we're expecting an export for file save (stores raw export data)
    const saveResolverRef = useRef<{
        resolver: ((data: string) => void) | null
        format: ExportFormat | null
    }>({ resolver: null, format: null })

    const handleExport = () => {
        if (drawioRef.current) {
            // Mark that this export should be saved to history
            expectHistoryExportRef.current = true
            drawioRef.current.exportDiagram({
                format: "xmlsvg",
            })
        }
    }

    const handleExportWithoutHistory = () => {
        if (drawioRef.current) {
            // Export without saving to history (for edit_diagram fetching current state)
            drawioRef.current.exportDiagram({
                format: "xmlsvg",
            })
        }
    }

    // Get current diagram as SVG for thumbnail (used by session storage)
    const getThumbnailSvg = async (): Promise<string | null> => {
        if (!drawioRef.current) return null
        // Don't export if diagram is empty
        if (!isRealDiagram(chartXML)) return null

        try {
            const svgData = await Promise.race([
                new Promise<string>((resolve) => {
                    resolverRef.current = resolve
                    drawioRef.current?.exportDiagram({ format: "xmlsvg" })
                }),
                new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error("Export timeout")), 3000),
                ),
            ])

            // Update latestSvg so it's available for future saves
            if (svgData?.includes("<svg")) {
                setLatestSvg(svgData)
                return svgData
            }
            return null
        } catch {
            // Timeout is expected occasionally - don't log as error
            return null
        }
    }

    // Capture current diagram as PNG for VLM validation
    const captureValidationPng = async (): Promise<string | null> => {
        if (!drawioRef.current) return null
        // Don't export if diagram is empty
        if (!isRealDiagram(chartXML)) return null

        try {
            const pngData = await Promise.race([
                new Promise<string>((resolve) => {
                    pngResolverRef.current = resolve
                    drawioRef.current?.exportDiagram({ format: "png" })
                }),
                new Promise<string>((_, reject) =>
                    setTimeout(
                        () => reject(new Error("PNG export timeout")),
                        5000,
                    ),
                ),
            ])

            // PNG data should be a base64 data URL
            if (pngData?.startsWith("data:image/png")) {
                return pngData
            }
            return null
        } catch {
            // Timeout is expected occasionally - don't log as error
            return null
        }
    }

    const loadDiagram = (
        chart: string,
        skipValidation?: boolean,
    ): string | null => {
        let xmlToLoad = chart

        // Validate XML structure before loading (unless skipped for internal use)
        if (!skipValidation) {
            const validation = validateAndFixXml(chart)
            if (!validation.valid) {
                console.warn(
                    "[loadDiagram] Validation error:",
                    validation.error,
                )
                return validation.error
            }
            // Use fixed XML if auto-fix was applied
            if (validation.fixed) {
                console.log(
                    "[loadDiagram] Auto-fixed XML issues:",
                    validation.fixes,
                )
                xmlToLoad = validation.fixed
            }
        }

        // Keep chartXML in sync even when diagrams are injected (e.g., display_diagram tool)
        setChartXML(xmlToLoad)

        if (drawioRef.current) {
            drawioRef.current.load({
                xml: xmlToLoad,
            })
        }

        return null
    }

    const handleDiagramExport = (data: any) => {
        // Handle PNG export for VLM validation
        if (pngResolverRef.current && data.data?.startsWith("data:image/png")) {
            pngResolverRef.current(data.data)
            pngResolverRef.current = null
            return
        }

        // Handle save to file if requested (process raw data before extraction)
        if (saveResolverRef.current.resolver) {
            const format = saveResolverRef.current.format
            saveResolverRef.current.resolver(data.data)
            saveResolverRef.current = { resolver: null, format: null }
            // For non-xmlsvg formats, skip XML extraction as it will fail
            // Only drawio (which uses xmlsvg internally) has the content attribute
            if (format === "png" || format === "svg" || format === "pdf") {
                return
            }
        }

        const extractedXML = extractDiagramXML(data.data)
        setChartXML(extractedXML)
        setLatestSvg(data.data)

        // Only add to history if this was a user-initiated export
        // Limit to 20 entries to prevent memory leaks during long sessions
        const MAX_HISTORY_SIZE = 20
        if (expectHistoryExportRef.current) {
            setDiagramHistory((prev) => {
                const newHistory = [
                    ...prev,
                    {
                        svg: data.data,
                        xml: extractedXML,
                    },
                ]
                // Keep only the last MAX_HISTORY_SIZE entries (circular buffer)
                return newHistory.slice(-MAX_HISTORY_SIZE)
            })
            expectHistoryExportRef.current = false
        }

        if (resolverRef.current) {
            resolverRef.current(extractedXML)
            resolverRef.current = null
        }
    }

    const clearDiagram = () => {
        const emptyDiagram = `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
        // Skip validation for trusted internal template (loadDiagram also sets chartXML)
        loadDiagram(emptyDiagram, true)
        setLatestSvg("")
        setDiagramHistory([])
    }

    const saveDiagramToFile = (
        filename: string,
        format: ExportFormat,
        sessionId?: string,
        successMessage?: string,
    ) => {
        if (!drawioRef.current) {
            console.warn("Draw.io editor not ready")
            return
        }

        // Map format to draw.io export format
        // PDF exports request SVG from draw.io, then convert via svg2pdf.js
        const drawioFormat =
            format === "drawio" ? "xmlsvg" : format === "pdf" ? "svg" : format

        // Set up the resolver before triggering export
        saveResolverRef.current = {
            resolver: (exportData: string) => {
                let fileContent: string | Blob
                let mimeType: string
                let extension: string

                if (format === "drawio") {
                    // Extract XML from SVG for .drawio format
                    const xml = extractDiagramXML(exportData)
                    let xmlContent = xml
                    if (!xml.includes("<mxfile")) {
                        xmlContent = `<mxfile><diagram name="Page-1" id="page-1">${xml}</diagram></mxfile>`
                    }
                    fileContent = xmlContent
                    mimeType = "application/xml"
                    extension = ".drawio"
                } else if (format === "png") {
                    // PNG data comes as base64 data URL
                    fileContent = exportData
                    mimeType = "image/png"
                    extension = ".png"
                } else if (format === "pdf") {
                    // SVG → server-side PNG via sharp (librsvg) → PDF.
                    // Browser canvas taints when drawing SVG via <img>, so we
                    // render server-side where no CORS restrictions apply.
                    ;(async () => {
                        try {
                            const { jsPDF } = await import("jspdf")

                            // Decode data URI → raw SVG string
                            let svgString = exportData
                            if (exportData.startsWith("data:")) {
                                const commaIdx = exportData.indexOf(",")
                                const header = exportData.substring(0, commaIdx)
                                const payload = exportData.substring(
                                    commaIdx + 1,
                                )
                                svgString = header.includes("base64")
                                    ? atob(payload)
                                    : decodeURIComponent(payload)
                            }

                            // Parse SVG dimensions
                            const parser = new DOMParser()
                            const svgDoc = parser.parseFromString(
                                svgString,
                                "image/svg+xml",
                            )
                            const svgEl = svgDoc.documentElement
                            let svgWidth =
                                parseFloat(
                                    svgEl.getAttribute("width") || "0",
                                ) || 0
                            let svgHeight =
                                parseFloat(
                                    svgEl.getAttribute("height") || "0",
                                ) || 0
                            const viewBox = svgEl.getAttribute("viewBox")
                            if (viewBox) {
                                const parts = viewBox.trim().split(/[\s,]+/)
                                if (!svgWidth)
                                    svgWidth = parseFloat(parts[2]) || 800
                                if (!svgHeight)
                                    svgHeight = parseFloat(parts[3]) || 600
                            }
                            if (!svgWidth) svgWidth = 800
                            if (!svgHeight) svgHeight = 600

                            // Render SVG server-side via sharp/librsvg at 2× density
                            const res = await fetch("/api/render-svg", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ svgString, scale: 2 }),
                            })
                            if (!res.ok)
                                throw new Error(
                                    `Render failed: ${res.statusText}`,
                                )
                            const { png } = await res.json()

                            const pdf = new jsPDF({
                                orientation:
                                    svgWidth > svgHeight
                                        ? "landscape"
                                        : "portrait",
                                unit: "px",
                                format: [svgWidth, svgHeight],
                                hotfixes: ["px_scaling"],
                            })
                            pdf.addImage(png, "PNG", 0, 0, svgWidth, svgHeight)
                            pdf.save(`${filename}.pdf`)

                            logSaveToLangfuse(filename, format, sessionId)
                            if (successMessage) {
                                toast.success(successMessage, {
                                    position: "bottom-left",
                                    duration: 2500,
                                })
                            }
                        } catch (error) {
                            console.error("PDF export failed:", error)
                            toast.error("PDF export failed", {
                                position: "bottom-left",
                            })
                        }
                    })()
                    return
                } else {
                    // SVG format
                    fileContent = exportData
                    mimeType = "image/svg+xml"
                    extension = ".svg"
                }

                // Log save event to Langfuse (flags the trace)
                logSaveToLangfuse(filename, format, sessionId)

                // Handle download
                let url: string
                if (
                    typeof fileContent === "string" &&
                    fileContent.startsWith("data:")
                ) {
                    // Already a data URL (PNG)
                    url = fileContent
                } else {
                    const blob = new Blob([fileContent], { type: mimeType })
                    url = URL.createObjectURL(blob)
                }

                const a = document.createElement("a")
                a.href = url
                a.download = `${filename}${extension}`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)

                // Show success toast after download is initiated
                if (successMessage) {
                    toast.success(successMessage, {
                        position: "bottom-left",
                        duration: 2500,
                    })
                }

                // Delay URL revocation to ensure download completes
                if (!url.startsWith("data:")) {
                    setTimeout(() => URL.revokeObjectURL(url), 100)
                }
            },
            format,
        }

        // Export diagram - callback will be handled in handleDiagramExport
        drawioRef.current.exportDiagram({ format: drawioFormat })
    }

    // Log save event to Langfuse (just flags the trace, doesn't send content)
    const logSaveToLangfuse = async (
        filename: string,
        format: string,
        sessionId?: string,
    ) => {
        try {
            await fetch(getApiEndpoint("/api/log-save"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename, format, sessionId }),
            })
        } catch (error) {
            console.warn("Failed to log save to Langfuse:", error)
        }
    }

    return (
        <DiagramContext.Provider
            value={{
                chartXML,
                latestSvg,
                diagramHistory,
                setDiagramHistory,
                loadDiagram,
                handleExport,
                handleExportWithoutHistory,
                resolverRef,
                drawioRef,
                handleDiagramExport,
                clearDiagram,
                saveDiagramToFile,
                getThumbnailSvg,
                captureValidationPng,
                isDrawioReady,
                onDrawioLoad,
                resetDrawioReady,
                showSaveDialog,
                setShowSaveDialog,
            }}
        >
            {children}
        </DiagramContext.Provider>
    )
}

export function useDiagram() {
    const context = useContext(DiagramContext)
    if (context === undefined) {
        throw new Error("useDiagram must be used within a DiagramProvider")
    }
    return context
}
