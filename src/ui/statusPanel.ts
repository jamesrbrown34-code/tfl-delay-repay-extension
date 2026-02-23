export class StatusPanel {
  constructor(private readonly container: HTMLElement) {}

  setStatus(message: string): void {
    this.container.innerHTML = `<p>${message}</p>`;
  }

  appendStatus(message: string): void {
    this.container.innerHTML += `<p>${message}</p>`;
  }
}
