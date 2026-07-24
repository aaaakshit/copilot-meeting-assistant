export class CaptureSessionGate {
  private generation = 0
  private active = false

  start(): number {
    this.generation += 1
    this.active = true
    return this.generation
  }

  stop(): void {
    this.generation += 1
    this.active = false
  }

  current(): number {
    return this.generation
  }

  accepts(generation: number): boolean {
    return this.active && generation === this.generation
  }
}
