attribute vec2 xy;

varying highp vec2 uv;

void main(void) {
    gl_Position = vec4(xy, 0.0, 1.0);
    uv = vec2((1.0 + xy.x) / 2.0, (1.0 - xy.y) / 2.0);
}