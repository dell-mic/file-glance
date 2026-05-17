declare module "seek-bzip" {
  interface Bunzip {
    decode(
      input: Uint8Array,
      output?: number | Uint8Array,
      multistream?: boolean,
    ): Uint8Array
  }

  const Bunzip: Bunzip
  export default Bunzip
}
