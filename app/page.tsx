"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import ClientsTable from "@/components/clients-table"
import OrdersTable from "@/components/orders-table"
import DepositsTable from "@/components/deposits-table"
import WithdrawalsTable from "@/components/withdrawals-table"
import SettingsPanel from "@/components/settings-panel"
import DashboardComponent from "@/components/dashboard/dashboard-component"
import TeamPerformancePage from "@/components/team-performance/team-page"
import AgentPerformancePage from "@/components/agent-performance/agent-performance-page"
import OrderRequestPage from "@/components/order-requests/order-request-page"
import Sidebar from "@/components/sidebar"
import NavBar from "@/components/nav-bar"
import { useAuth } from "@/context/auth-context"
import ReportsPage from "@/components/reports/reports-page"
import InventoryPage from "@/components/inventory/inventory-page"
import VideoCallTemplate from "@/components/videocall/video-call-template"
import AnnouncementManagement from "@/components/announcements/announcement-management"
import AnnouncementPopup from "@/components/announcements/announcement-popup"
import LoadingScreen from "@/components/loading-screen"

function TabHandler({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return

    const urlParams = new URLSearchParams(window.location.search)
    const tabParam = urlParams.get("tab")

    if (tabParam) {
      setActiveTab(tabParam)
    } else {
      setActiveTab("dashboard")
    }
  }, [mounted, setActiveTab])

  return null
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [showLoadingScreen, setShowLoadingScreen] = useState(false)
  const [loadingScreenCompleted, setLoadingScreenCompleted] = useState(false)
  const loadingScreenInitialized = useRef(false)
  const { isAuthenticated, loading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      console.log("[v0] Redirecting to login - not authenticated")
      setLoadingScreenCompleted(false)
      loadingScreenInitialized.current = false
      router.push("/login")
      return
    }
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    if (!loading && isAuthenticated && !loadingScreenInitialized.current) {
      console.log("[v0] Starting loading screen - user authenticated")
      loadingScreenInitialized.current = true
      setShowLoadingScreen(true)
    }
  }, [isAuthenticated, loading])

  const handleLoadingComplete = () => {
    console.log("[v0] Loading screen animation completed, hiding loading screen")
    setShowLoadingScreen(false)
    setLoadingScreenCompleted(true)
  }

  if (showLoadingScreen) {
    return <LoadingScreen onAnimationComplete={handleLoadingComplete} userName={user?.nickname || user?.displayName} />
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Suspense fallback={null}>
        <TabHandler setActiveTab={setActiveTab} />
      </Suspense>

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Only show NavBar on desktop */}
      <div className="hidden md:block">
        <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      <main className="flex-1 ml-16 md:ml-64 md:mt-16 p-4 sm:p-6 transition-all duration-300 ease-in-out">
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="dashboard" className="mt-0">
            <DashboardComponent />
          </TabsContent>

          <TabsContent value="clients" className="mt-0">
            <ClientsTable />
          </TabsContent>

          <TabsContent value="orders" className="mt-0">
            <OrdersTable />
          </TabsContent>

          <TabsContent value="order-requests" className="mt-0">
            <OrderRequestPage />
          </TabsContent>

          <TabsContent value="deposits" className="mt-0">
            <DepositsTable />
          </TabsContent>

          <TabsContent value="withdrawals" className="mt-0">
            <WithdrawalsTable />
          </TabsContent>

          <TabsContent value="team" className="mt-0">
            <TeamPerformancePage />
          </TabsContent>

          <TabsContent value="agent-performance" className="mt-0">
            <AgentPerformancePage />
          </TabsContent>

          <TabsContent value="reports" className="mt-0">
            <ReportsPage />
          </TabsContent>

          <TabsContent value="inventory" className="mt-0">
            <InventoryPage />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <SettingsPanel />
          </TabsContent>

          <TabsContent value="videocall" className="mt-0">
            <VideoCallTemplate />
          </TabsContent>

          <TabsContent value="announcements" className="mt-0">
            <AnnouncementManagement />
          </TabsContent>
        </Tabs>
      </main>

      <AnnouncementPopup />
    </div>
  )
}
