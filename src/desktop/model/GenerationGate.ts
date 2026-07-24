export class GenerationGate {
  private generation = 0

  begin(): number {
    this.generation += 1
    return this.generation
  }

  cancel(): void {
    this.generation += 1
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation
  }
}
