import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !scrollContentRef.current) return;

    // --- 1. INITIALIZE SMOOTH SCROLLING (LENIS) ---
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
    } as any);

    function raf(time: number) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    const rafId = requestAnimationFrame(raf);

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // --- 2. THREE.JS SCENE SETUP ---
    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060608, 0.04);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 8, 12);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Set output encoding properly for newer three.js
    if ((THREE as any).sRGBEncoding) {
        renderer.outputColorSpace = (THREE as any).sRGBEncoding;
    } else {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // 0.3 -> 0.8
    scene.add(ambientLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 4.0); // 2.5 -> 4.0
    rimLight.position.set(-5, 10, -5);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xaabbff, 2.0); // 0.8 -> 2.0
    fillLight.position.set(5, 2, 5);
    scene.add(fillLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 1.5); // extra front light
    frontLight.position.set(0, 5, 10);
    scene.add(frontLight);

    const bottomLight = new THREE.PointLight(0xc76f47, 4.5, 20); // 3 -> 4.5
    bottomLight.position.set(0, -3, 0);
    scene.add(bottomLight);


    // --- 3. PROCEDURAL SADDLE GENERATION ---
    const saddleGroup = new THREE.Group();
    scene.add(saddleGroup);

    function shapeSaddleGeometry(geom: THREE.BufferGeometry, scaleY = 1, isRail = false) {
        const pos = geom.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
            let x = pos.getX(i);
            let y = pos.getY(i);
            let z = pos.getZ(i);

            if (z < 0) {
                let taper = 1 - (Math.abs(z) / 3) * 0.6;
                x *= taper;
            } else {
                let widen = 1 + (z / 3) * 0.3;
                x *= widen;
            }

            y += (z * z) * 0.08 * scaleY;
            y -= Math.abs(x) * Math.abs(x) * 0.2 * scaleY;

            pos.setXYZ(i, x, y, z);
        }
        geom.computeVertexNormals();
        return geom;
    }

    const geomTopBase = new THREE.BoxGeometry(2.8, 0.3, 6, 40, 4, 40);
    shapeSaddleGeometry(geomTopBase);
    
    const colors: number[] = [];
    const posTop = geomTopBase.attributes.position as THREE.BufferAttribute;
    for(let i=0; i<posTop.count; i++) {
        let x = posTop.getX(i);
        let z = posTop.getZ(i);
        
        let distLeft = Math.sqrt(Math.pow(x - 0.7, 2) + Math.pow(z - 1.5, 2));
        let distRight = Math.sqrt(Math.pow(x + 0.7, 2) + Math.pow(z - 1.5, 2));
        let distFront = Math.sqrt(Math.pow(x, 2) + Math.pow(z + 2, 2));
        
        let minDist = Math.min(distLeft, distRight, distFront * 1.5);
        let intensity = Math.max(0, 1 - minDist / 1.8);

        let color = new THREE.Color(0x111111);
        if(intensity > 0.1) {
            let heatColor = new THREE.Color().setHSL((1 - intensity) * 0.6, 1.0, 0.5);
            color.lerp(heatColor, intensity);
        }
        colors.push(color.r, color.g, color.b);
    }
    geomTopBase.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const matTopSolid = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.3,
        metalness: 0.5,
        transparent: true,
        opacity: 0.0
    });
    const topLayerSolid = new THREE.Mesh(geomTopBase, matTopSolid);
    
    const matTopWire = new THREE.MeshStandardMaterial({
        color: 0x555555,
        wireframe: true,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.95
    });
    const geomTopWire = geomTopBase.clone();
    geomTopWire.scale(1.01, 1.01, 1.01);
    const topLayerWire = new THREE.Mesh(geomTopWire, matTopWire);

    const topGroup = new THREE.Group();
    topGroup.add(topLayerSolid);
    topGroup.add(topLayerWire);
    saddleGroup.add(topGroup);


    const geomMid = new THREE.BoxGeometry(2.6, 0.4, 5.8, 20, 2, 20);
    shapeSaddleGeometry(geomMid, 1.1);
    const matMid = new THREE.MeshStandardMaterial({
        color: 0x1f1f1f,
        roughness: 0.8,
        metalness: 0.2
    });
    const midLayer = new THREE.Mesh(geomMid, matMid);
    midLayer.position.y = -0.3;
    saddleGroup.add(midLayer);


    const railsGroup = new THREE.Group();
    
    const railCurveLeft = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.6, -0.4, -2.5),
        new THREE.Vector3(-0.8, -1.2, -1.0),
        new THREE.Vector3(-0.9, -1.2, 1.0),
        new THREE.Vector3(-0.7, -0.4, 2.5)
    ]);
    const railCurveRight = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.6, -0.4, -2.5),
        new THREE.Vector3(0.8, -1.2, -1.0),
        new THREE.Vector3(0.9, -1.2, 1.0),
        new THREE.Vector3(0.7, -0.4, 2.5)
    ]);

    const geomRail = new THREE.TubeGeometry(railCurveLeft, 40, 0.08, 12, false);
    const geomRailR = new THREE.TubeGeometry(railCurveRight, 40, 0.08, 12, false);
    
    const matRail = new THREE.MeshStandardMaterial({
        color: 0xc76f47,
        roughness: 0.2,
        metalness: 0.9,
        clearcoat: 1.0
    });

    const railL = new THREE.Mesh(geomRail, matRail);
    const railR = new THREE.Mesh(geomRailR, matRail);
    railsGroup.add(railL, railR);
    railsGroup.position.y = -0.2;
    saddleGroup.add(railsGroup);

    saddleGroup.position.y = 0.5;

    // Render Loop
    function animate() {
        camera.lookAt(0, 0.5, 0); 
        renderer.render(scene, camera);
    }
    gsap.ticker.add(animate);

    const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // --- 4. GSAP SCROLL ANIMATIONS ---
    const introTl = gsap.timeline();
    introTl.to("#hero-sub", { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.5 })
           .to("#hero-main", { opacity: 1, y: 0, duration: 1.2, ease: "power3.out" }, "-=0.8")
           .to("#hero-scroll", { opacity: 1, duration: 1 }, "-=0.5");

    const rotationAnim = gsap.to(saddleGroup.rotation, {
        y: Math.PI * 2,
        ease: "none",
        scrollTrigger: {
            trigger: scrollContentRef.current,
            start: "top top",
            end: "bottom bottom",
            scrub: 1
        }
    });

    const tlPressure = gsap.timeline({
        scrollTrigger: {
            trigger: "#sec-pressure",
            start: "top bottom",
            end: "center center",
            scrub: 1
        }
    });

    tlPressure.to(camera.position, { x: 5, y: 5, z: 8 }, 0)
              .to(matTopSolid, { opacity: 0.95 }, 0)
              .to(matTopWire, { opacity: 0.1 }, 0)
              .to(".pressure-text", { opacity: 1, x: 20 }, 0.5);

    const pressureOutAnim = gsap.to(".pressure-text", {
        opacity: 0,
        x: -20,
        scrollTrigger: {
            trigger: "#sec-pressure",
            start: "bottom center",
            end: "bottom top",
            scrub: 1
        }
    });

    const tlExploded = gsap.timeline({
        scrollTrigger: {
            trigger: "#sec-exploded",
            start: "top bottom",
            end: "center center",
            scrub: 1
        }
    });

    tlExploded.to(camera.position, { x: -4, y: 1, z: 12 }, 0)
              .to(matTopSolid, { opacity: 0.1 }, 0)
              .to(matTopWire, { opacity: 0.9 }, 0)
              .to(matTopWire.color, { r: 0.8, g: 0.8, b: 0.8 }, 0)
              .to(topGroup.position, { y: 1.8 }, 0)
              .to(midLayer.position, { y: -0.3 }, 0)
              .to(railsGroup.position, { y: -2.0 }, 0)
              .to(".exploded-text", { opacity: 1, x: -20 }, 0.5)
              .to("#label-top", { opacity: 1, y: 0 }, 0.6)
              .to("#label-mid", { opacity: 1, y: 0 }, 0.7)
              .to("#label-bot", { opacity: 1, y: 0 }, 0.8);

    const explodedOutAnim = gsap.to([".exploded-text", ".layer-label"], {
        opacity: 0,
        scrollTrigger: {
            trigger: "#sec-exploded",
            start: "bottom center",
            end: "bottom top",
            scrub: 1
        }
    });

    const tlSpecs = gsap.timeline({
        scrollTrigger: {
            trigger: "#sec-specs",
            start: "top bottom",
            end: "center center",
            scrub: 1
        }
    });

    tlSpecs.to(camera.position, { x: 5, y: -1, z: 8 }, 0)
           .to(topGroup.position, { y: 0 }, 0)
           .to(midLayer.position, { y: -0.3 }, 0)
           .to(railsGroup.position, { y: -0.2 }, 0)
           .to(".specs-content", { opacity: 1, y: -20 }, 0.5);

    const specsOutAnim = gsap.to(".specs-content", {
        opacity: 0,
        scrollTrigger: {
            trigger: "#sec-specs",
            start: "bottom center",
            end: "bottom top",
            scrub: 1
        }
    });

    const tlCta = gsap.timeline({
        scrollTrigger: {
            trigger: "#sec-cta",
            start: "top bottom",
            end: "center center",
            scrub: 1
        }
    });

    tlCta.to(camera.position, { x: 0, y: 2, z: 12 }, 0)
         .to(bottomLight, { intensity: 8, distance: 30 }, 0)
         .to(rimLight, { intensity: 6 }, 0)
         .to(".cta-content", { opacity: 1, scale: 1 }, 0.5);

    const hoverAnim = gsap.to(saddleGroup.position, {
        y: "+=0.2",
        duration: 2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1
    });

    // Cleanup function
    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(rafId);
        gsap.ticker.remove(animate);
        
        let removedLenisTicker = false;
        // gsaps.ticker handles iterables cautiously
        
        ScrollTrigger.getAll().forEach(t => t.kill());
        hoverAnim.kill();
        lenis.destroy();

        if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
        }

        renderer.dispose();
        
        // Dispose geometries and materials
        [geomTopBase, geomTopWire, geomMid, geomRail, geomRailR].forEach(g => g.dispose());
        [matTopSolid, matTopWire, matMid, matRail].forEach(m => m.dispose());
    };
  }, []);

  return (
    <main className="w-full overflow-x-hidden relative">
      <div id="webgl-container" ref={containerRef} className="fixed top-0 left-0 w-full h-screen z-0 pointer-events-none" />
      
      <div className="bg-grid w-full"></div>
      <div className="vignette w-full"></div>

      <nav className="fixed top-0 w-full z-50 px-8 py-6 flex justify-between items-center text-sm tracking-widest uppercase font-semibold text-[var(--text-dim)]">
          <div className="text-white text-xl heading-font tracking-[0.3em]">KRAFT<span className="text-[var(--accent-copper)]">.</span></div>
          <div className="hidden md:flex gap-12">
              <a href="#" className="hover:text-white transition-colors duration-300">About</a>
              <a href="#" className="hover:text-white transition-colors duration-300">Products</a>
              <a href="#" className="hover:text-white transition-colors duration-300">Contact</a>
          </div>
      </nav>

      <div id="scroll-content" ref={scrollContentRef} className="relative z-10 w-full">
          
          <section id="sec-hero" className="h-[120vh] items-center justify-center text-center px-4 flex w-full">
              <div className="content-block flex flex-col items-center mt-[-10vh] max-w-full">
                  <h2 className="text-sm md:text-base font-semibold tracking-[0.3em] text-[var(--accent-copper)] mb-6 opacity-0 translate-y-4" id="hero-sub">Engineered for German Performance</h2>
                  <h1 className="text-4xl md:text-7xl font-bold heading-font tracking-tight mb-8 opacity-0 translate-y-8" id="hero-main">
                      Precision Meets<br />Endurance
                  </h1>
                  
                  <div className="absolute bottom-20 flex flex-col items-center gap-4 opacity-0" id="hero-scroll">
                      <span className="text-sm font-semibold tracking-[0.2em] text-[var(--text-dim)] uppercase">Keep Scrolling</span>
                      <div className="mouse">
                          <div className="mouse-wheel"></div>
                      </div>
                  </div>
              </div>
          </section>

          <section id="sec-pressure" className="h-[150vh] items-center justify-start pl-8 md:pl-24 flex">
              <div className="content-block max-w-lg pressure-text opacity-0">
                  <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-[1px] bg-[var(--accent-copper)]"></div>
                      <span className="text-sm font-semibold tracking-[0.3em] uppercase">Dynamic Mapping</span>
                  </div>
                  <h2 className="text-3xl md:text-5xl heading-font mb-6 leading-tight">Engineered<br />for the Extreme</h2>
                  <p className="text-[var(--text-dim)] text-lg md:text-xl leading-relaxed">
                      Our proprietary pressure distribution technology eliminates micro-fatigue. 
                      The carbon-matrix shell adapts in real-time to your anatomy, ensuring maximum power transfer without compromising comfort.
                  </p>
              </div>
          </section>

          <section id="sec-exploded" className="h-[200vh] items-center justify-end pr-8 md:pr-24 relative flex">
              
              <div id="label-top" className="layer-label top-[30%] left-[5%] md:left-[20%]">
                  <h4 className="text-white font-bold tracking-widest text-sm mb-1">HIGH-DENSITY FRONT</h4>
                  <p className="text-[var(--text-dim)] text-sm mt-1 max-w-[220px]">Aerospace-grade mesh for superior airflow and aggressive positioning.</p>
              </div>
              <div id="label-mid" className="layer-label top-[50%] left-[2%] md:left-[10%]">
                  <h4 className="text-white font-bold tracking-widest text-sm mb-1">MEDIUM SUPPORT CORE</h4>
                  <p className="text-[var(--text-dim)] text-sm mt-1 max-w-[220px]">Carbon reinforced skeleton structural foundation.</p>
              </div>
              <div id="label-bot" className="layer-label top-[70%] left-[5%] md:left-[20%]">
                  <h4 className="text-white font-bold tracking-widest text-sm mb-1">LOW-DENSITY REAR</h4>
                  <p className="text-[var(--text-dim)] text-sm mt-1 max-w-[220px]">Shock-absorbing titanium-copper alloy rails.</p>
              </div>

              <div className="content-block max-w-lg exploded-text opacity-0 text-right mr-0 md:mr-8 w-full">
                  <div className="flex items-center justify-end gap-4 mb-4">
                      <span className="text-sm font-semibold tracking-[0.3em] uppercase">Modular Architecture</span>
                      <div className="w-12 h-[1px] bg-[var(--accent-copper)]"></div>
                  </div>
                  <h2 className="text-3xl md:text-5xl heading-font mb-6 leading-tight">Adaptable<br />Performance</h2>
                  <p className="text-[var(--text-dim)] text-lg md:text-xl leading-relaxed ml-auto">
                      Three distinct zones constructed from advanced metamaterials. Easily disassemble and customize components to match your specific riding discipline.
                  </p>
              </div>
          </section>

          <section id="sec-specs" className="h-[150vh] items-center justify-end px-8 md:px-24 relative flex">
              <div className="content-block specs-content opacity-0 w-full md:w-1/2 flex flex-col translate-y-10">
                  <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-[1px] bg-[var(--accent-copper)]"></div>
                      <span className="text-sm font-semibold tracking-[0.3em] uppercase">Metrics & Capability</span>
                  </div>
                  <h2 className="text-3xl md:text-5xl heading-font mb-10 leading-tight">Beyond<br />Limits</h2>
                  
                  <div className="grid grid-cols-2 gap-8 font-sans mb-10 border-b border-white/10 pb-10">
                      <div>
                          <div className="text-3xl md:text-4xl font-bold text-white mb-1">135<span className="text-xl text-[var(--accent-copper)]">g</span></div>
                          <div className="text-[var(--text-dim)] uppercase tracking-widest text-xs">Total Weight</div>
                      </div>
                      <div>
                          <div className="text-3xl md:text-4xl font-bold text-white mb-1">11.4<span className="text-xl text-[var(--accent-copper)]">Nm</span></div>
                          <div className="text-[var(--text-dim)] uppercase tracking-widest text-xs">Max Torque</div>
                      </div>
                      <div>
                          <div className="text-3xl md:text-4xl font-bold text-white mb-1">3D<span className="text-xl text-[var(--accent-copper)]">p</span></div>
                          <div className="text-[var(--text-dim)] uppercase tracking-widest text-xs">Matrix Core</div>
                      </div>
                      <div>
                          <div className="text-3xl md:text-4xl font-bold text-white mb-1">IPX<span className="text-xl text-[var(--accent-copper)]">8</span></div>
                          <div className="text-[var(--text-dim)] uppercase tracking-widest text-xs">Weather Rating</div>
                      </div>
                  </div>

                  <h4 className="text-white font-bold tracking-widest text-sm mb-4 uppercase">Optimal Scenarios</h4>
                  <ul className="space-y-4 text-[var(--text-dim)] text-sm max-w-sm">
                      <li className="flex justify-between items-center"><span>Competitive Road Racing</span> <span className="text-[var(--accent-copper)] text-lg">98%</span></li>
                      <li className="flex justify-between items-center"><span>Track Velodrome</span> <span className="text-[var(--accent-copper)] text-lg">100%</span></li>
                      <li className="flex justify-between items-center"><span>High-intensity Gravel</span> <span className="text-[var(--accent-copper)] text-lg">85%</span></li>
                  </ul>
              </div>
          </section>

          <section id="sec-cta" className="h-[100vh] items-center justify-center text-center px-4 relative z-20 flex">
              <div className="content-block cta-content opacity-0 scale-95 flex flex-col items-center">
                  <h2 className="text-4xl md:text-6xl heading-font mb-4">Ready to Ride?</h2>
                  <p className="text-[var(--text-dim)] text-lg md:text-xl mb-10 tracking-wide max-w-md">Experience the pinnacle of German engineering and surge into the future of cycling.</p>
                  <div className="flex flex-col md:flex-row gap-6">
                      <button className="cta-btn px-10 py-4 uppercase tracking-[0.2em] text-sm font-semibold">Pre-order Now</button>
                      <button className="border border-transparent text-[var(--text-dim)] hover:text-white px-10 py-4 uppercase tracking-[0.2em] text-sm font-semibold transition-colors duration-300">Customization</button>
                  </div>
              </div>
          </section>

          <section id="sec-pricing" className="min-h-screen py-24 items-center justify-center flex flex-col relative z-20 pointer-events-auto bg-gradient-to-b from-transparent via-[#060608] to-[#060608]">
              <div className="max-w-6xl w-full px-8 flex flex-col md:flex-row gap-16 items-center justify-between pt-24">
                  <div className="w-full md:w-1/2">
                      <h2 className="text-3xl md:text-5xl heading-font mb-4 text-white">Secure Yours</h2>
                      <p className="text-[var(--text-dim)] text-lg mb-8">Limited production run for the 2026 season. Reserve your KRAFT saddle today.</p>
                      
                      <div className="text-5xl font-bold text-white mb-2">$395 <span className="text-xl text-[var(--text-dim)] font-normal line-through ml-2">$450</span></div>
                      <div className="text-[var(--accent-copper)] text-sm tracking-widest uppercase mb-8 font-semibold">Pre-order pricing</div>
                      
                      <ul className="space-y-3 text-[var(--text-dim)] mb-10 text-sm">
                          <li className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 bg-[var(--accent-copper)] rounded-full"></div> 
                              Custom fit kit included
                          </li>
                          <li className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 bg-[var(--accent-copper)] rounded-full"></div> 
                              30-day performance guarantee
                          </li>
                          <li className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 bg-[var(--accent-copper)] rounded-full"></div> 
                              Expected ship date: Q3 2026
                          </li>
                      </ul>

                      <button className="cta-btn px-12 py-4 uppercase tracking-[0.2em] text-sm font-semibold w-full md:w-auto text-center border border-[var(--accent-copper)] bg-[var(--accent-copper)] bg-opacity-10 hover:bg-[var(--accent-copper)] text-white transition-all duration-300">Proceed to Checkout</button>
                  </div>
                  
                  <div className="w-full md:w-1/2">
                      <h4 className="text-white font-bold tracking-widest text-sm mb-6 uppercase border-b border-white/10 pb-4">Where to Buy</h4>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-6 bg-white/5 border border-white/10 flex flex-col items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
                              <div className="heading-font text-white text-xl tracking-wider">SIGMA</div>
                              <div className="text-[var(--text-dim)] text-xs mt-2 uppercase">Global Online</div>
                          </div>
                          <div className="p-6 bg-white/5 border border-white/10 flex flex-col items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
                              <div className="heading-font text-white text-xl tracking-wider">RAPHA</div>
                              <div className="text-[var(--text-dim)] text-xs mt-2 uppercase">Select Clubhouses</div>
                          </div>
                          <div className="p-6 bg-white/5 border border-white/10 flex flex-col items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
                              <div className="heading-font text-white text-xl tracking-wider">CANYON</div>
                              <div className="text-[var(--text-dim)] text-xs mt-2 uppercase">OEM Config</div>
                          </div>
                          <div className="p-6 bg-white/5 border border-white/10 flex flex-col items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
                              <div className="heading-font text-white text-xl tracking-wider">R&A</div>
                              <div className="text-[var(--text-dim)] text-xs mt-2 uppercase">Brooklyn, NY</div>
                          </div>
                      </div>
                  </div>
              </div>
          </section>
          
          <footer className="relative z-20 border-t border-white/10 bg-[#060608] mt-0 pt-16 pb-8 px-8 w-full pointer-events-auto">
              <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                  <div className="col-span-1 md:col-span-2">
                      <div className="text-white text-2xl heading-font tracking-[0.3em] mb-6">KRAFT<span className="text-[var(--accent-copper)]">.</span></div>
                      <p className="text-[var(--text-dim)] text-sm max-w-sm leading-relaxed">
                          Precision engineering meets endurance. Designed in Germany, built for the extreme.
                      </p>
                  </div>
                  <div>
                      <h4 className="text-white font-bold tracking-widest text-sm mb-6 uppercase">Explore</h4>
                      <ul className="flex flex-col gap-4 text-[var(--text-dim)] text-sm">
                          <li><a href="#" className="hover:text-[var(--accent-copper)] transition-colors duration-300">About Us</a></li>
                          <li><a href="#" className="hover:text-[var(--accent-copper)] transition-colors duration-300">Technology</a></li>
                          <li><a href="#" className="hover:text-[var(--accent-copper)] transition-colors duration-300">Products</a></li>
                          <li><a href="#" className="hover:text-[var(--accent-copper)] transition-colors duration-300">Contact</a></li>
                      </ul>
                  </div>
                  <div>
                      <h4 className="text-white font-bold tracking-widest text-sm mb-6 uppercase">Connect</h4>
                      <ul className="flex flex-col gap-4 text-[var(--text-dim)] text-sm">
                          <li><a href="#" className="hover:text-[var(--accent-copper)] transition-colors duration-300">Instagram</a></li>
                          <li><a href="#" className="hover:text-[var(--accent-copper)] transition-colors duration-300">Twitter / X</a></li>
                          <li><a href="#" className="hover:text-[var(--accent-copper)] transition-colors duration-300">LinkedIn</a></li>
                      </ul>
                  </div>
              </div>
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10 text-xs text-[var(--text-dim)]">
                  <p>&copy; 2026 KRAFT Engineering. All rights reserved.</p>
                  <div className="flex gap-6 mt-4 md:mt-0">
                      <a href="#" className="hover:text-white transition-colors duration-300">Privacy Policy</a>
                      <a href="#" className="hover:text-white transition-colors duration-300">Terms of Service</a>
                  </div>
              </div>
          </footer>
      </div>
    </main>
  );
}
