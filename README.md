# [FileGlance](https://www.fileglance.info/)

<p align="center">

_Simple, privacy-friendly tool for working with tabular data in various formats: CSV, JSON, XLSX, and more._

![Screen Recording](./recoding.gif)

</p>

Try the live version at [FileGlance.info](https://www.fileglance.info/)

## Features

- Drag-and-drop support for common file types and formats
- Automatic detection of file encoding, delimiters, data location etc.
- Optimized display (hides empty columns by default)
- Count previews for distinct values
- Simple filtering with value facets for exact matches
- Full-text search across data
- Basic sorting functionality
- Advanced row filtering using own JavaScript
- Advanced value transformation using own JavaScript
- One-click export to CSV, XLSX, or JSON
- Supports larger files through virtualized list rendering
- Visual representation of value counts (histogram for numeric data)
- Progressive Web App (PWA) support
- Privacy-focused: Your data never leaves your device

## Roadmap

- Support for additional file formats
- Advanced data manipulation, including column renaming and custom transformations
- Options to override detected encoding and delimiters
- More export settings

## Out of Scope

- Spreadsheet-like editing single cells
- Server-side processing
- Mobile and touch optimizations
- Support for legacy browsers
- Handling very large files (e.g., files larger than several GBs may be better managed outside the browser)

## Development

```bash
npm install
npm run dev
```

### Tech Stack

- TypeScript
- Next.js / React
- Tailwind CSS
