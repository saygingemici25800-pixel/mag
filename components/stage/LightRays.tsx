"use client";

import { useEffect, useRef } from "react";

interface Props {
  /** Stage'in her karede opaklık yazdığı katman referansı */
  bind: (el: HTMLElement | null) => void;
}

/**
 * Tepedeki asılı diskten ürünün üstüne düşen ışık konisi (WebGL). .room'un üstünde, ürün alanının altında.
 * Opaklık Stage.render'da (raysO); 0.01'in altındayken çizim yapılmaz.
 */
export default function LightRays({ bind }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) {
      container.removeChild(canvas);
      return;
    }
    const VS =
      "attribute vec2 position;varying vec2 vUv;void main(){vUv=position*0.5+0.5;gl_Position=vec4(position,0.0,1.0);}";
    const FS =
      "precision highp float;uniform float iTime;uniform vec2 iResolution;uniform vec2 rayPos;uniform vec2 rayDir;" +
      "uniform vec3 raysColor;uniform float raysSpeed;uniform float lightSpread;uniform float rayLength;uniform float fadeDistance;" +
      "uniform vec2 mousePos;uniform float mouseInfluence;uniform float noiseAmount;" +
      "float noise(vec2 st){return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123);}" +
      "float rayStrength(vec2 src,vec2 refDir,vec2 coord,float seedA,float seedB,float speed){" +
      " vec2 s2c=coord-src;vec2 dn=normalize(s2c);float cosA=dot(dn,refDir);" +
      " float spread=pow(max(cosA,0.0),1.0/max(lightSpread,0.001));" +
      " float d=length(s2c);float maxD=iResolution.x*rayLength;float lf=clamp((maxD-d)/maxD,0.0,1.0);" +
      " float ff=clamp((iResolution.x*fadeDistance-d)/(iResolution.x*fadeDistance),0.5,1.0);" +
      " float base=clamp((0.45+0.15*sin(cosA*seedA+iTime*speed))+(0.3+0.2*cos(-cosA*seedB+iTime*speed)),0.0,1.0);" +
      " return base*lf*ff*spread;}" +
      "void main(){vec2 coord=vec2(gl_FragCoord.x,iResolution.y-gl_FragCoord.y);" +
      " vec2 dir=rayDir;if(mouseInfluence>0.0){vec2 mp=mousePos*iResolution.xy;vec2 md=normalize(mp-rayPos);dir=normalize(mix(rayDir,md,mouseInfluence));}" +
      " float r1=rayStrength(rayPos,dir,coord,36.2214,21.11349,1.5*raysSpeed);" +
      " float r2=rayStrength(rayPos,dir,coord,22.3991,18.0234,1.1*raysSpeed);" +
      " float v=r1*0.5+r2*0.4;" +
      " if(noiseAmount>0.0){float n=noise(coord*0.01+iTime*0.1);v*=(1.0-noiseAmount+noiseAmount*n);}" +
      " float b=1.0-(coord.y/iResolution.y);v*=0.12+b*0.88;" +
      " gl_FragColor=vec4(clamp(raysColor*v*1.7,0.0,1.0),1.0);}";
    function sh(t: number, src: string): WebGLShader | null {
      const h = gl!.createShader(t);
      if (!h) return null;
      gl!.shaderSource(h, src);
      gl!.compileShader(h);
      return gl!.getShaderParameter(h, gl!.COMPILE_STATUS) ? h : null;
    }
    const vs = sh(gl.VERTEX_SHADER, VS),
      fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    const pr = gl.createProgram();
    gl.attachShader(pr, vs);
    gl.attachShader(pr, fs);
    gl.linkProgram(pr);
    gl.useProgram(pr);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const q = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, q);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const pl = gl.getAttribLocation(pr, "position");
    gl.enableVertexAttribArray(pl);
    gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
    const U: Record<string, WebGLUniformLocation | null> = {};
    [
      "iTime",
      "iResolution",
      "rayPos",
      "rayDir",
      "raysColor",
      "raysSpeed",
      "lightSpread",
      "rayLength",
      "fadeDistance",
      "mousePos",
      "mouseInfluence",
      "noiseAmount",
    ].forEach((n) => {
      U[n] = gl.getUniformLocation(pr, n);
    });
    gl.uniform3f(U.raysColor, 1.0, 0.8, 0.52);
    gl.uniform1f(U.raysSpeed, 0.55);
    gl.uniform1f(U.lightSpread, 0.55);
    gl.uniform1f(U.rayLength, 1.1);
    gl.uniform1f(U.fadeDistance, 1.0);
    gl.uniform1f(U.mouseInfluence, 0.07);
    gl.uniform1f(U.noiseAmount, 0.06);
    let W = 1,
      H = 1;
    const mouse = { x: 0.5, y: 0.5 },
      sm = { x: 0.5, y: 0.5 };
    /* Yarı çözünürlük: tampon = CSS boyutu × res (0.75); kare süresi >16 ms olursa kalıcı 0.5. CSS canvas'ı %100'e ölçekler. */
    let res = 0.75;
    function place() {
      W = Math.max(1, Math.floor(container!.clientWidth * res));
      H = Math.max(1, Math.floor(container!.clientHeight * res));
      canvas.width = W;
      canvas.height = H;
      gl!.viewport(0, 0, W, H);
      gl!.uniform2f(U.iResolution, W, H);
      gl!.uniform2f(U.rayPos, 0.5 * W, 0.03 * H);
      gl!.uniform2f(U.rayDir, 0, 1);
    }
    place();
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX / window.innerWidth;
      mouse.y = e.clientY / window.innerHeight;
    };
    window.addEventListener("resize", place);
    window.addEventListener("mousemove", onMove);
    let raf = 0;
    let lastT = 0,
      acc = 0,
      n = 0;
    const loop = (t: number) => {
      if (parseFloat(container!.style.opacity || "0") > 0.01) {
        if (lastT && res > 0.5) {
          acc += t - lastT;
          n++;
          if (n >= 60) {
            if (acc / n > 16) {
              res = 0.5;
              place();
            }
            acc = 0;
            n = 0;
          }
        }
        lastT = t;
        sm.x = sm.x * 0.92 + mouse.x * 0.08;
        sm.y = sm.y * 0.92 + mouse.y * 0.08;
        gl!.uniform1f(U.iTime, t * 0.001);
        gl!.uniform2f(U.mousePos, sm.x, sm.y);
        gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      } else lastT = 0;
      raf = requestAnimationFrame(loop);
    };
    loop(0);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("mousemove", onMove);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, []);

  return (
    <div
      className="rays"
      aria-hidden="true"
      ref={(el) => {
        ref.current = el;
        bind(el);
      }}
    />
  );
}
