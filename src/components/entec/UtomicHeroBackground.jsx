import { useEffect, useRef } from "react";

// Fundo animado GradientWave copiado da Hero do Utomic (junção/hero-shader.js).
// GLSL, paleta (#AEA6FB/#574ABC/#07003E), seed 50 e parâmetros originais
// preservados — NÃO recriar nem "melhorar". Adaptação mínima para React:
// canvas via ref + cleanup (rAF/listeners) no unmount.
const VSRC =
  "attribute vec2 p;varying vec2 v_uv;void main(){v_uv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}";

const FSRC = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
uniform vec3 u_colors[4];
uniform int u_colors_length;
uniform float u_waveSpeed;
uniform float u_waveFreqX;
uniform float u_waveFreqY;
uniform float u_waveAngle;
uniform float u_waveAmplitude;
uniform float u_maskSoftness;
uniform float u_blendAmount;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 hash(vec2 p){
  float s=u_seed;
  vec2 k1=vec2(2127.1+s*13.37,81.17+s*7.31);
  vec2 k2=vec2(1269.5+s*11.13,283.37+s*5.79);
  p=vec2(dot(p,k1),dot(p,k2));
  return fract(sin(p)*(43758.5453+s*1.618));
}
float noise(in vec2 p){
  vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);
  float n=mix(mix(dot(-1.0+2.0*hash(i),f),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),
              mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);
  return 0.5+0.5*n;
}
vec3 getColor(int idx){
  if(u_colors_length<1) return vec3(0.0);
  if (idx <= 0 || u_colors_length == 1) return u_colors[0];
  if (idx == 1 || u_colors_length == 2) return u_colors[1];
  if (idx == 2 || u_colors_length == 3) return u_colors[2];
  return u_colors[3];
}
float seedF(float base){return base*(1.0+0.5*sin(u_seed*3.17+base));}
vec2 warpUV(vec2 uv){
  float t=u_time*u_waveSpeed;
  float angleOffset=sin(u_seed*2.73)*30.0;
  mat2 dirRot=Rot(radians(u_waveAngle+angleOffset));
  vec2 ruv=dirRot*uv;
  float fxMod=seedF(u_waveFreqX);
  float fyMod=seedF(u_waveFreqY);
  float phaseX=fract(sin(u_seed*7.19)*437.58)*6.2832;
  float phaseY=fract(cos(u_seed*3.41)*291.37)*6.2832;
  float harmonic=sin(u_seed*1.23)*0.5;
  float a=fyMod*ruv.y-sin(ruv.x*fxMod+ruv.y-t+phaseX);
  a+=harmonic*sin(ruv.x*fxMod*2.0+ruv.y*0.5+t*0.7+phaseY);
  a=smoothstep(cos(a)*u_maskSoftness,sin(a)*u_maskSoftness+3.,cos(a-fyMod*ruv.y)-sin(a-fxMod*ruv.x));
  a*=u_waveAmplitude;
  uv=cos(a)*uv+sin(a)*vec2(-uv.y,uv.x);
  return uv;
}
void main(){
  vec2 fragCoord=v_uv*u_resolution;
  vec2 uv=fragCoord/u_resolution.xy;
  float ratio=u_resolution.x/u_resolution.y;
  float t=u_time*u_waveSpeed;
  vec2 tuv=uv-0.5;
  vec2 seedShift=vec2(sin(u_seed*4.37),cos(u_seed*5.91))*100.0;
  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)+seedShift);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*720.0+180.0));
  tuv.y*=ratio;
  vec2 uv2=(fragCoord*2.0-u_resolution.xy)/(u_resolution.x+u_resolution.y)*2.0;
  float preRotAngle=fract(sin(u_seed*5.63)*173.29)*6.2832;
  uv2*=Rot(preRotAngle);
  vec2 warped=warpUV(uv2)*0.5+0.5;
  vec2 blendUV=mix(tuv,warped-0.5,u_blendAmount);
  float layerRot1=-5.0+sin(u_seed*1.83)*20.0;
  float layerRot2=10.0+cos(u_seed*2.47)*20.0;
  vec3 c0=getColor(0);vec3 c1=getColor(1);vec3 c2=getColor(2);vec3 c3=getColor(3);
  vec3 layer1=mix(c0,c2,S(-0.3,0.3,(blendUV*Rot(radians(layerRot1))).x));
  vec3 layer2=mix(c3,c1,S(-0.3,0.3,(blendUV*Rot(radians(layerRot2))).x));
  vec3 col=mix(layer1,layer2,S(0.3,-0.3,blendUV.y));
  col=mix(col,col*col+0.5*sqrt(col),0.3);
  gl_FragColor=vec4(col,1.0);
}`;

export default function UtomicHeroBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return undefined;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VSRC));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FSRC));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = (n) => gl.getUniformLocation(prog, n);
    const uRes = U("u_resolution");
    const uTime = U("u_time");
    const uSeed = U("u_seed");
    const uCols = U("u_colors[0]");
    const uColsLen = U("u_colors_length");
    const uSpeed = U("u_waveSpeed");
    const uFX = U("u_waveFreqX");
    const uFY = U("u_waveFreqY");
    const uAng = U("u_waveAngle");
    const uAmp = U("u_waveAmplitude");
    const uSoft = U("u_maskSoftness");
    const uBlend = U("u_blendAmount");

    // Paleta da hero Utomic original (não os defaults do componente).
    const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
    const palette = ["#AEA6FB", "#574ABC", "#07003E", "#07003E"].map(hex).flat();
    gl.uniform3fv(uCols, new Float32Array(palette));
    gl.uniform1i(uColsLen, 3);
    gl.uniform1f(uSeed, 50);
    gl.uniform1f(uSpeed, 1);
    gl.uniform1f(uFX, 4);
    gl.uniform1f(uFY, 0.1);
    gl.uniform1f(uAng, 80);
    gl.uniform1f(uAmp, 1.5);
    gl.uniform1f(uSoft, 1.6);
    gl.uniform1f(uBlend, 0.9);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const r = canvas.parentElement.getBoundingClientRect();
      const w = Math.max(2, Math.round(r.width * dpr));
      const h = Math.max(2, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let raf = 0;
    const drawStatic = () => {
      resize();
      gl.uniform1f(uTime, 2.5);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const frame = (now) => {
      resize();
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const onResize = () => {
      if (reduce) drawStatic();
      else resize();
    };
    const onVisibility = () => {
      if (!document.hidden && !reduce) raf = requestAnimationFrame(frame);
    };

    if (reduce) {
      drawStatic();
      window.addEventListener("resize", onResize);
    } else {
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVisibility);
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <>
      <div className="ep-bg" aria-hidden="true" />
      <div className="ep-shader" aria-hidden="true">
        <canvas ref={canvasRef} />
      </div>
    </>
  );
}
