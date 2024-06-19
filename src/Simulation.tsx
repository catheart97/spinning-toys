import * as bjs from '@babylonjs/core'
import * as React from 'react'

import HDR from "../resources/symmetrical_garden_02_4k.jpeg"

import WoodAlbedo from "../resources/worn_planks_diff_2k.jpg"
import WoodNormal from "../resources/worn_planks_nor_gl_2k.jpg"
import WoodRoughness from "../resources/worn_planks_rough_2k.jpg"

import { IUpdateable } from './Utility'

import OloidMesh from "../resources/oloid_lp.glb"
import PhiTopMesh from "../resources/phitop.glb"
import RattlebackMesh from "../resources/rattleback.glb"
import TippeTopMesh from "../resources/tippetop.glb"

import { PhiTop } from './toys/PhiTop'
import { Oloid } from './toys/Oloid'
import { Rattleback } from './toys/Rattleback'
import { TippeTop } from './toys/TippeTop'

import 'chart.js'
import { Chart } from 'chart.js/auto'

export enum SimulationScene {
  Oloid = 'Oloid',
  PhiTop = 'PhiTop',
  Rattleback = 'Rattleback',
  TippeTop = 'TippeTop'
}

const useForceUpdate = () => {
  const [, setTick] = React.useState(0)
  return React.useCallback(() => {
    setTick(tick => tick + 1)
  }, [])
}

const Simulation = (props: {
  scene: SimulationScene
}) => {
  const [loading, setLoading] = React.useState(true);

  const canvas = React.useRef<HTMLCanvasElement>()
  const updateable = React.useRef<IUpdateable>()

  const chartCanvas = React.useRef<HTMLCanvasElement>()

  const forceUpdate = useForceUpdate()

  React.useEffect(() => {
    (async () => {
      const engine = new bjs.Engine(canvas.current, true)
      const scene = new bjs.Scene(engine)
      scene.clearColor = new bjs.Color4(0, 0, 0, 0)

      const camera = new bjs.ArcRotateCamera('camera', Math.PI / 2, 0, 10, bjs.Vector3.Zero(), scene)
      camera.setTarget(bjs.Vector3.Zero())
      camera.attachControl(canvas.current, false)
      camera.panningDistanceLimit = 2
      camera.lowerRadiusLimit = 5
      camera.lowerBetaLimit = 0
      camera.upperBetaLimit = Math.PI / 2 - 0.1
      // camera.lowerAlphaLimit = Math.PI / 4
      // camera.upperAlphaLimit = Math.PI / 2


      const chart = new Chart(chartCanvas.current, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: "Angular Velocity (X)",
              data: [],
              borderColor: "red",
              fill: false
            },
            {
              label: "Angular Velocity (Y)",
              data: [],
              borderColor: "green",
              fill: false
            },
            {
              label: "Angular Velocity (Z)",
              data: [],
              borderColor: "blue",
              fill: false
            },
            {
              label: "Angular Velocity",
              data: [],
              borderColor: "white",
              fill: false
            }
          ]
        },
        options: {
          animation: false,
          // @ts-ignore
          pointStyle: false,
          title: {
            color: "white",
          },
          color: "white",

          plugins: {
            legend: {
              labels: {
                color: "white"
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                color: "white"
              }
            },
            x: {
              beginAtZero: true,
              ticks: {
                color: "white"
              }
            }
          }
        },
      });

      {
        const ground = bjs.CreateDisc("ground", {
          radius: 20,
          tessellation: 100
        }, scene);
        ground.rotation.x = Math.PI / 2;
        const groundMaterial = new bjs.PBRMetallicRoughnessMaterial("groundMaterial", scene);
        groundMaterial.baseTexture = new bjs.Texture(WoodAlbedo, scene);
        groundMaterial.normalTexture = new bjs.Texture(WoodNormal, scene);
        groundMaterial.metallicRoughnessTexture = new bjs.Texture(WoodRoughness, scene);
        ground.material = groundMaterial;
      }

      switch (props.scene) {
        case 'Oloid':
          /// ! OLOID 
          {
            const res = await bjs.SceneLoader.ImportMeshAsync("", OloidMesh, "", scene)
            const oloidMesh = res.meshes.filter(m => m.name == "__root__")[0] as bjs.Mesh

            const oloid = new Oloid(oloidMesh)
            updateable.current = oloid
          }
          break;
        case 'PhiTop':
          /// ! PHITOP
          {
            const res = await bjs.SceneLoader.ImportMeshAsync("", PhiTopMesh, "", scene)
            const phitopMesh = res.meshes.filter(m => m.name == "__root__")[0] as bjs.Mesh

            const phitop = new PhiTop(phitopMesh)
            updateable.current = phitop
          }
          break;
        case 'Rattleback':
          /// ! RATTLEBACK
          {
            const res = await bjs.SceneLoader.ImportMeshAsync("", RattlebackMesh, "", scene)
            const rattlebackMesh = res.meshes.filter(m => m.name == "__root__")[0] as bjs.Mesh

            const rattleback = new Rattleback(rattlebackMesh)
            updateable.current = rattleback
          }
          break;
        case 'TippeTop':
          /// ! TIPPETOP
          {
            const res = await bjs.SceneLoader.ImportMeshAsync("", TippeTopMesh, "", scene)
            const phitopMesh = res.meshes.filter(m => m.name == "__root__")[0] as bjs.Mesh

            const phitop = new TippeTop(phitopMesh)
            updateable.current = phitop
          }
          break;
      }

      {
        let total = 0;
        let processingData = false;
        scene.onAfterRenderObservable.add(() => {
          if (processingData) return;
          processingData = true;
          const dt = engine.getDeltaTime() / 1000
          updateable.current.update(dt);
          total += dt;

          if (updateable.current.simulate) {

            if (chart.data.labels.length == 100) {
              chart.data.labels.shift();
              chart.data.datasets[0].data.shift();
              chart.data.datasets[1].data.shift();
              chart.data.datasets[2].data.shift();
              chart.data.datasets[3].data.shift();
            }

            chart.data.labels.push(total.toFixed(2));
            chart.data.datasets[0].data.push(updateable.current.angularVelocity.x);
            chart.data.datasets[1].data.push(updateable.current.angularVelocity.y);
            chart.data.datasets[2].data.push(updateable.current.angularVelocity.z);
            chart.data.datasets[3].data.push(updateable.current.angularVelocity.length());

            chart.update();
          }
          processingData = false;
        });
      }

      {
        // setup light and shadows
        const light = new bjs.DirectionalLight("light", new bjs.Vector3(0, -1, 0), scene);
        light.intensity = 4;
        light.position = new bjs.Vector3(0, 10, 0);

        const shadowGenerator = new bjs.CascadedShadowGenerator(1024, light);
        shadowGenerator.usePercentageCloserFiltering = false;
        shadowGenerator.filter = bjs.ShadowGenerator.FILTER_PCF;
        shadowGenerator.forceBackFacesOnly = false;
        shadowGenerator.normalBias = 0.0175;
        shadowGenerator.bias = 0.006;
        shadowGenerator.filteringQuality = bjs.ShadowGenerator.QUALITY_HIGH;
        shadowGenerator.shadowMaxZ = 100;
        shadowGenerator.depthClamp = false;
        shadowGenerator.lambda = 0.5;
        shadowGenerator.stabilizeCascades = false;
        shadowGenerator.penumbraDarkness = 0;
        shadowGenerator.cascadeBlendPercentage = 0.1;
        shadowGenerator.darkness = .1;
        shadowGenerator.numCascades = 4;
        shadowGenerator.useContactHardeningShadow = false;

        scene.meshes.forEach(mesh => {
          shadowGenerator.addShadowCaster(mesh);
          mesh.receiveShadows = true;
        });
      }

      {
        // setup lightning and environment 
        const hdrTexture = new bjs.EquiRectangularCubeTexture(HDR, scene, 1024);
        scene.environmentTexture = hdrTexture.clone();
        scene.environmentIntensity = 1;

        hdrTexture.coordinatesMode = bjs.Texture.SKYBOX_MODE;
        const hdrSkybox = bjs.CreateBox("hdrSkyBox", {
          size: 1000.0
        }, scene);
        const hdrMaterial = new bjs.BackgroundMaterial("hdrMaterial", scene);
        hdrMaterial.backFaceCulling = false;
        hdrMaterial.reflectionTexture = hdrTexture;
        hdrSkybox.material = hdrMaterial;
      }

      // scene.debugLayer.show();

      engine.runRenderLoop(() => {
        scene.render()
      });

      scene.onReadyObservable.addOnce(() => {
        setLoading(false)
      })
    })()

    return () => {
      canvas.current.remove()
    }
  }, [])

  return (
    <>
      <div className='fixed inset-0 z-40 bg-black flex items-center justify-center transition-opacity ease-in-out duration-200 pointer-events-none' style={{
        opacity: loading ? 1 : 0
      }}>
        <i className='text-white bi bi-arrow-repeat text-6xl animate-spin'></i>
      </div>
      <div className='relative bg-black h-[100dvh]'>
        <canvas ref={canvas} className='w-full h-full'></canvas>

        <div className='absolute bottom-2 right-2 md:w-96 left-2 md:left-auto bg-black border-2 border-white z-30 rounded-2xl overflow-hidden'>
          <div className='h-16'>
            <button className='h-full text-white transition-colors ease-in-out duration-200 hover:bg-white hover:text-black px-4' onClick={() => {
              updateable.current.simulate = !updateable.current.simulate;
              forceUpdate();
            }}>
              {
                updateable.current && updateable.current.simulate ? <i className='bi bi-pause text-4xl'></i> : <i className='bi bi-play text-4xl'></i>
              }
            </button>
          </div>
          <div>
            <canvas ref={chartCanvas} className='w-full h-60 bg-black'></canvas>
          </div>
        </div>

      </div>
    </>
  )
}

export default Simulation
