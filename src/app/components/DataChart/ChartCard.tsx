import * as React from "react"
import { Card } from "@/components/ui/card"
import { useInView } from "react-intersection-observer"

interface ChartCardProps {
  children?: React.ReactNode
}

export const ChartCard: React.FC<ChartCardProps> = ({ children }) => {
  const { ref, inView } = useInView({ triggerOnce: true })

  return (
    // W/o min height all cards are initially visible because height is flexible in layout
    <Card ref={ref} className={`flex flex-col h-full min-h-96`}>
      {inView ? children : null}
    </Card>
  )
}
