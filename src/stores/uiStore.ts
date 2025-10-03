import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

type ViewMode = 'grid' | 'list'
type Theme = 'light' | 'dark' | 'system'

interface UIState {
  sidebarOpen: boolean
  mobileMenuOpen: boolean
  viewMode: ViewMode
  theme: Theme
  isChatOpen: boolean

  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setMobileMenuOpen: (open: boolean) => void
  toggleMobileMenu: () => void
  setViewMode: (mode: ViewMode) => void
  setTheme: (theme: Theme) => void
  setIsChatOpen: (open: boolean) => void
  toggleChat: () => void
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: true,
        mobileMenuOpen: false,
        viewMode: 'grid',
        theme: 'dark',
        isChatOpen: false,

        setSidebarOpen: (open) => set({ sidebarOpen: open }),

        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

        setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

        toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),

        setViewMode: (mode) => set({ viewMode: mode }),

        setTheme: (theme) => set({ theme }),

        setIsChatOpen: (open) => set({ isChatOpen: open }),

        toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen }))
      }),
      {
        name: 'ui-storage',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          viewMode: state.viewMode,
          theme: state.theme
        })
      }
    ),
    { name: 'UIStore' }
  )
)
