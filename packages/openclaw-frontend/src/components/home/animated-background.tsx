'use client';

import React from 'react';

export function AnimatedBackground() {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            {/* Animated Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/40 rounded-full blur-[120px] animate-blob" />
            <div className="absolute top-[20%] right-[-5%] w-[35%] h-[35%] bg-indigo-500/40 rounded-full blur-[120px] animate-blob animation-delay-2000" />
            <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-purple-500/30 rounded-full blur-[120px] animate-blob animation-delay-4000" />

            {/* Grid/Mesh Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

            {/* Radial Gradient for depth - subtle vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,0,0)_0%,rgba(0,0,0,0.4)_100%)]" />
        </div>
    );
}
