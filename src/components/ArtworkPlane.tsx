import { useTexture } from '@react-three/drei';
import { DoubleSide } from 'three';

interface ArtworkPlaneProps {
  url: string;
  widthM: number;
  heightM: number;
  z: number;
  castShadow?: boolean;
  cutout?: boolean;
  rotationDeg?: number;
}

export function ArtworkPlane({ url, widthM, heightM, z, castShadow, cutout, rotationDeg = 0 }: ArtworkPlaneProps) {
  const texture = useTexture(url);
  const swapped = rotationDeg === 90 || rotationDeg === 270;
  const geomW = swapped ? heightM : widthM;
  const geomH = swapped ? widthM : heightM;

  return (
    <mesh position={[0, 0, z]} rotation={[0, 0, (rotationDeg * Math.PI) / 180]} receiveShadow castShadow={castShadow}>
      <planeGeometry args={[geomW, geomH]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.9}
        transparent={cutout}
        alphaTest={cutout ? 0.5 : undefined}
        side={cutout ? DoubleSide : undefined}
      />
    </mesh>
  );
}
