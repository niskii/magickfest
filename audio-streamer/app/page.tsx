"use client";
import { Player } from "./components/player";
// const decoder = new OpusDecoderWebWorker();

// wait for the WASM to be compiled
// await decoder.ready;

export default function Page() {
  return (
    <div>
      <h1>Hello, Next.js!</h1>
      <Player></Player>
    </div>
  );
}
