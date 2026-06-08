import { createContext } from 'react'

export const JsonDraftErrorContext = createContext<(id: string, invalid: boolean) => void>(() => {})
