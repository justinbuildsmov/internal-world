"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { elevColor, errorColor, voxelHeight, type Mode, type Stop } from "@/lib/world";

export type Hover = { i: number; j: number; x: number; y: number } | null;

type Props = {
  rows: number;
  cols: number;
  elev: (number | null)[] | null; // selected model's answers
  truth: number[] | null;
  mode: Mode;
  stops: Stop[];
  onHover?: (h: Hover) => void;
};

const GAP = 0.86;          // cube footprint; the rest is the dark seam between voxels
const SWEEP = 0.006;       // seconds of delay per column → a west-to-east morph wave
const LIFT_R = 9;          // hover lift radius, in cells
const LIFT_H = 3.2;        // hover lift height at the center

/**
 * The Earth as 16,200 voxels (one per 2° cell), height = elevation.
 * One InstancedMesh; matrices are written straight into the instance buffer
 * every frame so model switches morph and the cursor raises the ground.
 */
export default function VoxelWorld({ rows, cols, elev, truth, mode, stops, onHover }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setTarget: (h: Float32Array, c: Float32Array) => void;
  } | null>(null);
  const hoverCb = useRef(onHover);
  hoverCb.current = onHover;

  useEffect(() => {
    const mount = mountRef.current!;
    const n = rows * cols;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x05070c, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1f2a, 1.15));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.9);
    sun.position.set(-60, 140, 90);
    scene.add(sun);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = 1.25;
    controls.minZoom = 0.8;
    controls.maxZoom = 8;
    controls.zoomSpeed = 0.8;
    controls.rotateSpeed = 0.5;
    // Start looking north from above the southern ocean, a little turned.
    const dist = 400, polar = 0.88, azim = -0.32;
    camera.position.set(
      dist * Math.sin(polar) * Math.sin(azim),
      dist * Math.cos(polar),
      dist * Math.sin(polar) * Math.cos(azim),
    );
    controls.target.set(0, 0, 0);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0); // base sits on y=0, scale.y = height
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const cur = new Float32Array(n).fill(0.12);
    const prev = new Float32Array(n).fill(0.12);
    let target: Float32Array = new Float32Array(n).fill(0.12);
    let targetColor: Float32Array = new Float32Array(n * 3).fill(0.12);
    const colApplied = new Uint8Array(cols).fill(1);
    let switchAt = 0;

    const m = mesh.instanceMatrix.array as Float32Array;
    for (let k = 0; k < n; k++) {
      const i = Math.floor(k / cols), j = k % cols;
      const o = k * 16;
      m[o] = GAP; m[o + 5] = cur[k]; m[o + 10] = GAP; m[o + 15] = 1;
      m[o + 12] = j - cols / 2 + 0.5;
      m[o + 14] = i - rows / 2 + 0.5;
    }

    api.current = {
      setTarget(h, c) {
        prev.set(target);
        target = h;
        targetColor = c;
        colApplied.fill(0);
        switchAt = performance.now() / 1000;
      },
    };

    // Fit the whole world in view, whatever the window shape.
    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      const aspect = w / h;
      const half = aspect > 1.6 ? 58 : 105 / aspect;
      // On wide screens, nudge the world right and down so the title has room.
      const sx = aspect > 1.2 ? half * aspect * 0.1 : 0, sy = aspect > 1.2 ? half * 0.1 : 0;
      camera.left = -half * aspect - sx; camera.right = half * aspect - sx;
      camera.top = half + sy; camera.bottom = -half + sy;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // Hover: find the grid cell under the cursor.
    const ray = new THREE.Raycaster();
    const top = new THREE.Plane(new THREE.Vector3(0, 1, 0), -20); // above the tallest column + hover lift
    const hit = new THREE.Vector3();
    const ndc = new THREE.Vector2();
    let hoverI = -1, hoverJ = -1, lift = 0;
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      // March the ray down through the columns and stop at the first one it
      // actually touches, so tall cubes and the far edge pick the cube you see
      // (a flat sea-level plane picked cells behind them).
      if (ray.ray.intersectPlane(top, hit)) {
        const d = ray.ray.direction;
        const step = 0.15 / Math.hypot(d.x, d.z, d.y);
        for (let t = 0; hit.y + d.y * t > -0.01; t += step) {
          const x = hit.x + d.x * t, y = hit.y + d.y * t, z = hit.z + d.z * t;
          const j = Math.floor(x + cols / 2), i = Math.floor(z + rows / 2);
          if (i < 0 || i >= rows || j < 0 || j >= cols) continue;
          if (y <= cur[i * cols + j]) {
            hoverI = i; hoverJ = j;
            hoverCb.current?.({ i, j, x: e.clientX - r.left, y: e.clientY - r.top });
            return;
          }
        }
      }
      hoverI = -1;
      hoverCb.current?.(null);
    };
    const onLeave = () => { hoverI = -1; hoverCb.current?.(null); };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    const col = mesh.instanceColor.array as Float32Array;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      const now = performance.now() / 1000;
      lift += ((hoverI >= 0 ? 1 : 0) - lift) * 0.12;
      let colorsDirty = false;

      for (let j = 0; j < cols; j++) {
        const started = now >= switchAt + j * SWEEP;
        if (started && !colApplied[j]) {
          for (let i = 0; i < rows; i++) {
            const k3 = (i * cols + j) * 3;
            col[k3] = targetColor[k3]; col[k3 + 1] = targetColor[k3 + 1]; col[k3 + 2] = targetColor[k3 + 2];
          }
          colApplied[j] = 1;
          colorsDirty = true;
        }
        const dj = j - hoverJ;
        for (let i = 0; i < rows; i++) {
          const k = i * cols + j;
          let want = started ? target[k] : prev[k];
          if (lift > 0.01 && hoverI >= 0) {
            const di = i - hoverI;
            const d = Math.sqrt(di * di + dj * dj);
            if (d < LIFT_R) { const f = 1 - d / LIFT_R; want += f * f * LIFT_H * lift; }
          }
          const h = cur[k] + (want - cur[k]) * 0.14;
          cur[k] = h;
          m[k * 16 + 5] = h;
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (colorsDirty) mesh.instanceColor!.needsUpdate = true;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      controls.dispose();
      geo.dispose(); mat.dispose(); renderer.dispose();
      mount.removeChild(renderer.domElement);
      api.current = null;
    };
  }, [rows, cols]);

  // Recompute heights + colors whenever the model or mode changes; the loop morphs to them.
  useEffect(() => {
    if (!api.current || !truth) return;
    const src = mode === "real" ? truth : elev;
    if (!src) return;
    const n = rows * cols;
    const h = new Float32Array(n), c = new Float32Array(n * 3);
    const tmp = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const z = src[k];
      h[k] = voxelHeight(z);
      let rgb: [number, number, number];
      if (z == null) rgb = [40, 44, 52];
      else if (mode === "error") rgb = errorColor(z - truth[k]);
      else rgb = elevColor(z, stops);
      tmp.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
      c[k * 3] = tmp.r; c[k * 3 + 1] = tmp.g; c[k * 3 + 2] = tmp.b;
    }
    api.current.setTarget(h, c);
  }, [elev, truth, mode, stops, rows, cols]);

  return <div ref={mountRef} className="absolute inset-0" />;
}
