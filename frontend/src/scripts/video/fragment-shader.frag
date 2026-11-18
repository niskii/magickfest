precision mediump float;

varying highp vec2 uv;

uniform float uTime;
uniform sampler2D texture;

float hash(vec3 p3){
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3,p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(vec3 x){
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0, 0, 0)), 
               hash(i+vec3(1, 0, 0)),f.x),
               mix(hash(i+vec3(0, 1, 0)), 
               hash(i+vec3(1, 1, 0)),f.x),f.y),
               mix(mix(hash(i+vec3(0, 0, 1)), 
               hash(i+vec3(1, 0, 1)),f.x),
               mix(hash(i+vec3(0, 1, 1)), 
               hash(i+vec3(1, 1, 1)),f.x),f.y),f.z);
}

float grain_source(vec3 x, float strength, float pitch){
    float center = noise(x);
    float v1 = center - noise(vec3( 1, 0, 0)/pitch + x) + 0.5;
    float v2 = center - noise(vec3( 0, 1, 0)/pitch + x) + 0.5;
    float v3 = center - noise(vec3(-1, 0, 0)/pitch + x) + 0.5;
    float v4 = center - noise(vec3( 0,-1, 0)/pitch + x) + 0.5;
    
    float total = (v1 + v2 + v3 + v4) / 4.0;
    return mix(1.0, 0.5 + total, strength);
}

void main(void) {

    float t = uTime;
    vec2 x = gl_FragCoord.xy;

    vec3 color = texture2D(texture, uv).rgb;
    vec3 grain = vec3(0);

    const float grain_strength = 1.0;
    const float grain_rate = 1.0;
    // Range: [0.5, 1.0].
    const float grain_pitch = 1.0;
        
    float rg = grain_source(vec3(x, floor(grain_rate*(t))),     grain_strength, grain_pitch);
    float gg = grain_source(vec3(x, floor(grain_rate*(t+9.0))), grain_strength, grain_pitch);
    float bg = grain_source(vec3(x, floor(grain_rate*(t-9.0))), grain_strength, grain_pitch);

    const float color_level = 1.0;
    vec3 color_grain = vec3(rg, gg, bg);
    color_grain = mix(vec3(dot(color_grain, vec3(0.2126, 0.7152, 0.0722))), color_grain, color_level);
    grain = color_grain;

    const float grain_lift_ratio = 0.5;
    color = max(mix(color*grain, color+(grain-1.0), grain_lift_ratio), 0.0);

    gl_FragColor.rgb = color;
}