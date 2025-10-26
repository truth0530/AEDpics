"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const SidebarContext = React.createContext<{
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  isHovered: boolean
  setIsHovered: (hovered: boolean) => void
}>({
  collapsed: false,
  setCollapsed: () => {},
  isHovered: false,
  setIsHovered: () => {},
})

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

export function SidebarProvider({
  children,
  defaultCollapsed = false,
}: {
  children: React.ReactNode
  defaultCollapsed?: boolean
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, isHovered, setIsHovered }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function Sidebar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { collapsed } = useSidebar()
  const isExpanded = !collapsed

  return (
    <aside
      className={cn(
        "bg-gray-950 text-white transition-all duration-300 ease-in-out fixed left-0 top-0 h-screen z-[100] border-r border-gray-800/50 flex flex-col hidden md:flex",
        isExpanded ? "w-[160px] shadow-2xl" : "w-16",
        className
      )}
    >
      {children}
    </aside>
  )
}

export function SidebarHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("border-b border-gray-800/50", className)}>
      {children}
    </div>
  )
}

export function SidebarContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex-1 overflow-y-hidden flex flex-col", className)}>
      {children}
    </div>
  )
}

export function SidebarFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("p-2 border-t border-gray-800", className)}>
      {children}
    </div>
  )
}

export function SidebarMenu({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <nav className={cn("p-2 space-y-1", className)}>
      {children}
    </nav>
  )
}

export function SidebarMenuItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}

export function SidebarMenuButton({
  children,
  className,
  isActive = false,
  ...props
}: React.ComponentProps<"button"> & {
  isActive?: boolean
}) {
  const { collapsed, isHovered } = useSidebar()
  const isExpanded = !collapsed || isHovered

  return (
    <button
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
        "hover:bg-gray-800/80 hover:text-white",
        "text-gray-400",
        isActive && "bg-gray-800 text-white",
        !isExpanded && "justify-center px-2",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function SidebarTrigger({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { collapsed, setCollapsed } = useSidebar()

  return (
    <button
      onClick={() => setCollapsed(!collapsed)}
      className={cn(
        "p-2 hover:bg-gray-800 rounded-lg transition-colors",
        className
      )}
      {...props}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>
  )
}

export function SidebarInset({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { collapsed } = useSidebar()
  const isExpanded = !collapsed

  return (
    <main className={cn(
      "flex flex-col w-full overflow-hidden transition-all duration-300 ease-in-out",
      isExpanded ? "md:ml-[160px]" : "md:ml-16",
      className
    )}>
      {children}
    </main>
  )
}