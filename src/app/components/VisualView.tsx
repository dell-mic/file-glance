import React, { useState } from "react"
import { DataCharts } from "./DataChart/DataCharts"
import { PivotChart } from "./PivotChart"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface VisualViewProps {
  columnInfos: any[]
  hiddenColumns: number[]
  data: any[][]
}

const VisualView: React.FC<VisualViewProps> = ({
  columnInfos,
  hiddenColumns,
  data,
}) => {
  const [tab, setTab] = useState("charts")

  return (
    <Tabs
      value={tab}
      onValueChange={setTab}
      className="w-full overflow-y-auto"
      style={{ scrollbarWidth: "thin" }}
    >
      <TabsList className="mb-2 ml-2">
        <TabsTrigger className="p-4" value="charts">
          Column Statistics
        </TabsTrigger>
        <TabsTrigger className="p-4" value="pivot">
          Pivot Chart
        </TabsTrigger>
      </TabsList>
      <TabsContent value="charts">
        <DataCharts columnInfos={columnInfos} hiddenColumns={hiddenColumns} />
      </TabsContent>
      <TabsContent value="pivot">
        <PivotChart columnInfos={columnInfos} data={data} />
      </TabsContent>
    </Tabs>
  )
}

export default VisualView
