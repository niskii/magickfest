import type { ShallowRef } from "vue";

export class Oscilloscope {
  #canvascontext: CanvasRenderingContext2D;
  #canvas: ShallowRef<HTMLCanvasElement>;
  #analyser: AnalyserNode;

  #bufferLength = 0;
  #dataArray: Uint8Array<ArrayBuffer>;

  lineColor: string = "#fff";
  backgroundColor: string = "#000";
  lineWidth: number = 2;

  constructor(
    canvas: ShallowRef<HTMLCanvasElement>,
    analyser?: AnalyserNode,
    fftSize?: number,
  ) {
    this.#canvas = canvas;
    this.#canvascontext = canvas.value.getContext("2d", {
      willReadFrequently: true,
    });

    if (analyser) this.setAnalyzer(analyser, fftSize);
  }

  setAnalyzer(analyser: AnalyserNode, fftSize?: number) {
    this.#analyser = analyser;
    this.setfftSize(fftSize);
  }

  setfftSize(fftSize: number) {
    if (this.#analyser === undefined) return;
    const powered = Math.min(Math.max(32, Math.pow(2, fftSize)), 32768);

    this.#analyser.fftSize = powered;
    this.#bufferLength = this.#analyser.frequencyBinCount;
    this.#dataArray = new Uint8Array(this.#bufferLength);
    this.#analyser.getByteTimeDomainData(this.#dataArray);
  }

  draw() {
    this.#analyser.getByteTimeDomainData(this.#dataArray);

    this.#canvascontext.fillStyle = this.backgroundColor;
    this.#canvascontext.clearRect(
      0,
      0,
      this.#canvas.value.width,
      this.#canvas.value.height,
    );

    this.#canvascontext.lineWidth = this.lineWidth;
    this.#canvascontext.strokeStyle = this.lineColor;

    this.#canvascontext.beginPath();

    const sliceWidth = (this.#canvas.value.width * 1.0) / this.#bufferLength;
    const inverseHeight = this.#canvas.value.height / 2;
    let x = 0;

    for (let i = 0; i < this.#bufferLength; i++) {
      const v = this.#dataArray[i] * 0.0078125;
      const y = v * inverseHeight;

      if (i === 0) {
        this.#canvascontext.moveTo(x, y);
      } else {
        this.#canvascontext.lineTo(x, y);
      }

      x += sliceWidth;
    }

    this.#canvascontext.lineTo(
      this.#canvas.value.width,
      this.#canvas.value.height / 2,
    );

    this.#canvascontext.stroke();
  }
}
