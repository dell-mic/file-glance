export const FileChooser = (props: {
  handleFileSelected: React.ChangeEventHandler<HTMLInputElement> | undefined
  isDragging: boolean
}) => {
  return (
    <div className="w-4/6 mx-auto my-24">
      <label
        data-testid="fileInput"
        className="flex flex-col items-center justify-center w-full h-96 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all select-none"
        style={{
          transitionDuration: "200ms",
          transform: props.isDragging ? "scale(1.2)" : undefined,
        }}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg
            className="size-16 mb-3 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4 2h12l6 6v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>
            <line x1="4" y1="10" x2="20" y2="10"></line>
            <line x1="8" y1="14" x2="16" y2="14"></line>
            <line x1="8" y1="18" x2="16" y2="18"></line>
          </svg>
          <p className="mb-2 px-2 text-center text-gray-600 text-4xl">
            <span className="font-medium whitespace-nowrap">Choose file</span>{" "}
            or{" "}
            <span className="font-medium whitespace-nowrap">drag & drop</span>{" "}
            or <span className="font-medium whitespace-nowrap">paste</span>
          </p>
          <p className=" text-gray-500">CSV, TSV, XLSX, JSON, TXT</p>
        </div>
        <input
          type="file"
          className="hidden"
          onChange={props.handleFileSelected}
        />
      </label>
    </div>
  )
}
