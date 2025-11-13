import React, { useMemo, useEffect, Suspense } from 'react'
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { shaderMaterial, useTrailTexture } from '@react-three/drei'
import { useTheme } from '../../contexts/ThemeContext'
import * as THREE from 'three'

const DotMaterial = shaderMaterial(
  {
    time: 0,
    resolution: new THREE.Vector2(),
    dotColor: new THREE.Color('#FFFFFF'),
    bgColor: new THREE.Color('#121212'),
    mouseTrail: null,
    render: 0,
    rotation: 0,
    gridSize: 50,
    dotOpacity: 0.05
  },
  /* glsl */ `
    void main() {
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  /* glsl */ `
    uniform float time;
    uniform int render;
    uniform vec2 resolution;
    uniform vec3 dotColor;
    uniform vec3 bgColor;
    uniform sampler2D mouseTrail;
    uniform float rotation;
    uniform float gridSize;
    uniform float dotOpacity;

    vec2 rotate(vec2 uv, float angle) {
        float s = sin(angle);
        float c = cos(angle);
        mat2 rotationMatrix = mat2(c, -s, s, c);
        return rotationMatrix * (uv - 0.5) + 0.5;
    }

    vec2 coverUv(vec2 uv) {
      vec2 s = resolution.xy / max(resolution.x, resolution.y);
      vec2 newUv = (uv - 0.5) * s + 0.5;
      return clamp(newUv, 0.0, 1.0);
    }

    float sdfCircle(vec2 p, float r) {
        return length(p - 0.5) - r;
    }

    void main() {
      vec2 screenUv = gl_FragCoord.xy / resolution;
      vec2 uv = coverUv(screenUv);

      vec2 rotatedUv = rotate(uv, rotation);

      // Create a grid
      vec2 gridUv = fract(rotatedUv * gridSize);
      vec2 gridUvCenterInScreenCoords = rotate((floor(rotatedUv * gridSize) + 0.5) / gridSize, -rotation);

      // Calculate distance from the center of each cell
      float baseDot = sdfCircle(gridUv, 0.25);

      // Screen mask - make it visible across entire screen
      float screenMask = 1.0; // Always visible across entire screen
      vec2 centerDisplace = vec2(0.5, 0.5); // Center of screen
      float circleMaskCenter = length(uv - centerDisplace);
      float circleMaskFromCenter = 1.0; // Always visible
      
      float combinedMask = 1.0; // Full visibility
      float circleAnimatedMask = sin(time * 2.0 + circleMaskCenter * 10.0);

      // Mouse trail effect
      float mouseInfluence = texture2D(mouseTrail, gridUvCenterInScreenCoords).r;
      
      float scaleInfluence = max(mouseInfluence * 0.5, circleAnimatedMask * 0.3);

      // Create dots with consistent size across screen
      float dotSize = 0.25; // Consistent dot size

      float sdfDot = sdfCircle(gridUv, dotSize * (1.0 + scaleInfluence * 0.5));

      float smoothDot = smoothstep(0.05, 0.0, sdfDot);

      float opacityInfluence = max(mouseInfluence * 50.0, circleAnimatedMask * 0.5);

      // Mix background color with dot color, using animated opacity to increase visibility
      vec3 composition = mix(bgColor, dotColor, smoothDot * combinedMask * dotOpacity * (1.0 + opacityInfluence));

      gl_FragColor = vec4(composition, 1.0);
    }
  `
)

function Scene() {
  const size = useThree((s) => s.size)
  const viewport = useThree((s) => s.viewport)
  const { resolvedTheme } = useTheme()
  
  const rotation = 0
  const gridSize = 100

  const getThemeColors = () => {
    switch (resolvedTheme) {
      case 'dark':
        return {
          dotColor: '#FFFFFF',
          bgColor: '#121212',
          dotOpacity: 0.002 // Reduced by 0.03 (from 0.005, minimum threshold)
        }
      case 'light':
        return {
          dotColor: '#9CA3AF', // Medium gray for better visibility
          bgColor: '#FAFAFA', // Slightly darker than white for contrast
          dotOpacity: 0.06 // Reduced by 0.03 (from 0.09)
        }
      default:
        return {
          dotColor: '#FFFFFF',
          bgColor: '#121212',
          dotOpacity: 0.002
        }
    }
  }

  const themeColors = getThemeColors()

  const [trail, onMove] = useTrailTexture({
    size: 512,
    radius: 0.1,
    maxAge: 400,
    interpolate: 1,
    ease: function easeInOutCirc(x: number) {
      return x < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2
    }
  })

  const dotMaterial = useMemo(() => {
    return new DotMaterial()
  }, [])

  useEffect(() => {
    dotMaterial.uniforms.dotColor.value.setHex(themeColors.dotColor.replace('#', '0x'))
    dotMaterial.uniforms.bgColor.value.setHex(themeColors.bgColor.replace('#', '0x'))
    dotMaterial.uniforms.dotOpacity.value = themeColors.dotOpacity
  }, [resolvedTheme, dotMaterial, themeColors])

  useFrame((state) => {
    dotMaterial.uniforms.time.value = state.clock.elapsedTime
  })

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    onMove(e)
  }

  const scale = Math.max(viewport.width, viewport.height) / 2

  return (
    <mesh scale={[scale, scale, 1]} onPointerMove={handlePointerMove}>
      <planeGeometry args={[2, 2]} />
      <primitive
        object={dotMaterial}
        resolution={[size.width * viewport.dpr, size.height * viewport.dpr]}
        rotation={rotation}
        gridSize={gridSize}
        mouseTrail={trail}
        render={0}
      />
    </mesh>
  )
}

export const DotScreenShader = () => {
  // Check if WebGL is available
  const [webglAvailable, setWebglAvailable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setWebglAvailable(!!gl);
    } catch (e) {
      setWebglAvailable(false);
      setError('WebGL not available');
    }
  }, []);

  if (!webglAvailable || error) {
    // Fallback: return empty div if WebGL is not available
    return <div style={{ width: '100%', height: '100%' }} />;
  }

  return (
    <Suspense fallback={<div style={{ width: '100%', height: '100%' }} />}>
      <ErrorBoundary fallback={<div style={{ width: '100%', height: '100%' }} />}>
        <Canvas
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            outputColorSpace: THREE.SRGBColorSpace,
            toneMapping: THREE.NoToneMapping,
            alpha: true
          }}
          dpr={[1, 2]}
          style={{ width: '100%', height: '100%' }}
          onCreated={(state) => {
            // Ensure WebGL context is properly initialized
            if (!state.gl) {
              console.error('WebGL context not available');
            }
          }}
          onError={(error) => {
            console.error('Canvas error:', error);
            setError(error.message || 'Canvas initialization failed');
          }}>
          <Scene />
        </Canvas>
      </ErrorBoundary>
    </Suspense>
  )
}

// Simple Error Boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

