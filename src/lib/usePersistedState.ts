import { useEffect, useState } from 'react'

export function usePersistedState<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key)
      return saved ? (JSON.parse(saved) as T) : initialValue
    } catch (error) {
      console.error(`Could not read "${key}" from local storage.`, error)
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error(`Could not save "${key}" to local storage.`, error)
    }
  }, [key, value])

  return [value, setValue]
}
