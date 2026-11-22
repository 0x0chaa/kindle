declare module "solc" {
  const solc: {
    compile(input: string, options?: unknown): string;
    version(): string;
  };
  export default solc;
}
