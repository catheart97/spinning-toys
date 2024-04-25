import * as React from 'react'
import * as bjs from '@babylonjs/core'
import '@babylonjs/inspector'

import {Oloid} from './Oloid'

import HDR from "../public/symmetrical_garden_02_4k.jpeg"

import WoodAlbedo from "../public/worn_planks_diff_2k.jpg"
import WoodNormal from "../public/worn_planks_nor_gl_2k.jpg"
import WoodRoughness from "../public/worn_planks_rough_2k.jpg"

const App = () => {
  const canvas = React.useRef<HTMLCanvasElement>()

  React.useEffect(() => {
    (async () => {
      const engine = new bjs.Engine(canvas.current, true)
      const scene = new bjs.Scene(engine)
      scene.clearColor = new bjs.Color4(0, 0, 0, 0)
      const camera = new bjs.ArcRotateCamera('camera', 0, 0, 10, bjs.Vector3.Zero(), scene)
      camera.setTarget(bjs.Vector3.Zero())
      camera.attachControl(canvas.current, false)
      camera.panningDistanceLimit = 19
      
      {
        // setup lightning and environment 
        const hdrTexture = new bjs.EquiRectangularCubeTexture(HDR, scene, 1024);
        scene.environmentTexture = hdrTexture.clone();
  
        hdrTexture.coordinatesMode = bjs.Texture.SKYBOX_MODE;
        const hdrSkybox = bjs.CreateBox("hdrSkyBox", {
          size: 1000.0
        }, scene);
        const hdrMaterial = new bjs.BackgroundMaterial("hdrMaterial", scene);
        hdrMaterial.backFaceCulling = false;
        hdrMaterial.reflectionTexture = hdrTexture;
        hdrSkybox.material = hdrMaterial;
      }

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

      // setup actual scene
      const root = new bjs.TransformNode("sceneRoot", scene)
      const oloid = new Oloid(root)

      scene.debugLayer.show();
      
      engine.runRenderLoop(() => {
        scene.render()
      });
    })()

    return () => {
      canvas.current.remove()
    }
  }, [])

  return (
    <div className='relative bg-black h-[-webkit-fill-available] h-screen'>
      <canvas ref={canvas} className='w-full h-[inherit]'></canvas>
    </div>
  )
}

export default App
