import * as BabylonJS from '@babylonjs/core';
import '@babylonjs/inspector';
import * as React from "react";
import { PhiTop, PHI } from './PhiTop';

import 'bootstrap-icons/font/bootstrap-icons.css'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { ITop } from './ITop';
import { Rattleback } from './Rattleback';
import { TippeTop } from './TippeTop';

type LicenseInfo = {
    department: string,
    relatedTo: string
    name: string
    licensePeriod: string
    material: string
    licenseType: string
    link: string
    remoteVersion: string
    installedVersion: string
    definedVersion: string
    author: string
}

const LicenseView = (props: {
    info: LicenseInfo
}) => {
    return (
        <div className='p-2 pl-5 pr-5'>
            {props.info.name} <br />
            {
                (props.info.author != "n/a") ? <>{props.info.author} <br /></> : <></>
            }
            {props.info.licenseType}
        </div>
    )
}

const LicenseOverview = () => {

    const mainRef = React.createRef<HTMLDivElement>();
    const [animationState, setAnimationState] = React.useState(0)

    const [licenses, setLicenses] = React.useState<LicenseInfo[]>([]);

    React.useEffect(() => {
        fetch("/spinning-toys/licenses.json").then(res => res.json()).then(data => {
            setLicenses(data)
        })
    }, []);

    return (
        <>
            <div className='flex justify-between text-neutral-500/60 items-center'>

                <FullButton
                    onClick={() => {
                        setAnimationState(
                            animationState == 0 ? (mainRef.current!.scrollHeight) : 0
                        )
                    }}
                >
                    <div>Show/Hide OS Licenses</div>
                    <i className={'bi bi-arrow-down transition-[transform] duration-300 ease-in-out ' + (animationState == 0 ? "rotate-0" : "rotate-180")}></i>
                </FullButton>
            </div>
            <div ref={mainRef} className={'flex overflow-hidden rounded-2xl bg-neutral-50/80 transition-all duration-300 text-left flex-col ease-in-out'} style={{ height: animationState }}>
                {
                    licenses.map((license, idx) => <LicenseView info={license} key={idx} />)
                }
            </div>
        </>
    )
}

const FullButton = (props: {
    children?: React.ReactNode
    onClick?: () => void
}) => {
    return (
        <button
            className="transition-all hover:bg-neutral-500 hover:text-neutral-50 border-neutral-500/60 p-2 text-neutral-800 duration-300 pl-5 pr-5 rounded-full w-full flex justify-between"
            onClick={props.onClick}
        >
            {props.children}
        </button>
    )
}

type ButtonProps = {
    children?: React.ReactNode
    onClick?: () => void
    className?: string
}

const Button = (props: ButtonProps) => {
    return (
        <button
            className={"transition-all bg-neutral-50/60 hover:bg-neutral-500 hover:text-neutral-50 border-2 border-neutral-500/60 p-2 text-neutral-500/60 duration-300 ease-in-out pl-3 pr-3 rounded-full " + props.className}
            onClick={props.onClick}
        >
            {props.children}
        </button>
    )
}

const ToggleButton = (props: {
    children?: React.ReactNode
    onClick?: () => void
    className?: string
}) => {

    const [toggled, setToggled] = React.useState(false);

    return (
        <button 
            className={"transition-all border-2  duration-300 ease-in-out pl-3 pr-3 border-neutral-500/60 rounded-full p-2 " + (
                toggled
                    ? "hover:bg-neutral-50 bg-neutral-500/60 text-neutral-50/60  hover:text-neutral-500"
                    : "bg-neutral-50/60 hover:bg-neutral-500 hover:text-neutral-50 text-neutral-500/60"
            ) + " " + props.className}
            onClick={() => {
                setToggled(!toggled)
                props.onClick && props.onClick();
            }}
        >
            {props.children}
        </button>
    )
}

const DropDown = (props: {
    children?: React.ReactElement<ButtonProps>[]
}) => {

    const [open, setOpen] = React.useState(false);
    const divRef = React.createRef<HTMLDivElement>();

    return (
        <div className='flex flex-col justify-end items-end transition-[height] ease-in-out duration-200 overflow-hidden pointer-events-auto gap-2' style={{
            height: (open ? divRef.current?.scrollHeight : "3rem")
        }} ref={divRef}>
            {props.children}
            <ToggleButton onClick={() => { setOpen(!open) }}>
                <i className="bi bi-three-dots-vertical"></i>
            </ToggleButton>
        </div>
    )
}

type OverlayHandle = {
    open: () => void
    hide: () => void
    toggle: () => void
}

type OverlayProps = {
    children?: React.ReactNode
}

const OverlayRenderer: React.ForwardRefRenderFunction<OverlayHandle, OverlayProps> = (props, env) => {

    const [animationState, setAnimationState] = React.useState(false)

    const handle: OverlayHandle = {
        toggle() {
            setAnimationState(!animationState);
        },
        open() {
            setAnimationState(true)
        },
        hide() {
            setAnimationState(false)
        },
    }

    React.useImperativeHandle(env, () => (handle));

    return (
        <div className={'transition-[padding] ease-in-out duration-300 h-full w-fit pointer-events-auto pt-4 pb-4 ' + (animationState ? "pr-4" : "pr-0")}>
            <div className={'max-w-96 h-full bg-neutral-50/80 flex flex-col items-stretch text-center top-0 bottom-0 overflow-hidden border-neutral-500/60 transition-all duration-300 ease-in-out rounded-2xl gap-4 ' + (animationState ? "w-96 border-2" : "w-0 border-0")}>
                <div className='m-2 p-3 overflow-y-scroll h-full flex flex-col gap-2'>
                    {props.children}
                </div>
            </div>
        </div>
    )
}

const Overlay = React.forwardRef(OverlayRenderer)

function App() {

    const canvas = React.createRef<HTMLCanvasElement>();
    const overlayHandle = React.createRef<OverlayHandle>();

    const engine = React.useRef<BabylonJS.Engine>();
    const scene = React.useRef<BabylonJS.Scene>();
    const top = React.useRef<ITop>();
    const generator = React.useRef<BabylonJS.ShadowGenerator>();

    const [velocityChart, setVelocityChart] = React.useState<JSX.Element>();
    const [angularVelocityChart, setAngularVelocityChart] = React.useState<JSX.Element>();
    const [energyChart, setEnergyChart] = React.useState<JSX.Element>();

    const [simulate, setSimulate] = React.useState(false);
    const simulateState = React.useRef(simulate);

    const updateCharts = () => {
        setVelocityChart(<></>);
        setAngularVelocityChart(<></>)
        setEnergyChart(<></>)

        setTimeout(() => {

            const data = top.current!.simulationData.map((val, idx) => {
                return {
                    t: idx * 0.01,
                    vx: val.velocity.x,
                    vy: val.velocity.y,
                    vz: val.velocity.z,
                    wx: val.angularVelocity.x,
                    wy: val.angularVelocity.y,
                    wz: val.angularVelocity.z,
                    Ekin: val.kineticEnergy,
                    Epot: val.potentialEnergy,
                    Erot: val.rotationalEnergy,
                    E: val.totalEnergy
                }
            });

            setVelocityChart(
                <LineChart width={300} height={200} data={data}>
                    <XAxis dataKey="t" tickFormatter={(val: number, _) => { return val.toFixed(1); }} />
                    <YAxis />
                    <CartesianGrid stroke="#090909" strokeDasharray="5 5" />
                    <Tooltip />
                    <Line type="monotone" dataKey="vx" stroke="#f87171" dot={false} />
                    <Line type="monotone" dataKey="vy" stroke="#4ade80" dot={false} />
                    <Line type="monotone" dataKey="vz" stroke="#38bdf8" dot={false} />
                </LineChart>
            )
            setAngularVelocityChart(
                <LineChart width={300} height={200} data={data}>
                    <XAxis dataKey="t" tickFormatter={(val: number, _) => { return val.toFixed(1); }} />
                    <YAxis />
                    <CartesianGrid stroke="#090909" strokeDasharray="5 5" />
                    <Tooltip />
                    <Line type="monotone" dataKey="wx" stroke="#f87171" dot={false} />
                    <Line type="monotone" dataKey="wy" stroke="#4ade80" dot={false} />
                    <Line type="monotone" dataKey="wz" stroke="#38bdf8" dot={false} />
                </LineChart>
            )
            setEnergyChart(
                <LineChart width={300} height={200} data={data}>
                    <XAxis dataKey="t" tickFormatter={(val: number, _) => { return val.toFixed(1) }} />
                    <YAxis tickFormatter={(val, idx) => { return (val).toFixed(1) }} />
                    <CartesianGrid stroke="#090909" strokeDasharray="5 5" />
                    <Tooltip />
                    <Line type="monotone" dataKey="Ekin" stroke="#f87171" dot={false} />
                    <Line type="monotone" dataKey="Erot" stroke="#4ade80" dot={false} />
                    <Line type="monotone" dataKey="Epot" stroke="#fbbf24" dot={false} />
                    <Line type="monotone" dataKey="E" stroke="#38bdf8" dot={false} />
                </LineChart>
            )
        }, 100)
    }

    const initEngine = () => {
        engine.current = new BabylonJS.Engine(canvas.current, true, {
            powerPreference: "high-performance"
        });
        engine.current.displayLoadingUI();
    }

    const initScene = () => {
        scene.current = new BabylonJS.Scene(engine.current!);
        scene.current.clearColor = BabylonJS.Color3.White().toColor4();
    }

    const setupCamera = () => {
        const camera = new BabylonJS.ArcRotateCamera(
            "camera",
            Math.PI / 3,
            Math.PI / 3,
            3,
            BabylonJS.Vector3.Zero(), scene.current
        )

        // camera.mode = BabylonJS.Camera.ORTHOGRAPHIC_CAMERA;
        camera.orthoTop = 1;
        camera.orthoBottom = -1;
        camera.orthoLeft = -1;
        camera.orthoRight = 1;
        camera.minZ = 0.1;
        camera.target.y = 0.16 * PHI;
        scene.current?.onBeforeRenderObservable.add(() => {
            const p = top.current?.getAbsolutePosition()!.clone();
            if (p) {
                p.y = 0.16 * PHI;
                camera.target = p;
            }
        })
        camera.attachControl(canvas.current!)
    }

    const setupEnvironment = () => {
        const hdri = new BabylonJS.HDRCubeTexture(
            "/spinning-toys/burnt_warehouse_2k.hdr",
            scene.current!,
            128,
            false,
            true,
            false,
            true
        );
        scene.current!.environmentTexture = hdri;
        scene.current!.environmentBRDFTexture = hdri;

        const skybox = new BabylonJS.PhotoDome("skybox", "/spinning-toys/burnt_warehouse_2k.hdr", {}, scene.current!)
        skybox.infiniteDistance = true;

        const sunPosition = new BabylonJS.Vector3(1, 10, 1).normalize().scale(5);

        const light = new BabylonJS.HemisphericLight("skylight", BabylonJS.Vector3.Up(), scene.current!);
        light.intensity = .6;
        const sun = new BabylonJS.DirectionalLight(
            "sun",
            sunPosition.clone().normalize().scale(-1),
            scene.current!
        );
        sun.shadowEnabled = true;
        sun.autoCalcShadowZBounds = true;
        sun.intensity = 10;
        sun.shadowMinZ = 1;
        sun.shadowMaxZ = 30;
        sun.autoUpdateExtends = false;
        sun.shadowFrustumSize = 4;
        sun.position = sunPosition;
        generator.current = new BabylonJS.ShadowGenerator(1024, sun);
        generator.current.addShadowCaster(top.current!.getChildMeshes(true)[0] as BabylonJS.Mesh);
        generator.current.usePoissonSampling = false;
        generator.current.bias = 0.001;
        generator.current.blurKernel = 5;
        generator.current.blurScale = 1;
        generator.current.useExponentialShadowMap = true;
        generator.current.useBlurExponentialShadowMap = false;
        generator.current.useCloseExponentialShadowMap = true;
        generator.current.useBlurCloseExponentialShadowMap = true;
        generator.current.useContactHardeningShadow = true;
        generator.current.setDarkness(.6);
        generator.current.recreateShadowMap();

        scene.current?.onBeforeRenderObservable.add(() => {
            sun.position = sunPosition.add(top.current?.getAbsolutePosition()!);
        })
    }

    const setupTop = () => {
        top.current = new Rattleback("top", scene.current!);
        // top.current = new HalfTop("halftop", scene.current!);

        const ground = BabylonJS.CreatePlane("ground", {
            width: 5,
            height: 5,
        }, scene.current)
        const groundMaterial = new BabylonJS.PBRMetallicRoughnessMaterial("ground#material", scene.current);
        groundMaterial.baseColor = BabylonJS.Color3.Gray();
        groundMaterial.backFaceCulling = false;
        groundMaterial.roughness = 0.1;
        // groundMaterial.metallicRoughnessTexture = new BabylonJS.Texture("WoodFloor051_2K-JPG/WoodFloor051_2K_Roughness.jpg", scene.current)
        groundMaterial.metallic = 0.0;
        groundMaterial.baseTexture = new BabylonJS.Texture("WoodFloor051_2K-JPG/WoodFloor051_2K_Color.jpg", scene.current)
        groundMaterial.normalTexture = new BabylonJS.Texture("WoodFloor051_2K-JPG/WoodFloor051_2K_NormalGL.jpg", scene.current)
        ground.material = groundMaterial;
        ground.rotation.x = Math.PI / 2;
        ground.receiveShadows = true;
        // ground.visibility = 0;
    }

    const setupPost = () => {
        const pipeline = new BabylonJS.DefaultRenderingPipeline(
            "pipeline", false, scene.current, [scene.current!.activeCamera!]
        );
        pipeline.samples = 4;
        pipeline.fxaaEnabled = true;
        pipeline.bloomEnabled = true;
        pipeline.bloomThreshold = .8;
        pipeline.bloomWeight = 0.1;
        pipeline.bloomKernel = 32;
        pipeline.bloomScale = 0.5;
        pipeline.imageProcessingEnabled = true;
        pipeline.chromaticAberrationEnabled = true;
        pipeline.chromaticAberration.aberrationAmount = 20;
        pipeline.chromaticAberration.radialIntensity = 3;
        pipeline.chromaticAberration.direction.x = Math.sin(Math.PI);
        pipeline.chromaticAberration.direction.y = Math.cos(Math.PI);
        pipeline.grainEnabled = true;
        pipeline.grain.intensity = 5;
        pipeline.grain.animated = true;
    }

    const setupLoop = () => {
        resizeCanvas();
        engine.current?.runRenderLoop(() => {
            scene.current?.render()
        })
        window.addEventListener("resize", () => {
            resizeCanvas();
            engine.current!.resize();
        })
    }

    const init = () => {
        initEngine();
        initScene();
        setupTop();
        setupCamera();
        setupEnvironment();
        setupPost();
        setupLoop();
        scene.current!.registerBeforeRender(() => {
            top.current?.tick(simulateState.current);
        })
        scene.current!.onReadyObservable.addOnce(() => {
            updateCharts();
            engine.current!.hideLoadingUI();
        })
    }

    const updateSimulate = (s: boolean) => {
        setSimulate(s);
        simulateState.current = s;
    }

    React.useEffect(() => {
        updateSimulate(false);
        init();
        return () => {
            engine.current?.hideLoadingUI();
            engine.current?.stopRenderLoop();
        }
    }, []);

    const resizeCanvas = () => {
        engine.current!.getRenderingCanvas()!.width = window.innerWidth;
        engine.current!.getRenderingCanvas()!.height = window.innerHeight;
    }

    return (
        <div className="root overflow-hidden relative">
            <div className='grow root'>
                <canvas className="root" ref={canvas} />
            </div>

            <div className='absolute top-0 left-0 right-0 bottom-0 flex pointer-events-none items-end'>
                <div className='grow h-fit flex p-4 gap-3 justify-between'>
                    <div className='flex gap-3 flex-col justify-end'>
                        <Button onClick={() => { updateSimulate(!simulateState.current) }} className='pointer-events-auto'>
                            {
                                simulate ? <i className='bi bi-pause-fill' />
                                    : <i className='bi bi-play-fill' />
                            }
                        </Button>
                        <Button onClick={() => { 
                            if (simulate) {
                                updateSimulate(false);
                                top.current?.reset();
                            }
                            else {
                                top.current?.reset(); 
                            }
                        }} className='pointer-events-auto'>
                            <i className="bi bi-arrow-counterclockwise"></i>
                        </Button>
                    </div>
                    <div className='flex gap-3 justify-end items-end'>

                        <DropDown>
                            <Button className='pointer-events-auto group flex h-11 items-center justify-center' onClick={() => {
                                if (top.current) {
                                    updateSimulate(false);
                                    generator.current?.removeShadowCaster(
                                        top.current.getChildMeshes(true)[0] as BabylonJS.Mesh
                                    );
                                    scene.current?.removeTransformNode(top.current)
                                    top.current.dispose();
                                    top.current = undefined;
                                }
                                top.current = new PhiTop("top", scene.current!);
                                generator.current?.addShadowCaster(top.current.getChildMeshes(true)[0] as BabylonJS.Mesh);
                            }}>
                                <div className='w-32 md:w-64'>Φ-Top</div>
                            </Button>
                            <Button className='pointer-events-auto group flex h-11 items-center justify-center' onClick={() => {
                                if (top.current) {
                                    updateSimulate(false);
                                    generator.current?.removeShadowCaster(top.current.getChildMeshes(true)[0] as BabylonJS.Mesh);
                                    scene.current!.removeTransformNode(top.current);
                                    top.current.dispose();
                                    top.current = undefined;
                                }
                                top.current = new Rattleback("top", scene.current!);
                                generator.current?.addShadowCaster(top.current.getChildMeshes(true)[0] as BabylonJS.Mesh);
                            }}>
                                <div className='w-32 md:w-64'>Rattleback (Unfinished)</div>
                            </Button>
                            <Button className='pointer-events-auto group flex h-11 items-center justify-center' onClick={() => {
                                if (top.current) {
                                    updateSimulate(false);
                                    generator.current?.removeShadowCaster(top.current.getChildMeshes(true)[0] as BabylonJS.Mesh);
                                    scene.current!.removeTransformNode(top.current);
                                    top.current.dispose();
                                    top.current = undefined;
                                }
                                top.current = new TippeTop("top", scene.current!);
                                generator.current?.addShadowCaster(top.current.getChildMeshes(true)[0] as BabylonJS.Mesh);
                            }}>
                                <div className='w-32 md:w-64'>Tippe Top</div>
                            </Button>
                        </DropDown>

                        <ToggleButton onClick={() => { overlayHandle.current?.toggle() }} className='pointer-events-auto hidden md:block'>
                            <i className="bi bi-layout-sidebar-reverse"></i>
                        </ToggleButton>
                    </div>
                </div>

                <Overlay
                    ref={overlayHandle}
                >
                    <div className='w-full border-b-2 pb-3 gap-1 flex flex-col border-neutral-500'>
                        <FullButton onClick={updateCharts}>
                            <div>Refresh Graph Data</div>
                            <i className='bi bi-arrow-clockwise'></i>
                        </FullButton>
                    </div>

                    <div className='flex flex-col items-center gap-3 w-full pt-3 pb-3 p-5'>
                        <div className='w-full text-right flex flex-col gap-3'>
                            <InlineMath math="\vec{v}\ [\frac{\text{m}}{\text{s}}]" />
                            {velocityChart}
                        </div>

                        <div className='w-full text-right flex flex-col gap-3'>
                            <InlineMath math="\vec{\omega}\ [\frac{1}{\text{s}}]" />
                            {angularVelocityChart}
                        </div>

                        <div className='w-full text-right flex flex-col gap-3'>
                            <InlineMath math="E\ [\frac{\text{kg} \cdot \text{m}^2}{\text{s}^2}]" />
                            {energyChart}
                        </div>
                    </div>
                    <div className='grow'></div>

                    <div className='w-full border-t-2 pt-3 gap-1 flex flex-col border-neutral-500'>

                        <FullButton onClick={() => {
                            window.open("https://catheart97.github.io", '_blank')!.focus();
                        }}>
                            <div>Ronja Schnur (catheart97)</div>
                            <i className='bi bi-box-arrow-up-right'></i>
                        </FullButton>


                        <LicenseOverview />
                    </div>

                </Overlay>
            </div>


        </div>
    )
}

export default App
