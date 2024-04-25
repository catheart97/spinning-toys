import * as bjs from '@babylonjs/core';
import '@babylonjs/loaders'

import OloidMesh from "../public/oloid_lp.glb"

export class Oloid {

    circleNormals = [
        new bjs.Vector3(0, 1, 0),
        new bjs.Vector3(0, 0, -1),
    ]

    circleOffsets = [
        new bjs.Vector3(-.5, 0, 0),
        new bjs.Vector3(0.5, 0, 0),
    ]
    
    core: bjs.TransformNode

    // all transforms
    constructor(private root: bjs.TransformNode) {
        this.core = new bjs.TransformNode("core", root.getScene())
        this.core.rotationQuaternion = new bjs.Quaternion();
        this.core.parent = root;

        // visualize circles as children of core
        const circle1 = bjs.CreateDisc(
            "circle1", {
                radius: 1
            }, this.core.getScene()
        )
        circle1.rotation.x = Math.PI / 2;
        circle1.position = this.circleOffsets[0]
        circle1.parent = this.core;

        const circle2 = bjs.CreateDisc(
            "circle2", {
                radius: 1
            }, this.core.getScene()
        )
        circle2.rotation.z = Math.PI / 2;
        circle2.position = this.circleOffsets[1]
        circle2.parent = this.core;

        this.init();
    }

    async init() {
        const res = await bjs.SceneLoader.ImportMeshAsync("", OloidMesh, "", this.root.getScene())
        res.meshes.forEach(mesh => {
            mesh.setParent(this.core)
            mesh.getChildMeshes(false).forEach(c => {
                c.material.wireframe = true;
            })
        });

        this.core.getScene().onBeforeRenderObservable.add(() => {
            this.core.rotate(bjs.Vector3.Left(), 0.01);
            this.core.rotate(bjs.Vector3.Right(), 0.005);
            this.core.position.y = this.contactPoint().y;
        });
    }

    contactPoint() {
        const rotMatrix = new bjs.Matrix()
        this.core.rotationQuaternion.toRotationMatrix(rotMatrix);
        const iRotMatrix = rotMatrix.invert()

        const upInCore = bjs.Vector3.TransformCoordinates(bjs.Vector3.Up(), iRotMatrix)

        const n1 = this.circleNormals[0].clone();
        const c1 = n1.cross(n1.cross(upInCore)).normalize().add(this.circleOffsets[0])

        const n2 = this.circleNormals[1].clone();
        const c2 = n2.cross(n2.cross(upInCore)).normalize().add(this.circleOffsets[1])

        const cw = [
            bjs.Vector3.TransformCoordinates(c1, rotMatrix),
            bjs.Vector3.TransformCoordinates(c2, rotMatrix),
            bjs.Vector3.TransformCoordinates(c1.negate(), rotMatrix),
            bjs.Vector3.TransformCoordinates(c2.negate(), rotMatrix),
        ]
        
        // return cw with lowest y 
        return cw.reduce((a, b) => a.y < b.y ? a : b).negate()
    }
}