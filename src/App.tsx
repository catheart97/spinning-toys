import * as React from 'react'
import * as bjs from '@babylonjs/core'
import '@babylonjs/inspector'

import { Oloid } from './Oloid'

import HDR from "../public/symmetrical_garden_02_4k.jpeg"

import WoodAlbedo from "../public/worn_planks_diff_2k.jpg"
import WoodNormal from "../public/worn_planks_nor_gl_2k.jpg"
import WoodRoughness from "../public/worn_planks_rough_2k.jpg"

import OloidMesh from "../public/oloid_lp.glb"
import PhiTopMesh from "../public/phitop.glb"
import { IUpdateable } from './Utility'
import { PhiTop } from './PhiTop'

const App = () => {
  const canvas = React.useRef<HTMLCanvasElement>()
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      const engine = new bjs.Engine(canvas.current, true)
      const scene = new bjs.Scene(engine)
      scene.clearColor = new bjs.Color4(0, 0, 0, 0)

      const camera = new bjs.ArcRotateCamera('camera', Math.PI / 2, 0, 10, bjs.Vector3.Zero(), scene)
      camera.setTarget(bjs.Vector3.Zero())
      camera.attachControl(canvas.current, false)
      camera.panningDistanceLimit = 2

      // camera.mode = bjs.Camera.ORTHOGRAPHIC_CAMERA
      // scene.onBeforeRenderObservable.add(() => {
      //   const aspect = engine.getRenderWidth() / engine.getRenderHeight()

      //   camera.orthoBottom = -5
      //   camera.orthoTop = 5
      //   camera.orthoLeft = -5 * aspect
      //   camera.orthoRight = 5 * aspect
      // })

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

      const updateables: IUpdateable[] = []

      /// ! OLOID 
      // {
      //   const res = await bjs.SceneLoader.ImportMeshAsync("", OloidMesh, "", scene)
      //   const oloidMesh = res.meshes.filter(m => m.name == "__root__")[0] as bjs.Mesh

      //   const oloid = new Oloid(oloidMesh)
      //   updateables.push(oloid)
      // }

      /// ! PHITOP
      {
        const res = await bjs.SceneLoader.ImportMeshAsync("", PhiTopMesh, "", scene)
        const phitopMesh = res.meshes.filter(m => m.name == "__root__")[0] as bjs.Mesh

        const phitop = new PhiTop(phitopMesh)
        updateables.push(phitop)

        canvas.current.addEventListener('click', () => {
          const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, bjs.Matrix.Identity(), camera)
          const pick = scene.pickWithRay(ray)
          if (pick.pickedMesh == phitop.mesh) {
            const mesh = pick.pickedMesh
            if (mesh == phitop.mesh) {
              phitop.applyAngularAcceleration(
                new bjs.Vector3(0, Math.PI, 0)
              )
            }
          }
        });
      }

      {
        scene.onAfterRenderObservable.add(() => {
          const dt = engine.getDeltaTime() / 1000
          updateables.forEach(u => u.update(dt))
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

      scene.debugLayer.show();
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
      <div className='fixed inset-0 z-50 bg-black flex items-center justify-center transition-opacity ease-in-out duration-200 pointer-events-none' style={{
        opacity: loading ? 1 : 0
      }}>
        <i className='text-white bi bi-arrow-repeat text-6xl animate-spin'></i>
      </div>
      <div className='relative bg-black h-[-webkit-fill-available] h-screen'>
        <canvas ref={canvas} className='w-full h-[inherit]'></canvas>
      </div>
    </>
  )
}

export default App
