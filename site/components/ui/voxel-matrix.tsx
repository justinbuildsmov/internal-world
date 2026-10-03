'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function CubeMatrix() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setIsDarkMode(mediaQuery.matches);
        const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let animationFrameId: number;
        let width = 0;
        let height = 0;

        const mouse = { x: -1000, y: -1000 };

        const handleResize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.scale(dpr, dpr);
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);

        let time = 0;

        const render = () => {
            time += 0.03;

            const bgColor = isDarkMode ? '#030712' : '#f8fafc';
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);

            const size = 28;
            const hSize = size * Math.sqrt(3) / 2;

            const cols = Math.ceil(width / (size * 1.5)) + 4;
            const rows = Math.ceil(height / (hSize * 2)) + 4;

            const drawCube = (x: number, y: number, elevation: number) => {
                const topY = y - elevation;

                // Palette definition
                const topColor = isDarkMode ? '#1e293b' : '#e2e8f0';
                const leftColor = isDarkMode ? '#0f172a' : '#cbd5e1';
                const rightColor = isDarkMode ? '#334155' : '#94a3b8';
                const accentTop = isDarkMode ? '#3b82f6' : '#2563eb';

                const isElevated = elevation > 10;

                // Top Face
                ctx.fillStyle = isElevated ? accentTop : topColor;
                ctx.beginPath();
                ctx.moveTo(x, topY - size / 2);
                ctx.lineTo(x + hSize, topY - size / 4);
                ctx.lineTo(x, topY);
                ctx.lineTo(x - hSize, topY - size / 4);
                ctx.closePath();
                ctx.fill();

                // Left Face
                ctx.fillStyle = leftColor;
                ctx.beginPath();
                ctx.moveTo(x - hSize, topY - size / 4);
                ctx.lineTo(x, topY);
                ctx.lineTo(x, topY + size / 2);
                ctx.lineTo(x - hSize, topY + size / 4);
                ctx.closePath();
                ctx.fill();

                // Right Face
                ctx.fillStyle = rightColor;
                ctx.beginPath();
                ctx.moveTo(x + hSize, topY - size / 4);
                ctx.lineTo(x, topY);
                ctx.lineTo(x, topY + size / 2);
                ctx.lineTo(x + hSize, topY + size / 4);
                ctx.closePath();
                ctx.fill();
            };

            for (let r = -2; r < rows; r++) {
                for (let c = -2; c < cols; c++) {
                    const x = c * size * 1.5;
                    const y = r * hSize * 2 + (c % 2 === 0 ? 0 : hSize);

                    const wave = Math.sin(c * 0.3 + r * 0.3 + time) * 8;

                    // Mouse proximity calculation
                    const dx = mouse.x - x;
                    const dy = mouse.y - y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    let mouseElevation = 0;
                    if (dist < 180) {
                        mouseElevation = (1 - dist / 180) * 35;
                    }

                    drawCube(x, y, wave + mouseElevation);
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isDarkMode]);

    return (
        <div className="relative w-full h-screen overflow-hidden select-none bg-slate-950">
            <canvas ref={canvasRef} className="absolute inset-0 block cursor-default" />

            <div className="relative z-10 flex h-full flex-col items-center justify-center text-center px-4 pointer-events-none mix-blend-difference text-white">
                <span className="font-mono text-xs tracking-widest uppercase mb-3 text-blue-400">
                </span>
                <h1 className="font-mono text-6xl md:text-9xl font-black tracking-tighter uppercase leading-none">
                    VOXEL
                </h1>
                <p className="mt-4 font-mono text-xs md:text-sm max-w-lg opacity-80">
                    Dynamic 3D voxel heightmap oscillating with continuous sine harmonics and mouse elevation fields.
                </p>
            </div>
        </div>
    );
}
