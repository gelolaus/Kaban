import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface InspectorContextValue {
  content: ReactNode | null
  setContent: (node: ReactNode | null) => void
}

const InspectorContext = createContext<InspectorContextValue | null>(null)

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null)
  return (
    <InspectorContext.Provider value={{ content, setContent }}>{children}</InspectorContext.Provider>
  )
}

export function useInspectorSlot(): ReactNode | null {
  return useContext(InspectorContext)?.content ?? null
}

/** Publish content into the laptop inspector column; clears on unmount. */
export function useInspector(content: ReactNode | null): void {
  const ctx = useContext(InspectorContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setContent(content)
  }, [ctx, content])
  useEffect(() => {
    return () => ctx?.setContent(null)
  }, [ctx])
}
