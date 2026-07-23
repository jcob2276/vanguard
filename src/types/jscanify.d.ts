declare module 'jscanify/client' {
  interface Point { x: number; y: number }
  interface Corners {
    topLeftCorner: Point;
    topRightCorner: Point;
    bottomLeftCorner: Point;
    bottomRightCorner: Point;
  }
  export default class JScanify {
    extractPaper(
      image: HTMLImageElement | HTMLCanvasElement,
      width: number,
      height: number,
      corners?: Corners,
    ): HTMLCanvasElement | null;
  }
}
