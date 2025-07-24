import { description } from "@/constants"
import React from "react"
import "./styles.css"
import Link from "next/link"

// This file is a Next.js app router page.
// See: https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#pages
// The default export is the page component.

export const metadata = {
  title: "About | File Glance",
}

export default function Page() {
  return (
    <>
      <Link
        href="/"
        className="p-2 inline-flex items-center text-gray-600 hover:text-blue-900 font-medium no-underline hover:underline"
      >
        <svg
          className="w-4 h-4 mr-1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back
      </Link>
      <div className="max-w-2xl mx-auto px-4 mb-6">
        <h1 className="mt-4">About FileGlance</h1>
        <p>{description}</p>
        <h2>Why FileGlance?</h2>
        <b>Frustrated by:</b>
        <ol>
          <li>Needing different tools for different formats.</li>
          <li>Lack of tools optimized for quickly understanding data.</li>
          <li>Messy files that require cleaning before use.</li>
        </ol>
        <p>
          I built FileGlance as a side project and a fun way to learn React and
          Tailwind.
        </p>
        <p>Maybe it will help others, too.</p>
        <p className="mt-6 mb-1">It aims to be both:</p>
        <ul>
          <li>
            <strong>Simple:</strong> Just drag and drop a file; it automatically
            detects encoding, delimiter, headers, and more.
          </li>
          <li>
            <strong>Powerful:</strong> Run custom JavaScript to filter and
            transform data at scale.
          </li>
        </ul>

        <h2>Features</h2>
        <ul>
          <li>
            Drag-and-drop support for all common file types (CSV, XLSX, JSON,
            etc.)
          </li>
          <li>
            Automatic detection of file encoding, delimiters, and data location
          </li>
          <li>Optimized display (hides empty columns by default)</li>
          <li>Simple filtering with value facets for exact matches</li>
          <li>Full-text search across data</li>
          <li>Basic sorting functionality</li>
          <li>Advanced row filtering using custom JavaScript</li>
          <li>Advanced value transformation using custom JavaScript</li>
          <li>One-click export to CSV, XLSX, or JSON</li>
          <li>Handles large files with virtualized list rendering</li>
          <li>
            Visual representation of value counts (histograms for numeric data)
          </li>
          <li>Progressive Web App (PWA) support</li>
          <li>Privacy-focused: Your data never leaves your device</li>
        </ul>

        <h2>Use Cases</h2>
        <h4>Data Viewing & Exploration</h4>
        <p className="mb-1">
          View raw data and column types. Get visualizations for categorical and
          continuous data (histograms). For numeric values, see statistics like
          average, median, min, and max.{" "}
          <span style={{ whiteSpace: "nowrap" }}>Use it as:</span>
        </p>
        <ul>
          <li>Online CSV / TSV / Excel viewer</li>
          <li>
            See column stats like average, median, min, and max for numeric
            columns (e.g., &quot;Find the average order value in a sales
            CSV&quot;)
          </li>
          <li>
            Data type inspector (e.g., &quot;Quickly validate which columns are
            text, numbers, or dates&quot;)
          </li>
          <li>
            File converter (e.g., &quot;Convert an Excel file to CSV or JSON in
            one click&quot;)
          </li>
        </ul>
        <h4>Data Filtering & Cleaning</h4>
        <p className="mb-1">
          Apply quick filters with one click or use complex filter functions
          with custom JavaScript. For example:
        </p>
        <ul>
          <li>Remove empty rows or columns</li>
          <li>Trim whitespace from values</li>
          <li>Deduplicate based on specific columns</li>
          <li>Find unique values</li>
          <li>Replace missing values with defaults</li>
          <li>Detect and handle outliers</li>
        </ul>
        <h4>Data Transformation</h4>
        <p className="mb-1">
          Transform data using custom JavaScript functions. For example:
        </p>
        <ul>
          <li>Parse numbers from text</li>
          <li>Normalize text case (e.g., all lowercase)</li>
          <li>Split the domain from an email</li>
          <li>Format Unix timestamps to readable dates</li>
          <li>
            Merge similar categories (e.g., &quot;NY&quot; and &quot;New
            York&quot;)
          </li>
          <li>Export to CSV, JSON, Markdown etc.</li>
        </ul>
        <h2>Tech Stack & Code</h2>

        <p className="mt-2">
          FileGlance is built with TypeScript, Next.js/React, Tailwind CSS, and
          Recharts. It is open source under the AGPL license. Interested
          developers can find the full source code on GitHub:{" "}
          <a
            href="https://github.com/dell-mic/file-glance"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://github.com/dell-mic/file-glance
          </a>
        </p>
        <div className="flex justify-center mt-8">
          <Link href="/">
            <button className="text-2xl text-gray-700 font-medium m-4 py-2 px-8 rounded-sm transition-colors duration-200 cursor-pointer border border-gray-400 hover:bg-gray-100 bg-white outline-none focus:ring-2 focus:ring-blue-300">
              Try it out now
            </button>
          </Link>
        </div>
      </div>
    </>
  )
}
