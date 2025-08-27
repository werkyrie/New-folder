"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useTeamContext } from "@/context/team-context"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Link, Users, Mail } from "lucide-react"
import { db } from "@/lib/firebase"
import { doc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore"

interface ViewerAgentConnection {
  id: string
  viewerEmail: string
  agentName: string
  connectedAt: string
  status: "Active" | "Inactive"
}

export default function ViewerAgentConnection() {
  const { agents } = useTeamContext()
  const { isAdmin } = useAuth()
  const { toast } = useToast()
  const [connections, setConnections] = useState<ViewerAgentConnection[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    viewerEmail: "",
    agentName: "",
  })

  // Load existing connections from Firebase
  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    try {
      const connectionsRef = collection(db, "viewerAgentConnections")
      const snapshot = await getDocs(connectionsRef)
      const loadedConnections: ViewerAgentConnection[] = []

      snapshot.forEach((doc) => {
        loadedConnections.push({ id: doc.id, ...doc.data() } as ViewerAgentConnection)
      })

      setConnections(loadedConnections)
    } catch (error) {
      console.error("Error loading connections:", error)
      toast({
        title: "Error",
        description: "Failed to load viewer-agent connections",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddConnection = () => {
    setFormData({ viewerEmail: "", agentName: "" })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.viewerEmail || !formData.agentName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.viewerEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    // Check if connection already exists
    const existingConnection = connections.find(
      (conn) => conn.viewerEmail === formData.viewerEmail || conn.agentName === formData.agentName,
    )

    if (existingConnection) {
      toast({
        title: "Connection Exists",
        description: "This viewer email or agent is already connected",
        variant: "destructive",
      })
      return
    }

    try {
      const connectionId = `${formData.viewerEmail}-${formData.agentName}`.replace(/[^a-zA-Z0-9]/g, "-")
      const newConnection: ViewerAgentConnection = {
        id: connectionId,
        viewerEmail: formData.viewerEmail,
        agentName: formData.agentName,
        connectedAt: new Date().toISOString(),
        status: "Active",
      }

      // Save to Firebase
      await setDoc(doc(db, "viewerAgentConnections", connectionId), newConnection)

      // Update local state
      setConnections((prev) => [...prev, newConnection])

      toast({
        title: "Connection Created",
        description: `${formData.viewerEmail} is now connected to agent ${formData.agentName}`,
      })

      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error creating connection:", error)
      toast({
        title: "Error",
        description: "Failed to create connection",
        variant: "destructive",
      })
    }
  }

  const handleDeleteConnection = async (connection: ViewerAgentConnection) => {
    try {
      await deleteDoc(doc(db, "viewerAgentConnections", connection.id))
      setConnections((prev) => prev.filter((conn) => conn.id !== connection.id))

      toast({
        title: "Connection Removed",
        description: `Connection between ${connection.viewerEmail} and ${connection.agentName} has been removed`,
      })
    } catch (error) {
      console.error("Error deleting connection:", error)
      toast({
        title: "Error",
        description: "Failed to remove connection",
        variant: "destructive",
      })
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">You don't have permission to manage viewer-agent connections.</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Viewer-Agent Connections
              </CardTitle>
              <CardDescription>
                Connect viewer accounts to specific agents so they can only access their own data
              </CardDescription>
            </div>
            <Button onClick={handleAddConnection}>
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Connections Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create connections between viewer accounts and agents to enable agent-specific access
              </p>
              <Button onClick={handleAddConnection}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Connection
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Viewer Email</TableHead>
                  <TableHead>Connected Agent</TableHead>
                  <TableHead>Connected Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((connection) => (
                  <TableRow key={connection.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {connection.viewerEmail}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{connection.agentName}</Badge>
                    </TableCell>
                    <TableCell>{new Date(connection.connectedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={connection.status === "Active" ? "default" : "secondary"}>
                        {connection.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteConnection(connection)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Connection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Viewer to Agent</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="viewerEmail">Viewer Email *</Label>
              <Input
                id="viewerEmail"
                type="email"
                value={formData.viewerEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, viewerEmail: e.target.value }))}
                placeholder="lovely@hotel.com"
                required
              />
              <p className="text-sm text-muted-foreground">Enter the email address of the viewer account</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agentName">Select Agent *</Label>
              <Select
                value={formData.agentName}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, agentName: value }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents
                    .filter((agent) => !connections.some((conn) => conn.agentName === agent.name))
                    .map((agent) => (
                      <SelectItem key={agent.id} value={agent.name}>
                        {agent.name} - {agent.role || "Regular"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Select which agent this viewer account should be connected to
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Connection</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
