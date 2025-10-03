import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

type ViewMode = 'grid' | 'list'
type Theme = 'light' | 'dark' | 'system'

interface UIState {
  sidebarOpen: boolean
  mobileMenuOpen: boolean
  viewMode: ViewMode
  theme: Theme

  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setMobileMenuOpen: (open: boolean) => void
  toggleMobileMenu: () => void
  setViewMode: (mode: ViewMode) => void
  setTheme: (theme: Theme) => void
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: true,
        mobileMenuOpen: false,
        viewMode: 'grid',
        theme: 'dark',

        setSidebarOpen: (open) => set({ sidebarOpen: open }),

        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

        setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

        toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),

        setViewMode: (mode) => set({ viewMode: mode }),

        setTheme: (theme) => set({ theme })
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
