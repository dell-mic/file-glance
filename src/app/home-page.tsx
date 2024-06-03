"use client";

import React from "react";

import { maxBy, orderBy, sortBy } from "lodash";
import * as XLSX from "xlsx";
import { parse } from "csv-parse/browser/esm/sync";
import Accordion from "./components/Accordion";

export default function Home() {
  const [dragging, setDragging] = React.useState(false);
  const [currentFile, setCurrentFile] = React.useState<File>();

  const [rows, setRows] = React.useState<Array<any>>([]);
  const [columnValueCounts, setcColumnValueCounts] = React.useState<
    ColumnInfos[]
  >([]);

  const drag = React.useRef(null);
  const drop = React.useRef(null);
  const input = React.useRef(null);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const parseFile = async (file: File) => {
    setCurrentFile(file);

    let data: string[][];
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      const fileAsArrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(fileAsArrayBuffer);
      console.log("workbook.SheetNames", workbook.SheetNames);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      console.log("firstSheet", firstSheet);
      data = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        blankrows: true,
        defval: "",
      });
      console.log(data, "data");

      setRows(data);
    } else if (file.name.toLowerCase().endsWith(".json")) {
      var enc = new TextDecoder("utf-8"); // TODO: How to detect file encoding better?

      const parsedContent: any = await file
        .arrayBuffer()
        .then((v) => JSON.parse(enc.decode(v)));

      const arrayData = findArray(parsedContent);

      if (arrayData) {
        data = jsonToTable(arrayData);
        setRows(data);
      } else {
        console.error("No array in JSON found");
      }
    } else {
      // Somehow-Separated text
      var enc = new TextDecoder("utf-8"); // TODO: How to detect file encoding better?

      const contentAsText: string = await file
        .arrayBuffer()
        .then((v) => enc.decode(v));
      const delimiter = detectDelimiter(contentAsText);
      data = parse(contentAsText, { delimiter });
      console.log(data);
      setRows(data);
    }

    const columnValueCounts = countValues(data);
    console.log(columnValueCounts);
    setcColumnValueCounts(columnValueCounts);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDragging(false);

    const files = e.dataTransfer ? [...e.dataTransfer.files] : [];

    console.log(files);
    if (files.length) {
      const firstFile = files[0];
      parseFile(firstFile);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || []);
    console.log("files:", files);

    e.preventDefault();
    e.stopPropagation();

    if (files.length) {
      const firstFile = files[0];
      parseFile(firstFile);
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // console.log("handleDragEnter", e);

    if (e.target !== drag.current) {
      setDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // console.log("handleDragLeave", e);

    if (e.target === drag.current) {
      setDragging(false);
    }
  };

  React.useEffect(() => {
    // @ts-ignore
    drop.current.addEventListener("dragover", handleDragOver);
    // @ts-ignore
    drop.current.addEventListener("drop", handleDrop);
    // @ts-ignore
    drop.current.addEventListener("dragenter", handleDragEnter);
    // @ts-ignore
    drop.current.addEventListener("dragleave", handleDragLeave);

    return () => {
      // @ts-ignore
      drop.current.removeEventListener("dragover", handleDragOver);
      // @ts-ignore
      drop.current.removeEventListener("drop", handleDrop);
      // @ts-ignore
      drop.current.removeEventListener("dragenter", handleDragEnter);
      // @ts-ignore
      drop.current.removeEventListener("dragleave", handleDragLeave);
    };
  }, []);

  const InitialUI = () => {
    return (
      <div className="w-4/6 max-w-2xl mx-auto my-24">
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-10 h-10 mb-3 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                ></path>
              </svg>
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Click to choose file</span> or
                drag and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                CSV, TSV, XLSX, JSON, LOG
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              onChange={handleFileSelected}
            />
          </label>
        </div>
      </div>
    );
  };

  const DataTable = (props: { rows: Array<Array<any>> }) => {
    // console.log(rows)
    return (
      <div className="h-full w-fit overflow-x-auto border-separate border border-gray-300 rounded-md shadow-sm ml-1 flex flex-col">
        <div
          className="overflow-y-auto bg-gray-200"
          style={{ scrollbarGutter: "stable" }}
        >
          <table className="table-fixed w-full text-left">
            <thead className="sticky top-0">
              <tr className="">
                {rows[0].map((v: string, vi: number) => {
                  return (
                    <th key={vi} className="p-0.5 font-normal">
                      {v}
                    </th>
                  );
                })}
              </tr>
            </thead>
          </table>
        </div>
        <div
          className="flex-1 overflow-y-auto"
          style={{ scrollbarGutter: "stable" }}
        >
          <table className="table-fixed w-full text-left">
            <tbody>
              {props.rows.slice(1).map((r, i) => {
                return (
                  <tr key={i} className="even:bg-gray-100 odd:bg-white">
                    {r.map((v, vi) => {
                      // Convert false,0 to string
                      const valueAsString = "" + v;
                      let valueCell;
                      if (v) {
                        valueCell = valueAsString;
                      } else {
                        if (v === "" || v === null || v === undefined) {
                          valueCell = (
                            <span className="text-gray-500 font-mono">
                              empty
                            </span>
                          );
                        } else {
                          valueCell = valueAsString;
                        }
                      }
                      return (
                        <td
                          key={vi}
                          title={
                            valueAsString.length > 5 ? valueAsString : undefined
                          }
                          className="p-0.5 text-xs overflow-hidden whitespace-nowrap text-ellipsis"
                        >
                          {valueCell}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <main ref={drop} className="h-screen p-2">
      <div className="mb-2">
        <span className="text-2xl">{currentFile?.name || ""} </span>
        <span className="text-gray-500 text-sm">
          {currentFile ? formatBytes(currentFile.size) : ""}
          {", "}
          {rows?.length ? `${rows.length - 1} rows` : ""}
        </span>
      </div>
      {rows?.length ? (
        <div className="flex flex-row h-[calc(100vh-60px)] overflow-clip">
          <ValuesInspector columnInfos={columnValueCounts}></ValuesInspector>
          <DataTable rows={rows}></DataTable>
        </div>
      ) : (
        <InitialUI></InitialUI>
      )}
    </main>
  );
}

function ValuesInspector(props: { columnInfos: ColumnInfos[] }) {
  const [openAccordions, setOpenAccordions] = React.useState<number[]>([]);
  // const [openAcc2, setOpenAcc2] = React.useState(true);
  // const [openAcc3, setOpenAcc3] = React.useState(true);

  // const handleOpenAcc1 = () => setOpenAcc1((cur) => !cur);
  // const handleOpenAcc2 = () => setOpenAcc2((cur) => !cur);
  // const handleOpenAcc3 = () => setOpenAcc3((cur) => !cur);

  const addOrRemove = (arr: any[], item: any) =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  return (
    <div className="w-96 flex flex-col gap-2 mb-2 overflow-y-auto">
      {props.columnInfos.map((column) => {
        const columnValues = orderBy(
          column.columnValues,
          ["valueCount", "valueName"],
          ["desc", "asc"]
        );
        return (
          <Accordion
            header={column.columnName}
            subHeader={`${columnValues.length}`}
            open={openAccordions.includes(column.columnIndex)}
            onClick={() => {
              setOpenAccordions(
                addOrRemove(openAccordions, column.columnIndex)
              );
            }}
            key={`${column.columnIndex}_${column.columnName}`}
          >
            <div className="py-1">
              {columnValues.map((colValue) => {
                return (
                  <div
                    key={`${column.columnIndex}_${colValue.valueName}`}
                    className="text-sm"
                  >
                    <a
                      href="#"
                      className={`text-blue-500 ${
                        colValue.valueName ? "" : "font-mono"
                      }`}
                    >
                      {colValue.valueName || "empty"}
                    </a>
                    <span className="text-gray-500">{` ${colValue.valueCount}`}</span>
                  </div>
                );
              })}
            </div>
          </Accordion>
        );
      })}
    </div>
  );
}

function formatBytes(bytes: number, dp = 1): string {
  const thresh = 1000;

  if (Math.abs(bytes) < thresh) {
    return bytes + " B";
  }

  const units = ["kB", "MB", "GB", "TB"];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(dp) + " " + units[u];
}

function detectDelimiter(input: string): string {
  const supportedDelimiters = [",", ";", "|", "\t"];
  const counts: Record<string, number> = {};
  for (const c of input) {
    if (supportedDelimiters.includes(c)) {
      counts[c] = (counts[c] || 0) + 1;
    }
  }
  console.log(counts);
  const maxEntry = maxBy(Object.entries(counts), (_) => _[1])!;
  console.log(maxEntry);
  return maxEntry[0];
}

type CountMap = Record<string, number>;

interface ColumnInfos {
  columnName: string;
  columnIndex: number;
  columnValues: ColumnValues[];
}

interface ColumnValues {
  valueName: string;
  valueCount: number;
}

function countValues(input: string[][]): ColumnInfos[] {
  const headers = input[0];

  const countsPerColumn: CountMap[] = headers.map((v, i) => ({}));

  input.forEach((row, rowIndex) => {
    if (rowIndex != 0) {
      // console.log(row);
      row.forEach((value, valueIndex) => {
        // const currentColumn = headers[valueIndex];
        countsPerColumn[valueIndex][value] =
          (countsPerColumn[valueIndex][value] || 0) + 1;
      });
    }
  });

  const columnInfos = countsPerColumn.map((v, i) => {
    const columnIndex = i;
    const columnName = headers[columnIndex];
    const columnValues = Object.entries(v).map((e) => ({
      valueName: e[0],
      valueCount: e[1],
    }));

    return {
      columnIndex,
      columnName,
      columnValues,
    };
  });

  return columnInfos;
}

function findArray(json: any) {
  // Check if the JSON object itself is an array
  if (Array.isArray(json)) {
    return json;
  }

  // Iterate over the properties of the JSON object
  for (let key in json) {
    if (json.hasOwnProperty(key)) {
      let value = json[key];
      // Check if the property is an array and has a length greater than 0
      if (Array.isArray(value) && value.length > 0) {
        return value;
      }
    }
  }

  // If no array with length > 0 is found, return null
  return null;
}

function jsonToTable(jsonArray: Array<any>) {
  // Helper function to flatten a nested object
  function flattenObject(obj: any, prefix = "") {
    return Object.keys(obj).reduce((acc, k) => {
      const pre = prefix.length ? prefix + "." : "";
      if (
        typeof obj[k] === "object" &&
        obj[k] !== null &&
        !Array.isArray(obj[k])
      ) {
        Object.assign(acc, flattenObject(obj[k], pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  }

  // Flatten all objects in the JSON array
  const flatArray = jsonArray.map((item) => flattenObject(item));

  // Create the header row
  const header = Array.from(
    new Set(flatArray.flatMap((item) => Object.keys(item)))
  );

  // Create the data rows
  const rows = flatArray.map((item) => header.map((h) => item[h] ?? ""));

  // Combine the header and data rows
  return [header, ...rows];
}
