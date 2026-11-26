import FragmentShader from "./fragment-shader.frag?raw";
import VertexShader from "./vertex-shader.vert?raw";

export class WebGLRenderer {
    #canvas: OffscreenCanvas = null;
    #ctx: WebGL2RenderingContext = null;
    #shaderProgram: WebGLProgram = null;

    constructor(canvas: OffscreenCanvas) {
        this.#canvas = canvas;
        // TODO: check for support to select an appropriate renderer.
        const gl = (this.#ctx = canvas.getContext("webgl2"));

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, VertexShader);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            throw gl.getShaderInfoLog(vertexShader);
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, FragmentShader);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw gl.getShaderInfoLog(fragmentShader);
        }

        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            throw gl.getProgramInfoLog(shaderProgram);
        }
        gl.useProgram(shaderProgram);

        this.#shaderProgram = shaderProgram;

        // Vertex coordinates, clockwise from bottom-left.
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1.0, -1.0, -1.0, +1.0, +1.0, +1.0, +1.0, -1.0]),
            gl.STATIC_DRAW,
        );

        const xyLocation = gl.getAttribLocation(shaderProgram, "xy");
        gl.vertexAttribPointer(xyLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(xyLocation);

        // Create one texture to upload frames to.
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    draw(frame: VideoFrame) {
        this.#canvas.width = frame.displayWidth;
        this.#canvas.height = frame.displayHeight;

        const gl = this.#ctx;
        gl.uniform1f(
            gl.getUniformLocation(this.#shaderProgram, "uTime"),
            performance.now(),
        );

        // Upload the frame.
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            frame,
        );
        frame.close();

        // Configure and clear the drawing area.
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(1.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Draw the frame.
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }
}
