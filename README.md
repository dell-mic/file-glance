# [FileGlance](https://www.fileglance.info/)

_Simple, privacy-friendly tool for working with tabular data of any format: CSV/JSON/XLSX etc._

Try the deployed version at [FileGlance.info](https://www.fileglance.info/)

## Features

- Drag & drop support for the most commons file types and formats
- Automatic detection of encoding and delimiters
- Opinionated display (empty columns are hidden by default)
- Preview all counts for distinct values
- Simple filtering via value facets for exact matches
- Search through all data
- Basic sorting
- Powerful value transformation by applying arbitrary JavaScript
- Export to CSV/XLSX/JSON with one click
- Handles larger(ish) files thanks to virtualized list rendering

## Roadmap

- Proper handling numeric values
- Visual presentation of value counts (esp. numeric)
- Support even more file formats
- Advanced manipulation like renaming columns / adding new ones (based on transformers)
- Allow overriding detected encoding and delimiter
- More settings for export
- PWA

## Out of Scope

- Any kind of server processing
- Mobile/touch optimizations
- Support for older browsers
- Very large files (for files bigger than several GBs the browser is probably not the right tool)

## Development

```bash
npm install
npm run dev
```

### Tech Stack

- TypeScript
- NextJS / React
- Tailwind
