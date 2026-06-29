"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/* ─────────────────────────────────────────────────────────────
   STOMACH — stylized bean with wireframe overlay
   ───────────────────────────────────────────────────────────── */
function Stomach() {
  const body = useRef<THREE.Mesh>(null);

  // gentle surface breathing
  useFrame((state) => {
    if (!body.current) return;
    const t = state.clock.getElapsedTime();
    const s = 1 + Math.sin(t * 1.1) * 0.012;
    body.current.scale.set(1.1 * s, 1.35 * s, 0.92 * s);
  });

  return (
    <group position={[0, 0.55, 0]}>
      {/* solid stomach */}
      <mesh ref={body}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial
          color="#FFC4C4"
          roughness={0.38}
          metalness={0.04}
          emissive="#FF9999"
          emissiveIntensity={0.07}
        />
      </mesh>

      {/* wireframe overlay — gives that medical-scan tech feel */}
      <mesh scale={[1.1, 1.35, 0.92]}>
        <sphereGeometry args={[1.003, 28, 22]} />
        <meshBasicMaterial
          color="#2563EB"
          wireframe
          transparent
          opacity={0.11}
        />
      </mesh>

      {/* esophagus stub (top) */}
      <mesh position={[-0.25, 1.55, 0]} rotation={[0, 0, 0.18]}>
        <cylinderGeometry args={[0.16, 0.2, 0.55, 32]} />
        <meshStandardMaterial color="#FFB3B3" roughness={0.42} />
      </mesh>

      {/* pylorus / duodenum start */}
      <mesh position={[0.95, -0.2, 0]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.17, 0.2, 0.5, 32]} />
        <meshStandardMaterial color="#FFB3B3" roughness={0.42} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   INTESTINES — coiled tube beneath the stomach
   ───────────────────────────────────────────────────────────── */
function Intestines() {
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    // connect from duodenum
    pts.push(new THREE.Vector3(1.15, -0.55, 0.0));
    pts.push(new THREE.Vector3(1.05, -0.95, 0.25));
    pts.push(new THREE.Vector3(0.6, -1.2, -0.25));
    // coiled small intestine
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const angle = t * Math.PI * 3.2 + Math.PI;
      const r = 0.85 - t * 0.15;
      pts.push(
        new THREE.Vector3(
          Math.cos(angle) * r,
          -1.35 - t * 0.22,
          Math.sin(angle) * r * 0.55
        )
      );
    }
    pts.push(new THREE.Vector3(-0.9, -1.85, 0.1));
    return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  }, []);

  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh ref={meshRef}>
      <tubeGeometry args={[curve, 200, 0.19, 18, false]} />
      <meshStandardMaterial
        color="#FFA8A8"
        roughness={0.45}
        metalness={0.04}
        emissive="#FF7D7D"
        emissiveIntensity={0.05}
      />
    </mesh>
  );
}

/* ─────────────────────────────────────────────────────────────
   AI SCAN RING — horizontal teal disc sweeping up/down
   ───────────────────────────────────────────────────────────── */
function ScanRing() {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) {
      ref.current.position.y = Math.sin(t * 0.45) * 2.0 + 0.1;
    }
    if (matRef.current) {
      matRef.current.opacity = 0.28 + Math.sin(t * 2.2) * 0.12;
    }
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.65, 0.02, 16, 96]} />
      <meshBasicMaterial
        ref={matRef}
        color="#0D9488"
        transparent
        opacity={0.3}
      />
    </mesh>
  );
}

/* ─────────────────────────────────────────────────────────────
   DETECTION POINT — pulsing blue beacon on the surface
   ───────────────────────────────────────────────────────────── */
function DetectionPoint({
  position,
  color = "#2563EB",
  delay = 0,
}: {
  position: [number, number, number];
  color?: string;
  delay?: number;
}) {
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime() + delay;
    if (core.current) {
      core.current.scale.setScalar(0.045 + Math.sin(t * 2.4) * 0.008);
    }
    if (halo.current && haloMat.current) {
      const s = ((t * 0.6) % 2) / 2; // 0..1
      halo.current.scale.setScalar(0.05 + s * 0.18);
      haloMat.current.opacity = 0.55 * (1 - s);
    }
  });

  return (
    <group position={position}>
      <mesh ref={core}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial ref={haloMat} color={color} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   ROOT SCENE — auto-rotating group
   ───────────────────────────────────────────────────────────── */
function OrganScene() {
  const group = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.22;
  });

  return (
    <group ref={group}>
      <Stomach />
      <Intestines />
      <DetectionPoint position={[0.55, 0.95, 0.92]}  color="#2563EB" delay={0}   />
      <DetectionPoint position={[-0.75, 0.35, 0.9]}  color="#14B8A6" delay={0.9} />
      <DetectionPoint position={[0.2, -1.25, 0.55]}  color="#0D9488" delay={1.8} />
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   PUBLIC COMPONENT
   ───────────────────────────────────────────────────────────── */
export default function Organ3D() {
  return (
    <Canvas
      camera={{ position: [0, 0.2, 5.8], fov: 42 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent" }}
    >
      {/* clinical lighting rig */}
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 4, 5]} intensity={0.9}  color="#ffffff" />
      <directionalLight position={[-4, 2, 3]} intensity={0.45} color="#BFD9FF" />
      <pointLight      position={[0, -3, 2]} intensity={0.35} color="#0D9488" />

      <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.35}>
        <OrganScene />
      </Float>

      <ScanRing />
    </Canvas>
  );
}
