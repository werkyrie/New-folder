"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Loader2,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Languages,
  FileText,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Save,
  Lock,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useTeamContext } from "@/context/team-context"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { db } from "@/lib/firebase"
import { doc, setDoc, getDoc } from "firebase/firestore"

// Client interface
interface Client {
  id: string
  shopId: string
  clientDetails: string
  assets: string
  conversationSummary: string
  planForTomorrow: string
}

// Report data interface
interface ReportData {
  agentName: string
  addedToday: string
  monthlyAdded: string
  openShops: string
  deposits: string
  clients: Client[]
  lastModified: string
}

interface DateRange {
  from?: Date
  to?: Date
}

// Initial empty client template
const emptyClient = (): Client => ({
  id: crypto.randomUUID(),
  shopId: "",
  clientDetails: "",
  assets: "",
  conversationSummary: "",
  planForTomorrow: "",
})

export default function ReportsPage() {
  const { toast } = useToast()
  const { isAdmin, user } = useAuth()
  const { agents } = useTeamContext()
  const [reportType, setReportType] = useState<string>("agent-performance")
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(),
    to: new Date(),
  })
  const [agentName, setAgentName] = useState<string>("")
  const [addedToday, setAddedToday] = useState<number>(0)
  const [monthlyAdded, setMonthlyAdded] = useState<number>(0)
  const [openShops, setOpenShops] = useState<number>(0)
  const [agentDeposits, setAgentDeposits] = useState<number>(0)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [generatedReport, setGeneratedReport] = useState<string>("")
  const reportContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [reportData, setReportData] = useState<any>(null)
  const [reportClients, setReportClients] = useState<Client[]>([emptyClient()])
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    agentInfo: true,
    clients: true,
  })
  const [expandedClients, setExpandedClients] = useState<{ [key: string]: boolean }>({})
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string[] }>({})
  const [completionPercentage, setCompletionPercentage] = useState<number>(0)
  const [lastSaved, setLastSaved] = useState<string>("")
  const [connectedAgentName, setConnectedAgentName] = useState<string>("")
  const [isLoadingAgentData, setIsLoadingAgentData] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [showTranslationModal, setShowTranslationModal] = useState(false)
  const [translatedText, setTranslatedText] = useState("")
  const [isTranslating, setIsTranslating] = useState(false)

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    })
  }

  // Toggle client expansion
  const toggleClient = (clientId: string) => {
    setExpandedClients({
      ...expandedClients,
      [clientId]: !expandedClients[clientId],
    })
  }

  // Calculate completion percentage
  useEffect(() => {
    let totalFields = 5 // Agent fields
    let completedFields = 0

    // Count agent fields
    if (agentName) completedFields++
    if (addedToday) completedFields++
    if (monthlyAdded) completedFields++
    if (openShops) completedFields++
    if (agentDeposits) completedFields++

    // Count client fields (each client has 5 fields, but only 2 are required)
    reportClients.forEach((client) => {
      totalFields += 2 // Only count required fields
      if (client.conversationSummary) completedFields++
      if (client.planForTomorrow) completedFields++
    })

    const percentage = Math.round((completedFields / totalFields) * 100)
    setCompletionPercentage(percentage)
  }, [agentName, addedToday, monthlyAdded, openShops, agentDeposits, reportClients])

  // Initialize expanded clients state when clients change
  useEffect(() => {
    const newExpandedClients: { [key: string]: boolean } = {}
    reportClients.forEach((client) => {
      // If this is a new client, expand it by default
      if (expandedClients[client.id] === undefined) {
        newExpandedClients[client.id] = true
      } else {
        newExpandedClients[client.id] = expandedClients[client.id]
      }
    })
    setExpandedClients(newExpandedClients)
  }, [reportClients])

  // Add a new client
  const addClient = () => {
    const newClient = emptyClient()
    setReportClients([...reportClients, newClient])

    // Auto-expand the new client
    setExpandedClients({
      ...expandedClients,
      [newClient.id]: true,
    })

    // Scroll to the new client after a short delay
    setTimeout(() => {
      const element = document.getElementById(`client-${newClient.id}`)
      if (element) {
        element.scrollIntoView({ behavior: "smooth" })
      }
    }, 100)
  }

  // Remove a client
  const removeClient = (id: string) => {
    if (reportClients.length <= 1) {
      toast({
        title: "Cannot remove",
        description: "You must have at least one client in the report",
        variant: "destructive",
      })
      return
    }

    setReportClients(reportClients.filter((client) => client.id !== id))

    // Remove from expanded clients and validation errors
    const newExpandedClients = { ...expandedClients }
    delete newExpandedClients[id]
    setExpandedClients(newExpandedClients)

    const newValidationErrors = { ...validationErrors }
    delete newValidationErrors[id]
    setValidationErrors(newValidationErrors)
  }

  // Update client field
  const updateClient = (id: string, field: keyof Client, value: string) => {
    setReportClients(reportClients.map((client) => (client.id === id ? { ...client, [field]: value } : client)))

    // Clear validation error when field is filled
    if (value && validationErrors[id] && validationErrors[id].includes(field)) {
      const newErrors = { ...validationErrors }
      newErrors[id] = newErrors[id].filter((f) => f !== field)
      if (newErrors[id].length === 0) {
        delete newErrors[id]
      }
      setValidationErrors(newErrors)
    }

    setHasUnsavedChanges(true)
    debouncedSave()
  }

  // Check if client has required information
  const clientHasRequiredInfo = (client: Client) => {
    return Boolean(client.conversationSummary.trim() && client.planForTomorrow.trim())
  }

  // Get client completion status
  const getClientCompletionStatus = (client: Client) => {
    let completed = 0
    const total = 2 // Only count required fields

    if (client.conversationSummary) completed++
    if (client.planForTomorrow) completed++

    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100),
    }
  }

  // Validate all clients have required information
  const validateClientInfo = () => {
    const errors: { [key: string]: string[] } = {}
    let hasErrors = false

    reportClients.forEach((client) => {
      const clientErrors: string[] = []

      if (!client.conversationSummary.trim()) {
        clientErrors.push("conversationSummary")
      }

      if (!client.planForTomorrow.trim()) {
        clientErrors.push("planForTomorrow")
      }

      if (clientErrors.length > 0) {
        errors[client.id] = clientErrors
        hasErrors = true
      }
    })

    setValidationErrors(errors)

    if (hasErrors) {
      toast({
        title: "Missing required information",
        description: "Please fill out all required fields marked with *",
        variant: "destructive",
      })

      // Expand the first client with errors
      const firstErrorId = Object.keys(errors)[0]
      if (firstErrorId) {
        setExpandedClients({
          ...expandedClients,
          [firstErrorId]: true,
        })

        // Scroll to the client with error
        const clientElement = document.getElementById(`client-${firstErrorId}`)
        if (clientElement) {
          clientElement.scrollIntoView({ behavior: "smooth" })
        }
      }
    }

    return !hasErrors
  }

  // Save report data to Firebase
  const saveReportDataToFirebase = async () => {
    if (!user || !connectedAgentName) return

    setIsSaving(true)

    const dataToSave = {
      agentName: connectedAgentName,
      addedToday,
      monthlyAdded,
      openShops,
      deposits: agentDeposits,
      clients: reportClients,
      lastModified: new Date().toISOString(),
      userEmail: user.email,
    }

    try {
      await setDoc(doc(db, "agents", connectedAgentName, "reports", "current"), dataToSave)
      console.log(`[v0] Report saved to Firebase for agent: ${connectedAgentName}`)
      setLastSaved(new Date().toLocaleTimeString())

      if (!hasUnsavedChanges) {
        toast({
          title: "Report Saved",
          description: `Your report has been saved to Firebase for agent ${connectedAgentName}`,
        })
      }
    } catch (error) {
      console.error("[v0] Error saving report to Firebase:", error)
      toast({
        title: "Save Failed",
        description: "Could not save report to Firebase. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Load report data from Firebase
  const loadReportDataFromFirebase = async () => {
    if (!user || !connectedAgentName) return

    try {
      setIsLoadingAgentData(true)
      const reportDoc = await getDoc(doc(db, "agents", connectedAgentName, "reports", "current"))

      if (reportDoc.exists()) {
        const data = reportDoc.data()
        console.log(`[v0] Loaded report data for agent: ${connectedAgentName}`, data)

        setAgentName(data.agentName || connectedAgentName)
        setAddedToday(data.addedToday || 0)
        setMonthlyAdded(data.monthlyAdded || 0)
        setOpenShops(data.openShops || 0)
        setAgentDeposits(data.deposits || 0)

        const loadedClients = data.clients || [emptyClient()]
        setReportClients(loadedClients)

        if (data.lastModified) {
          const date = new Date(data.lastModified)
          setLastSaved(date.toLocaleTimeString())
        }
      } else {
        console.log(`[v0] No existing report found for agent: ${connectedAgentName}, initializing with defaults`)
        setAgentName(connectedAgentName)
        setReportClients([emptyClient()])
      }
    } catch (error) {
      console.error("[v0] Error loading report from Firebase:", error)
      toast({
        title: "Load Failed",
        description: "Could not load report from Firebase",
        variant: "destructive",
      })
    } finally {
      setIsLoadingAgentData(false)
    }
  }

  // Get agent name from email mapping
  const getAgentNameFromEmail = (email: string): string => {
    const emailPrefix = email.split("@")[0].toLowerCase()

    const emailToAgentMap: { [key: string]: string } = {
      lovely: "LOVELY",
      jhe: "JHE",
      kyrie: "KYRIE",
      primo: "PRIMO",
      cu: "CU",
      mar: "MAR",
      ken: "KEN",
      kel: "KEL",
    }

    return emailToAgentMap[emailPrefix] || emailPrefix.toUpperCase()
  }

  useEffect(() => {
    if (user?.email) {
      const agentName = getAgentNameFromEmail(user.email)
      console.log(`[v0] Connecting user ${user.email} to agent: ${agentName}`)
      setConnectedAgentName(agentName)
      setAgentName(agentName)
    }
  }, [user])

  useEffect(() => {
    if (connectedAgentName) {
      loadReportDataFromFirebase()
    }
  }, [connectedAgentName])

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (hasUnsavedChanges) {
        saveReportDataToFirebase()
        setHasUnsavedChanges(false)
      }
    }, 2000)
  }, [hasUnsavedChanges])

  const handleManualSave = () => {
    setHasUnsavedChanges(false)
    saveReportDataToFirebase()
  }

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const saveReportData = () => {
    saveReportDataToFirebase()
  }

  useEffect(() => {
    if (connectedAgentName && agents) {
      const selectedAgent = agents.find((agent) => agent.name === connectedAgentName)
      if (selectedAgent) {
        setAddedToday(selectedAgent.addedToday || 0)
        setMonthlyAdded(selectedAgent.monthlyAdded || 0)
        setOpenShops(selectedAgent.openAccounts || 0)
        setAgentDeposits(selectedAgent.totalDeposits || 0)
      }
    }
  }, [connectedAgentName, agents])

  // Generate the report
  const generateReport = () => {
    if (!validateClientInfo()) {
      return
    }

    setIsGenerating(true)
    saveReportData()

    setTimeout(() => {
      let report = `Agent Report - ${new Date().toLocaleDateString()}\n\n`

      report += `AGENT INFORMATION:\n`
      report += `Name: ${agentName || "Not specified"}\n`
      report += `Added Client Today: ${addedToday || "0"}\n`
      report += `Monthly Client Added: ${monthlyAdded || "0"}\n`
      report += `Open Shops: ${openShops || "0"}\n`
      report += `Deposits: ${agentDeposits || "$0"}\n\n`

      report += `CLIENT INFORMATION:\n\n`

      reportClients.forEach((client, index) => {
        report += `CLIENT ${index + 1}:\n`
        report += `Shop ID: ${client.shopId || "Not specified"}\n`
        report += `Client Details: ${client.clientDetails || "None"}\n`
        report += `Assets: ${client.assets || "None"}\n`
        report += `Conversation Summary: ${client.conversationSummary || "None"}\n`
        report += `Plan for Tomorrow: ${client.planForTomorrow || "None"}\n\n`
      })

      setGeneratedReport(report)
      setIsGenerating(false)

      setExpandedSections({
        ...expandedSections,
        report: true,
      })

      if (reportContainerRef.current) {
        reportContainerRef.current.scrollIntoView({ behavior: "smooth" })
      }

      toast({
        title: "Report Generated",
        description: "Your report has been successfully generated",
      })
    }, 800)
  }

  // Clear the report
  const clearReport = () => {
    setGeneratedReport("")
    toast({
      title: "Report Cleared",
      description: "The generated report has been cleared",
    })
  }

  // Copy report to clipboard
  const copyToClipboard = () => {
    if (!generatedReport) {
      toast({
        title: "Nothing to copy",
        description: "Please generate a report first",
        variant: "destructive",
      })
      return
    }

    navigator.clipboard
      .writeText(generatedReport)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description: "Report has been copied to your clipboard",
        })
      })
      .catch(() => {
        toast({
          title: "Copy failed",
          description: "Could not copy to clipboard. Please try again.",
        })
      })
  }

  // Translate report inline
  const translateReport = async () => {
    if (!generatedReport) {
      toast({
        title: "Nothing to translate",
        description: "Please generate a report first",
        variant: "destructive",
      })
      return
    }

    setIsTranslating(true)
    setShowTranslationModal(true)

    try {
      // Using Google Translate API through a simple fetch request
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(generatedReport)}`,
      )
      const data = await response.json()

      // Extract translated text from Google Translate API response
      let translated = ""
      if (data && data[0]) {
        translated = data[0].map((item: any) => item[0]).join("")
      }

      setTranslatedText(translated || "Translation failed. Please try again.")
    } catch (error) {
      setTranslatedText("Translation service unavailable. Please try again later.")
    } finally {
      setIsTranslating(false)
    }

    toast({
      title: "Translation complete",
      description: "Report has been translated to Chinese",
    })
  }

  if (isLoadingAgentData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Loading Agent Data...</h2>
          <p className="text-muted-foreground">Connecting to your agent account</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Agent Reports</h1>
        <p className="text-muted-foreground mt-2">Create detailed agent and client reports</p>
        {connectedAgentName && (
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Lock className="h-3 w-3 mr-1" />
              Connected to Agent: {connectedAgentName}
            </Badge>
            <span className="text-xs text-muted-foreground">Your reports are saved separately for this agent</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div className="text-sm font-medium">Report completion: {completionPercentage}%</div>
          <div className="flex items-center gap-4">
            {hasUnsavedChanges && (
              <div className="text-xs text-amber-600 flex items-center gap-1">
                <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
                Unsaved changes
              </div>
            )}
            {isSaving && (
              <div className="text-xs text-blue-600 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </div>
            )}
            {lastSaved && !hasUnsavedChanges && !isSaving && (
              <div className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Saved at {lastSaved}
              </div>
            )}
            <Button
              onClick={handleManualSave}
              size="sm"
              variant="outline"
              disabled={!hasUnsavedChanges || isSaving}
              className="h-7 px-3 text-xs bg-transparent"
            >
              <Save className="h-3 w-3 mr-1" />
              Save Now
            </Button>
          </div>
        </div>
        <Progress value={completionPercentage} className="h-2" />
      </div>

      <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader
          className="bg-muted/30 cursor-pointer flex flex-row items-center justify-between"
          onClick={() => toggleSection("agentInfo")}
        >
          <div>
            <CardTitle>Agent Information</CardTitle>
            <CardDescription>Your agent details for the report</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            {expandedSections.agentInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardHeader>

        {expandedSections.agentInfo && (
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="agentName" className="text-sm font-medium">
                  Agent Name <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2 h-10 px-3 py-2 rounded-md border border-input bg-muted text-foreground">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  {connectedAgentName}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    Locked
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Agent name is automatically set based on your login account
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="addedToday" className="text-sm font-medium">
                  Added Client Today <span className="text-red-500">*</span>
                </label>
                <Input
                  id="addedToday"
                  type="number"
                  value={addedToday}
                  onChange={(e) => setAddedToday(Number(e.target.value))}
                  placeholder="Enter clients added today"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="monthlyAdded" className="text-sm font-medium">
                  Monthly Client Added <span className="text-red-500">*</span>
                </label>
                <Input
                  id="monthlyAdded"
                  type="number"
                  value={monthlyAdded}
                  onChange={(e) => setMonthlyAdded(Number(e.target.value))}
                  placeholder="Enter monthly clients added"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="openShops" className="text-sm font-medium">
                  Open Shops <span className="text-red-500">*</span>
                </label>
                <Input
                  id="openShops"
                  type="number"
                  value={openShops}
                  onChange={(e) => setOpenShops(Number(e.target.value))}
                  placeholder="Enter number of open shops"
                  min="0"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="deposits" className="text-sm font-medium">
                  Deposits <span className="text-red-500">*</span>
                </label>
                <Input
                  id="deposits"
                  type="number"
                  value={agentDeposits}
                  onChange={(e) => setAgentDeposits(Number(e.target.value))}
                  placeholder="Enter total deposits"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader
          className="bg-muted/30 cursor-pointer flex flex-row items-center justify-between"
          onClick={() => toggleSection("clients")}
        >
          <div>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>Enter details for each client</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation()
                addClient()
              }}
              size="sm"
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              {expandedSections.clients ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {expandedSections.clients && (
          <CardContent className="pt-4">
            <div className="space-y-4">
              {reportClients.map((client, index) => {
                const status = getClientCompletionStatus(client)

                return (
                  <Card
                    key={client.id}
                    id={`client-${client.id}`}
                    className={`shadow-sm transition-shadow duration-300 ${validationErrors[client.id] ? "border-red-300" : ""}`}
                  >
                    <CardHeader
                      className={`py-3 cursor-pointer flex flex-row items-center justify-between ${validationErrors[client.id] ? "bg-red-50" : "bg-muted/30"}`}
                      onClick={() => toggleClient(client.id)}
                    >
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-base">Client {index + 1}</CardTitle>
                        <Progress
                          value={status.percentage}
                          className="h-2 w-20"
                          indicatorClassName={status.percentage === 100 ? "bg-green-500" : ""}
                        />
                        <span className="text-xs text-muted-foreground">
                          {status.completed}/{status.total} completed
                        </span>

                        {validationErrors[client.id] && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            Missing required fields
                          </Badge>
                        )}

                        {clientHasRequiredInfo(client) && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeClient(client.id)
                          }}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove client</span>
                        </Button>

                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          {expandedClients[client.id] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>

                    {expandedClients[client.id] && (
                      <CardContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor={`shopId-${client.id}`} className="text-sm font-medium">
                              Shop ID
                            </label>
                            <Input
                              id={`shopId-${client.id}`}
                              placeholder="Enter shop ID"
                              value={client.shopId}
                              onChange={(e) => updateClient(client.id, "shopId", e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <label htmlFor={`assets-${client.id}`} className="text-sm font-medium">
                              Assets
                            </label>
                            <Input
                              id={`assets-${client.id}`}
                              placeholder="Enter client assets"
                              value={client.assets}
                              onChange={(e) => updateClient(client.id, "assets", e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label htmlFor={`clientDetails-${client.id}`} className="text-sm font-medium">
                            Client Details
                          </label>
                          <Textarea
                            id={`clientDetails-${client.id}`}
                            placeholder="Client Name/ Age/ Job/Location"
                            value={client.clientDetails}
                            onChange={(e) => updateClient(client.id, "clientDetails", e.target.value)}
                            rows={2}
                          />
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor={`conversationSummary-${client.id}`}
                            className="text-sm font-medium flex items-center"
                          >
                            Conversation Summary <span className="text-red-500 ml-1">*</span>
                          </label>

                          <Textarea
                            id={`conversationSummary-${client.id}`}
                            placeholder="Summarize your conversation"
                            value={client.conversationSummary}
                            onChange={(e) => updateClient(client.id, "conversationSummary", e.target.value)}
                            rows={3}
                            className={
                              validationErrors[client.id] && validationErrors[client.id].includes("conversationSummary")
                                ? "border-red-300"
                                : ""
                            }
                          />

                          {validationErrors[client.id] &&
                            validationErrors[client.id].includes("conversationSummary") && (
                              <p className="text-xs text-red-500 mt-1">This field is required</p>
                            )}
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor={`planForTomorrow-${client.id}`}
                            className="text-sm font-medium flex items-center"
                          >
                            Plan for Tomorrow <span className="text-red-500 ml-1">*</span>
                          </label>

                          <Textarea
                            id={`planForTomorrow-${client.id}`}
                            placeholder="What's the plan for tomorrow?"
                            value={client.planForTomorrow}
                            onChange={(e) => updateClient(client.id, "planForTomorrow", e.target.value)}
                            rows={3}
                            className={
                              validationErrors[client.id] && validationErrors[client.id].includes("planForTomorrow")
                                ? "border-red-300"
                                : ""
                            }
                          />

                          {validationErrors[client.id] && validationErrors[client.id].includes("planForTomorrow") && (
                            <p className="text-xs text-red-500 mt-1">This field is required</p>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )
              })}

              <Button
                onClick={addClient}
                variant="outline"
                className="w-full flex items-center justify-center gap-2 py-6 border-dashed bg-transparent"
              >
                <Plus className="h-4 w-4" />
                Add Another Client
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card
        className="shadow-sm border border-muted hover:shadow-md transition-shadow duration-300"
        ref={reportContainerRef}
      >
        <CardHeader className="bg-muted/20 dark:bg-muted/10 flex flex-row items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="bg-background border border-muted p-2 rounded-full dark:bg-muted/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Generate Your Report</CardTitle>
              <CardDescription>Click here to create, export, and manage your completed report</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 mb-6">
            <Button onClick={generateReport} disabled={isGenerating} className="flex items-center gap-2">
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={clearReport}
              disabled={!generatedReport || isGenerating}
              className="flex items-center gap-2 bg-transparent"
            >
              <RefreshCw className="h-4 w-4" />
              Clear
            </Button>

            <Button
              variant="outline"
              onClick={translateReport}
              disabled={!generatedReport || isGenerating}
              className="flex items-center gap-2 bg-transparent"
            >
              <Languages className="h-4 w-4" />
              Translate
            </Button>

            <Button
              variant="outline"
              onClick={copyToClipboard}
              disabled={!generatedReport || isGenerating}
              className="flex items-center gap-2 bg-transparent"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>

          {generatedReport && (
            <div className="mt-6">
              <div className="bg-muted/30 rounded-lg p-4 border">
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">{generatedReport}</pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end items-center gap-4 pt-4 border-t">
        {hasUnsavedChanges && (
          <div className="text-xs text-amber-600 flex items-center gap-1">
            <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
            Unsaved changes
          </div>
        )}
        {isSaving && (
          <div className="text-xs text-blue-600 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </div>
        )}
        {lastSaved && !hasUnsavedChanges && !isSaving && (
          <div className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Saved at {lastSaved}
          </div>
        )}
        <Button
          onClick={handleManualSave}
          size="sm"
          variant="outline"
          disabled={!hasUnsavedChanges || isSaving}
          className="h-8 px-4 text-sm bg-transparent"
        >
          <Save className="h-3 w-3 mr-2" />
          Save Now
        </Button>
      </div>

      <Dialog open={showTranslationModal} onOpenChange={setShowTranslationModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Translated Report (Chinese)
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {isTranslating ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Translating report...
              </div>
            ) : (
              <div className="p-4 bg-muted rounded-lg">
                <pre className="whitespace-pre-wrap text-sm font-mono">{translatedText}</pre>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(translatedText)
                toast({
                  title: "Copied!",
                  description: "Translated report copied to clipboard",
                })
              }}
              disabled={isTranslating || !translatedText}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Translation
            </Button>
            <Button onClick={() => setShowTranslationModal(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
